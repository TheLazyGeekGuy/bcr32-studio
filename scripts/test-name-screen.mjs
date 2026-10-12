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
const { parameterLabel, defaultNames } = load('./parameter-names')
const { FrontPanel } = load('./FrontPanel')
const { dotText, glyphChars } = load('./OledDisplay')
const { createProfile, createEncoder } = load('./profile')
const { catalog, translate } = load('./i18n')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

// 1. Which name the screen shows: custom label, then the parameter-name table, then the raw MIDI parameter.
const cc = p => ({ ...createEncoder(1), type: 'cc', parameter: p })
assert.equal(parameterLabel(cc(1), defaultNames), 'Modulation', 'table name for CC 1')
assert.equal(parameterLabel(cc(1), defaultNames, '  Filter  '), 'Filter', 'custom label wins, trimmed')
assert.equal(parameterLabel(cc(102), defaultNames), 'CC 102', 'raw parameter when unnamed')
assert.equal(parameterLabel({ ...cc(5), type: 'nrpn', parameter: 300 }, defaultNames), 'NRPN 300')
assert.equal(parameterLabel({ ...cc(0), type: 'note', parameter: 36 }, defaultNames), 'Note 36')
assert.equal(parameterLabel({ ...cc(0), type: 'pb' }, defaultNames), 'Pitch bend')
assert.equal(parameterLabel({ ...cc(0), type: 'off' }, defaultNames, 'Ignored'), 'OFF', 'an unassigned control shows OFF')
assert.equal(parameterLabel({ ...cc(7), parameterOff: true }, defaultNames), 'OFF', 'Parameter Off shows OFF')

// 2. Dot-matrix text: upper case, accents folded, every character of the default names drawable, long names cut.
assert.equal(dotText('Résonance'), 'RESONANCE')
assert.equal(dotText('x'.repeat(40)).length, 24, 'at most 24 characters')
for (const { name } of defaultNames) for (const c of dotText(name)) assert.ok(c === ' ' || glyphChars.includes(c), `glyph for "${c}" (${name})`)

// 3. Rendered: absent by default, present above the OLED with the name when the option gives one.
const profile = createProfile()
const render = props => renderToStaticMarkup(React.createElement(FrontPanel, { profile, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, ...props }))
assert.ok(!render({}).includes('name-display'), 'no name screen unless enabled')
const html = render({ nameScreen: 'Modulation' })
assert.match(html, /class="name-display"[^>]*aria-label="[^"]*Modulation"/, 'name screen with its accessible name')
const top = s => Number(/top:\s*([\d.]+)%/.exec(s)?.[1]), box = cls => new RegExp(`class="${cls}"[^>]*style="([^"]*)"`).exec(html)?.[1] ?? ''
const nameStyle = box('name-display'), oledStyle = box('oled-display')
assert.ok(top(nameStyle) < top(oledStyle), 'name screen sits above the OLED')
const height = s => Number(/height:\s*([\d.]+)%/.exec(s)?.[1])
assert.ok(Math.abs(height(nameStyle) * 2 - height(oledStyle)) < 0.01, 'half the OLED height')

// 4. Zoom: follows the OLED's auto-zoom, scaled like it and kept above it.
const zoom = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(m => /\.auto-zoom-active\s+\.name-display/.test(m[1]))
assert.ok(zoom && /scale\(1\.55\)/.test(zoom[2]) && /translateY\(-/.test(zoom[2]), 'zoomed with the OLED, lifted above it')

// 5. Option: Config checkbox, off by default, persisted, translated; App passes the computed name.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes("'bcr32-studio.name-screen'") && app.includes("=== 'true'"), 'stored option, off by default')
assert.ok(/nameScreen=\{nameScreen \? parameterLabel\(/.test(app), 'App computes the name only when enabled')
const appHtml = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(appHtml.includes('Parameter name screen'), 'Config renders the option')
assert.ok(!appHtml.includes('name-display'), 'off by default')
assert.equal(translate('Parameter name screen', 'fr'), 'Écran du nom de paramètre')
assert.ok(catalog['Parameter name screen'])
console.log('PASS: parameter name screen — label priority (custom, table, raw, OFF), dot-matrix text, rendered half-height above the OLED, zoom follows the OLED, option off by default, persisted, translated')
