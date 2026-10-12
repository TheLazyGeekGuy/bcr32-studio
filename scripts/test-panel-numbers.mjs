import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) {
  if (!name.startsWith('.')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const base = fileURLToPath(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url))
  if (name.endsWith('.json')) return JSON.parse(readFileSync(base, 'utf8'))
  const code = ts.transpileModule(readFileSync(existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}; cache.set(name, exports); new Function('require', 'exports', code)(load, exports); return exports
}
const { FrontPanel } = load('./FrontPanel')
const { createProfile } = load('./profile')
const { catalog, translate } = load('./i18n')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const profile = createProfile()
const render = props => renderToStaticMarkup(React.createElement(FrontPanel, { profile, selection: { kind: 'buttons', id: 5 }, select() {}, action() {}, ...props }))
const count = (html, cls) => (html.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length

// 1. Numbers shown by default: 32 encoder numbers and 16 key numbers; hidden entirely when the option is off.
const shown = render({}), hidden = render({ showNumbers: false })
assert.equal(count(shown, 'encoder-number'), 32, 'one number above each encoder')
assert.equal(count(shown, 'key-number'), 16, 'one number above each programmable key')
assert.equal(count(hidden, 'encoder-number'), 0, 'encoder numbers hidden when the option is off')
assert.equal(count(hidden, 'key-number'), 0, 'key numbers hidden when the option is off')
assert.ok(hidden.includes('PITCH') && hidden.includes('BPM'), 'labels stay when numbers are hidden')

// 2. Encoder numbers are centred over the knob: the box is centred on the knob x and its content centred inside it.
const numberRules = [...css.matchAll(/(^|\n)([^{}\n]*\.encoder-number[^{}\n]*)\{([^}]*)\}/g)].filter(m => !/small/.test(m[2])).map(m => m[3]).join(';')
assert.match(numberRules, /justify-content:\s*center/, 'flex content centred horizontally')
assert.doesNotMatch(numberRules, /justify-content:\s*(flex-)?start/, 'no start alignment left')

// 3. A selected key is shown at full brightness while active, even when unassigned (dimmed at rest), then back to normal.
const keyStart = shown.indexOf('aria-label="Button 5'), selectedKey = shown.slice(shown.lastIndexOf('<button', keyStart), shown.indexOf('</button>', keyStart))
assert.match(selectedKey, /class="[^"]*control-off[^"]*active/, 'the selected unassigned key carries both classes')
const fullRule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(m => /\.key-hit\.control-off\.active/.test(m[1]) && /\.silver-key-label/.test(m[1]) && /\.custom-key-label/.test(m[1]))
assert.ok(fullRule, 'a rule restores the labels of an active unassigned key')
assert.match(fullRule[2], /opacity:\s*1\b/, 'full brightness while active')
const dimRule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(m => /\.studio \.front-panel \.key-hit\.control-off \.silver-key-label/.test(m[1]))
assert.ok(dimRule && /opacity:\s*\.3/.test(dimRule[2]), 'unassigned keys stay dimmed at rest')
const specificity = selector => selector.trim().split(/\s+/).reduce((n, part) => n + (part.match(/\.|\[/g) ?? []).length, 0)
const fullSelector = fullRule[1].split(',').find(s => /silver-key-label/.test(s)), dimSelector = dimRule[1].split(',').find(s => /silver-key-label/.test(s))
assert.ok(specificity(fullSelector) > specificity(dimSelector), 'the active rule outranks the dimming rule')

// 4. Config option, persisted, translated.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes("'bcr32-studio.show-numbers'"), 'preference persisted in local storage')
assert.ok(app.includes('showNumbers={showNumbers}'), 'App passes the option to the panel')
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(html.includes('Show control numbers'), 'Config tab renders the option')
assert.ok(catalog['Show control numbers'], 'catalog row')
assert.equal(translate('Show control numbers', 'fr'), 'Afficher les numéros des contrôles')
console.log('PASS: control numbers shown by default and hidden by the option, encoder numbers centred, selected unassigned key at full brightness while active, option persisted and translated')
