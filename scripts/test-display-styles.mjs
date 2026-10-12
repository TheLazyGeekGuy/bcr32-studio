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
const { displayStyles, validDisplayStyle } = load('./display-styles')
const { FrontPanel } = load('./FrontPanel')
const { DisplayPreview } = load('./OledDisplay')
const { createProfile } = load('./profile')
const { catalog, translate } = load('./i18n')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }))

// 1. Catalogue of styles: ids, names, default first.
assert.deepEqual(displayStyles.map(s => s.id), ['ice', 'amber', 'green', 'red', 'white'])
assert.equal(displayStyles[0].id, 'ice', 'the current look stays the default')
assert.ok(validDisplayStyle('amber') && !validDisplayStyle('pink') && !validDisplayStyle(null))

// 2. Every style defines the four screen variables; the screens draw with them (no hard-coded colour left).
for (const { id } of displayStyles) {
  const rule = rules.find(r => r.selector.split(',').map(s => s.trim()).includes(`[data-display="${id}"]`))
  assert.ok(rule, `rule for ${id}`)
  for (const v of ['--oled-ink', '--oled-glow', '--oled-meta', '--oled-bg']) assert.match(rule.body, new RegExp(`${v}\\s*:`), `${id} defines ${v}`)
}
const body = sel => rules.filter(r => r.selector === sel).map(r => r.body).join(';')
assert.match(body('.oled-pixels'), /fill:\s*var\(--oled-ink/, 'pixels use the ink colour')
assert.match(body('.oled-pixels'), /drop-shadow\([^)]*var\(--oled-glow/, 'glow uses the glow colour')
assert.match(body('.oled-meta'), /fill:\s*var\(--oled-meta/, 'secondary text uses the meta colour')
assert.match(body('.oled-glass'), /background:\s*var\(--oled-bg/, 'screen background follows the style')

// 3. The panel carries the chosen style; default ice.
const profile = createProfile()
const render = props => renderToStaticMarkup(React.createElement(FrontPanel, { profile, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, ...props }))
assert.match(render({}), /class="front-panel[^"]*"[^>]*data-display="ice"/, 'default style on the panel')
assert.match(render({ displayStyle: 'red' }), /data-display="red"/, 'chosen style on the panel')

// 4. Preview: a miniature screen drawn with the same variables, so it shows exactly what the panel will show.
const preview = renderToStaticMarkup(React.createElement(DisplayPreview, { style: 'amber' }))
assert.match(preview, /class="display-preview" data-display="amber"/)
assert.match(preview, /class="oled-glass"/); assert.match(preview, /class="oled-pixels"/)

// 5. Config: one button per style with its preview, pressed state, persisted, translated.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.equal(load('./display-styles').displayStyleKey, 'bcr32-studio.display-style', 'storage key')
assert.ok(app.includes('localStorage.getItem(displayStyleKey)') && app.includes('localStorage.setItem(displayStyleKey') && app.includes('displayStyle={displayStyle}'), 'persisted and passed to the panel')
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.equal((html.match(/class="display-style-option"/g) ?? []).length, 5, 'five options in Config')
assert.equal((html.match(/class="display-preview"/g) ?? []).length, 5, 'each option shows its preview')
assert.match(html, /aria-pressed="true"[^>]*>[^]*?Ice OLED/, 'default option pressed')
assert.ok(html.includes('Display style'))
for (const k of ['Display style', 'Ice OLED', 'Amber VFD', 'Green LCD', 'Red LED', 'White OLED']) assert.ok(catalog[k], 'catalog: ' + k)
assert.equal(translate('Amber VFD', 'fr'), 'VFD ambre')
console.log('PASS: display styles — five styles with full variable sets, screens drawn from the variables, panel carries the style, live previews in Config, persisted, translated')
