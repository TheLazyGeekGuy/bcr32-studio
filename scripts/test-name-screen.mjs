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
const { defaultNames } = load('./parameter-names')
const { FrontPanel, controlLabel, printedName } = load('./FrontPanel')
const { dotText, glyphChars } = load('./OledDisplay')
const { createProfile } = load('./profile')
const { emptyLabels } = load('./presets')
const { catalog, translate } = load('./i18n')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

// 1. The screen shows the control's label: the user's label, else the name printed on the panel.
const labels = emptyLabels()
assert.equal(controlLabel('encoders', 1, labels), 'BPM', 'printed name of encoder 1')
labels.encoders[0] = '  Cutoff  '
assert.equal(controlLabel('encoders', 1, labels), 'Cutoff', 'user label wins, trimmed')
assert.equal(controlLabel('pushes', 2, labels), 'CLOCK', "a push takes its encoder's printed name")
labels.pushes[1] = 'Tap'; assert.equal(controlLabel('pushes', 2, labels), 'Tap', 'push label')
assert.equal(controlLabel('buttons', 6, labels), 'VELOCITY', 'key printed name (as drawn on the panel)')
assert.deepEqual([21, 24, 65, 68, 74, 75].map(id => printedName('buttons', id)), ['T1', 'T4', 'INST SEL', 'PLAY / STOP', 'FOOTSW 1', 'FOOTSW 2'])

// 2. Dot-matrix text: upper case, accents folded, every character of the default names drawable, long names cut.
assert.equal(dotText('Résonance'), 'RESONANCE')
assert.equal(dotText('x'.repeat(40)).length, 24, 'at most 24 characters')
for (const kind of ['encoders', 'buttons']) for (const id of kind === 'encoders' ? Array.from({ length: 32 }, (_, i) => i + 1) : [...Array.from({ length: 20 }, (_, i) => i + 5), 65, 66, 67, 68, 74, 75]) for (const c of dotText(printedName(kind, id))) assert.ok(c === ' ' || glyphChars.includes(c), `glyph for "${c}" (${printedName(kind, id)})`)
assert.equal(dotText('CTRL α T1'), 'CTRL Α T1', 'alpha kept')
for (const { name } of defaultNames) for (const c of dotText(name)) assert.ok(c === ' ' || glyphChars.includes(c), `glyph for "${c}" (${name})`)

// 3. Rendered: absent by default, present above the OLED with the name when the option gives one.
const profile = createProfile()
const render = props => renderToStaticMarkup(React.createElement(FrontPanel, { profile, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, ...props }))
assert.ok(!render({}).includes('name-display'), 'no label screen unless enabled')
const html = render({ nameScreen: true })
assert.match(html, /class="name-display"[^>]*aria-label="Label: BPM"/, 'label screen shows the label of the control on screen')
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
assert.ok(app.includes('nameScreen={nameScreen}'), 'App passes the option')
const appHtml = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(appHtml.includes('Label screen'), 'Config renders the option')
assert.ok(!appHtml.includes('name-display'), 'off by default')
assert.equal(translate('Label screen', 'fr'), 'Écran d’étiquette')
assert.ok(catalog['Label screen'] && catalog['Label'])
console.log('PASS: label screen — user label else printed panel name, dot-matrix text, rendered half-height above the OLED, zoom follows the OLED, option off by default, persisted, translated')
