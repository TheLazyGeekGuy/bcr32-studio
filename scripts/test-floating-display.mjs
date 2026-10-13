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
const { FloatingDisplay, copyStyles, delegatingTimers, floatingSupported } = load('./FloatingDisplay')
const { createEncoder } = load('./profile')
const { catalog, translate } = load('./i18n')

// 1. Timers run in the floating window while it is open, and are cleared in the window that created them.
const calls = []
const fakeWin = name => ({ setTimeout: (fn, ms) => { calls.push(`${name}.set ${ms}`); return 7 }, clearTimeout: id => calls.push(`${name}.clear ${id}`) })
globalThis.window = fakeWin('main')
let current = null
const timers = delegatingTimers(() => current)
const a = timers.set(() => {}, 50)
current = fakeWin('pip'); const b = timers.set(() => {}, 50)
current = null; timers.clear(b); timers.clear(a)
assert.deepEqual(calls, ['main.set 50', 'pip.set 50', 'pip.clear 7', 'main.clear 7'], 'set in the current window, clear in the creating one')
delete globalThis.window

// 1b. Styles: the floating document inherits style-src 'self', which blocks inline <style> (no style at all in the built
// app, seen on 2026-10-13): a stylesheet file is linked by its URL; only a sheet without a file (dev server) is copied as text.
{
  const made = [], doc = { createElement: tag => ({ tag }), head: { append: node => made.push(node) } }
  const from = { styleSheets: [{ href: 'https://example.test/assets/index.css', get cssRules() { return [{ cssText: '.a{}' }] } }, { href: null, cssRules: [{ cssText: '.dev{color:red}' }] }, { href: null, get cssRules() { throw Error('blocked') } }] }
  copyStyles(from, doc)
  assert.deepEqual(made, [{ tag: 'link', rel: 'stylesheet', href: 'https://example.test/assets/index.css' }, { tag: 'style', textContent: '.dev{color:red}' }], 'built stylesheet linked, never inlined; dev sheet copied')
}

// 2. The floating content: label screen and OLED filling the window, in the chosen theme and screen style.
const config = { ...createEncoder(1), type: 'cc', parameter: 74 }
const html = renderToStaticMarkup(React.createElement(FloatingDisplay, { theme: 'graphite', displayStyle: 'amber', control: { kind: 'encoders', id: 1 }, config, label: 'Cutoff', value: 90, source: 'midi', inspect() {}, setValue() {} }))
assert.match(html, /^<main class="studio floating-display" data-theme="graphite" data-display="amber">/)
assert.match(html, /class="name-display"[^>]*aria-label="Label: Cutoff"/)
assert.match(html, /class="oled-display"[^>]*aria-label="OLED screen: ENC 1, CC 74:ABS, channel 1, value 90, MIDI"/)
assert.equal((html.match(/position:relative/g) ?? []).length, 2, 'both screens laid out in the window, not at panel coordinates')

// 3. Without the API (this Node run, Firefox, Safari): the button is shown disabled with the reason.
assert.equal(floatingSupported(), false)
const app = renderToStaticMarkup(React.createElement(load('./App').default))
assert.match(app, /<button class="floating-toggle" aria-pressed="false" disabled="" title="Needs Chrome or Edge 116 or later">Floating display<\/button>/)
for (const k of ['Floating display', 'Close floating display', 'Needs Chrome or Edge 116 or later']) assert.ok(catalog[k], 'catalog: ' + k)
assert.equal(translate('Floating display', 'fr'), 'Écran flottant')
const src = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(src.includes('timers: delegatingTimers(() => pipRef.current)'), 'the display arbiter runs on the floating window timers when open')
assert.ok(src.includes('createPortal(<FloatingDisplay'), 'content rendered into the floating window')
console.log('PASS: floating display — timers delegated to the visible floating window, OLED + label screen filling it with theme and style, disabled with a reason where unsupported, translated')
