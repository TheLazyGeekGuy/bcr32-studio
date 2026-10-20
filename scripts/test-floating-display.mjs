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
const { floatingSupported } = load('./FloatingDisplay')
const { drawScreens, screenText, screenColors, canvasSize } = load('./display-canvas')
const { createEncoder } = load('./profile')
const { catalog, translate } = load('./i18n')

// 1. What the floating screens show: the OLED text of the control and its label.
const config = { ...createEncoder(1), type: 'cc', parameter: 10 }
assert.deepEqual(screenText({ kind: 'encoders', id: 1 }, config, 67, 'midi', 'Filter'), { label: 'Filter', kind: 'ENC', id: 1, parameter: 'CC 10:ABS', value: '67', channel: 'CH 1', origin: 'MIDI', blank: false })
assert.deepEqual((({ value, origin, parameter }) => [value, origin, parameter])(screenText({ kind: 'pushes', id: 3 }, { ...createEncoder(3), type: 'off' }, null, 'local', 'x')), ['--', 'UNKNOWN', 'OFF'])

// 2. Drawing on a recording 2D context: two screen panels, dots in the style's ink, nothing drawn when the control's
// display is off.
const record = () => { const calls = []; const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => calls.push([k, ...a]), set: (t, k, v) => { t[k] = v; calls.push(['set ' + String(k), v]); return true } }); return { ctx, calls } }
const shown = screenText({ kind: 'encoders', id: 1 }, config, 67, 'midi', 'Filter')
const a = record(); drawScreens(a.ctx, shown, 'amber')
assert.equal(a.calls.filter(c => c[0] === 'roundRect').length, 2, 'label screen + OLED')
assert.ok(a.calls.some(c => c[0] === 'set fillStyle' && c[1] === screenColors.amber.ink), 'amber ink')
const dotsShown = a.calls.filter(c => c[0] === 'fillRect').length
assert.ok(dotsShown > 200, `dot matrix drawn (${dotsShown} dots)`)
const b = record(); drawScreens(b.ctx, { ...shown, blank: true }, 'ice')
assert.equal(b.calls.filter(c => c[0] === 'fillRect').length, 1, 'display off: background only')
assert.deepEqual(canvasSize, { width: 640, height: 488 })

// 3. Without picture-in-picture (this Node run, Firefox): the button is disabled with the reason, translated.
assert.equal(floatingSupported(), false)
const app = renderToStaticMarkup(React.createElement(load('./App').default))
assert.match(app, /<button class="floating-toggle" aria-pressed="false" disabled="" title="Needs a browser with picture-in-picture \(Chrome, Edge, Brave, Safari\)">Floating display<\/button>/)
for (const k of ['Floating display', 'Close floating display', 'Needs a browser with picture-in-picture (Chrome, Edge, Brave, Safari)', 'A bare always-on-top window with the screens, movable and resizable']) assert.ok(catalog[k], 'catalog: ' + k)
assert.equal(translate('Floating display', 'fr'), 'Écran flottant')
const src = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(src.includes('openFloatingDisplay(') && !src.includes('createPortal('), 'video picture-in-picture, no second browser window')
console.log('PASS: floating display — OLED and label text, canvas drawing per screen style, display off, disabled with a reason without picture-in-picture')
