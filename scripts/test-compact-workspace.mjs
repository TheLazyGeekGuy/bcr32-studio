import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const nativeRequire = createRequire(import.meta.url)
const cache = new Map()
function load(name) {
  if (!name.startsWith('.')) return nativeRequire(name)
  if (cache.has(name)) return cache.get(name)
  const base = new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url)
  if(name.endsWith('.json'))return JSON.parse(readFileSync(base,'utf8'))
  const file = existsSync(`${base.pathname}.tsx`) ? `${base.pathname}.tsx` : `${base.pathname}.ts`
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  cache.set(name, exports)
  new Function('require', 'exports', code)(load, exports)
  return exports
}
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(html.includes('class="studio compact"'))
assert.ok(html.includes('Studio v'+JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version))
assert.ok(html.includes('class="editor-brand"'))
assert.ok(html.includes('src="branding/bcr32-studio-logo.webp"'))
assert.ok(html.includes('alt="BCR32 Studio"'))
assert.ok(!html.includes('Controller Editor'))
assert.ok(!html.includes('class="topbar"'))
assert.ok(!html.includes('class="notice"'))
assert.ok(!html.includes('Detailed view'))
assert.ok(!html.includes('Compact view'))
assert.ok(html.includes('class="sidebar-notice" role="status"'))
assert.ok(html.includes('class="sidebar"'))
assert.ok(html.includes('class="cc-toggle "'))
assert.ok(html.includes('Send CC to BCR32'))
assert.equal((html.match(/class="tool-tabs"/g) || []).length, 1)
assert.ok(html.includes('class="ports" hidden=""'))
assert.ok(!html.includes('class="studio-toolbar"'))
assert.ok(html.includes('class="profile-actions preset-panel" hidden="" aria-label="Preset management"'))
assert.ok(html.includes('aria-label="Imports and exports"'))
assert.ok(html.indexOf('aria-label="Preset management"') > html.indexOf('class="sidebar"'))
assert.ok(!html.includes('class="preset-quick"'))
assert.ok(html.includes('class="log" hidden=""'))
assert.ok(!html.includes('class="inspector" hidden=""'))
assert.ok(!html.includes('class="rotation-estimate"'))
assert.ok(!html.includes('Prepare CC 0–31'))
assert.ok(!html.includes('Apply to BCR-32'))
assert.ok(!html.includes('Allow SysEx for the probe'));assert.ok(!html.includes('Enc1 ↔ CC16 / CH1'))
assert.equal((html.match(/class="knob-cap"/g) || []).length, 32)
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
assert.match(css, /\.studio\.compact\s*\{[^}]*height:100dvh/)
assert.match(css, /\.compact \.panel-viewport\s*\{[^}]*min-width:0/)
assert.match(css, /\.compact \.workspace\s*\{[^}]*border:0; background:transparent/)
assert.match(css, /\.compact \.panel-scroll\s*\{[^}]*container-type:size/)
console.log('PASS: compact default, embedded branding, right tools tabs, obsolete estimate/apply/CC-plan/SysEx/association buttons removed, 32 knobs, viewport-sized canvas')
