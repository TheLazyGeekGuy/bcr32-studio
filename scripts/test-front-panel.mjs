import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { transformSync } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/FrontPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
// The panel plate is procedural: a CSS gradient plus an inline SVG fractal-noise grain, no image file to download.
const plate = css.match(/\.panel-plate\s*\{([^}]*)\}/)?.[1] ?? ''
assert.match(plate, /radial-gradient\(/, 'Plate gradient drawn by CSS')
assert.match(plate, /url\("data:image\/svg\+xml,[^"]*feTurbulence[^"]*fractalNoise[^"]*"\)/, 'Plate grain is an inline SVG feTurbulence data URI')
assert.ok([...plate.matchAll(/url\(([^)]*)\)/g)].every(m => /^"data:/.test(m[1])), 'No image file requested for the plate')
assert.match(plate, /clip-path:inset\(1\.25% \.82% 7\.6% \.82% round 1\.1cqw\)/, 'Plate keeps its clip')
assert.match(plate, /filter:var\(--panel-filter\)/, 'Themes still tint the plate')
assert.match(css, /\.panel-viewport\s*\{[^}]*aspect-ratio:1717 \/ 1350;[^}]*overflow:hidden/)
assert.match(css, /\.front-panel\s*\{[^}]*aspect-ratio:1717 \/ 1440/)
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const exports = {}
const localRequire = name => {
  if (!name.startsWith('./')) return require(name)
  const module = { exports: {} }
  const tsx = ['./ActivityLeds', './OledDisplay', './i18n', './Icon'].includes(name)
  const code = transformSync(readFileSync(new URL(`../src/${name.slice(2)}.${tsx ? 'tsx' : 'ts'}`, import.meta.url), 'utf8'), { loader: tsx ? 'tsx' : 'ts', jsx: 'automatic', format: 'cjs' }).code
  new Function('require', 'exports', 'module', code)(localRequire, module.exports, module)
  return module.exports
}
new Function('require', 'exports', compiled)(localRequire, exports)
const profile = {
  encoders: Array.from({ length: 32 }, (_, i) => ({ id: i + 1, type: 'cc', parameter: i, channel: 1, mode: 'absolute', minimum: 0, maximum: 127 })),
  pushes: Array.from({ length: 32 }, (_, i) => ({ id: i + 1, type: 'off', parameter: 0, channel: 1 })),
  buttons: Array.from({ length: 20 }, (_, i) => ({ id: i + 5, type: 'off', parameter: 0, channel: 1 })),
}
// Locked panel geometry (panel coordinate space 1717 × 1440), independent of layout helpers.
// This is a regression oracle for the placement, not a pixel-perfect rendering oracle.
const geometryHTML = renderToStaticMarkup(React.createElement(exports.FrontPanel, { profile, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, compact: true }))
assert.ok(geometryHTML.includes('/branding/bcr32-studio-logo.webp'))
assert.ok(geometryHTML.includes('alt="BCR32 Studio"'))
assert.ok(!geometryHTML.includes('<strong>BCR-32</strong>'))
assert.match(css, /\.editor-brand img\s*\{[^}]*object-fit:contain;[^}]*transform:scale\(1\.4266\)/)
function rectangles(className) {
  return [...geometryHTML.matchAll(/<(?:button|span|svg|div)\b[^>]*>/g)].map(match => match[0]).filter(tag => {
    const classes = tag.match(/class="([^"]*)"/)?.[1].split(' ') ?? []
    return classes.includes(className)
  }).map(tag => {
    const style = tag.match(/style="([^"]*)"/)?.[1] ?? ''
    return ['left', 'top', 'width', 'height'].map((key, i) => Number(style.match(new RegExp(`${key}:([\\d.]+)%`))?.[1]) * (i % 2 ? 1440 : 1717) / 100)
  })
}
function locked(className, expected) {
  const actual = rectangles(className)
  assert.equal(actual.length, expected.length, `${className} count`)
  actual.forEach((rect, index) => rect.forEach((n, axis) => assert.ok(Math.abs(n - expected[index][axis]) < 1e-7, `${className}[${index}] axis ${axis} moved`)))
}
const centres = Array.from({ length: 32 }, (_, i) => [107 + i % 8 * 161.4, 567 + Math.floor(i / 8) * 215.5])
locked('led-ring', centres.map(([x, y]) => [x - 74, y - 74, 148, 148]))
locked('knob-cap', centres.map(([x, y]) => [x - 49, y - 49, 98, 98]))
locked('push-hit', centres.map(([x, y]) => [x - 34, y - 34, 68, 68]))
locked('rotation-hit', [...centres.map(([x, y]) => [x - 72, y - 72, 144, 144]), [1583, 518, 96, 96]])
locked('encoder-number', centres.map(([x, y]) => [x - 22, y - 107, 44, 28]))
locked('name-hit', centres.map(([x, y]) => [x - 78, y + 74, 156, 27]))
locked('key-hit', [
  ...Array.from({ length: 16 }, (_, i) => [37 + i % 8 * 161.4, i < 8 ? 247 : 369, 140, 55]),
  ...Array.from({ length: 4 }, (_, i) => [i % 2 ? 1583 : 1422, i < 2 ? 247 : 369, 96, 55]),
  [1168, 124, 140, 55],
  ...Array.from({ length: 10 }, (_, i) => [i % 2 ? 1583 : 1422, [670, 792, 938, 1085, 1207][Math.floor(i / 2)], 96, 55]),
])
locked('oled-display', [[1374, 518, 192, 98]])
locked('editor-brand', [[700, 38, 305, 72]])
locked('led-socket', Array.from({ length: 6 }, (_, i) => [1434 + i * 46.6 - 16, 136, 32, 32]))
console.log('PASS: procedural plate (CSS gradient + inline SVG grain, no image file); locked panel geometry for controls, legends, LED rings, indicators and OLED')
for (const selection of [{ kind: 'encoders', id: 1 }, { kind: 'pushes', id: 8 }, { kind: 'buttons', id: 24 }]) {
  const html = renderToStaticMarkup(React.createElement(exports.FrontPanel, { profile, selection, select() {}, action() {} }))
  assert.ok(html.includes('<div class="panel-plate" aria-hidden="true"></div>'), 'Procedural plate element')
  assert.ok(!/<img\b(?![^>]*bcr32-studio-logo)/.test(html), 'No image element other than the logo')
  assert.ok(html.includes('class="chassis-frame"'))
  assert.ok(html.includes('class="panel-viewport"'))
  assert.equal((html.match(/class="knob-cap"/g) || []).length, 32)
  assert.equal((html.match(/class="activity-led off"/g) || []).length, 6)
  assert.equal((html.match(/class="activity-led blue"/g) || []).length, 0)
  assert.ok(html.includes('class="oled-display"'))
  assert.ok(html.includes('data-source="UNKNOWN"'))
  assert.equal((html.match(/<button /g) || []).length, 130)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  assert.equal((html.match(/aria-label="Encoder \d+ rotation"/g) || []).length, 32)
  assert.equal((html.match(/aria-label="Encoder \d+ push"/g) || []).length, 32)
  assert.equal((html.match(/aria-label="Button /g) || []).length, 24)
  for (const match of html.matchAll(/style="left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%"/g)) {
    const [x, y, w, h] = match.slice(1).map(Number)
    assert.ok(x >= 0 && y >= 0 && x + w <= 100 && y + h <= 100, 'hit region inside the panel')
  }
}
assert.equal(exports.ledIndex(0), 0)
assert.equal(exports.ledIndex(127), 20)
assert.equal(exports.ledIndex(64), 10)
const received = exports.receiveCC(profile, {}, [0xb0, 10, 123])
assert.deepEqual(received, { 11: { value: 123, source: 'midi' } })
assert.deepEqual(exports.receiveCC(profile, {}, [0xb1, 10, 123]), {})
assert.deepEqual(exports.receiveCC(profile, {}, [0x90, 10, 123]), {})
const relative = { ...profile, encoders: profile.encoders.map(e => ({ ...e, mode: 'rel1' })) }
assert.deepEqual(exports.receiveCC(relative, {}, [0xb0, 10, 123]), {})
for (const [mode, value, lit] of [['bar', 0, 1], ['bar', 127, 21], ['dot', 64, 1]]) {
  const html = renderToStaticMarkup(React.createElement(exports.FrontPanel, { profile, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, values: { 1: { value, source: 'local' } }, ringMode: mode }))
  assert.equal((html.match(/class="led-segment on"/g) || []).length, lit)
  assert.equal((html.match(/class="led-ring"/g) || []).length, 32)
  assert.equal((html.match(/<line /g) || []).length, 32 * 21)
}
const disabled = { ...profile, encoders: profile.encoders.map(e => ({ ...e, type: 'off' })) }
const offHTML = renderToStaticMarkup(React.createElement(exports.FrontPanel, { profile: disabled, selection: { kind: 'encoders', id: 1 }, select() {}, action() {}, values: { 1: { value: 127, source: 'local' } } }))
assert.equal((offHTML.match(/class="led-segment on"/g) || []).length, 0)
assert.equal((offHTML.match(/control-off/g) || []).length, 30)
for(const label of ['DRUM NOTES','GLOBAL','NOTE RPT','SELECT'])assert.ok(offHTML.includes(label),`Silkscreen ${label}`)
assert.ok(offHTML.includes('class="panel-silkscreen"'))
assert.equal((offHTML.match(/right-key/g)||[]).length,10)
assert.match(css,/\.key-hit \{[^}]*color:#f0eee8;/)
assert.match(css,/\.key-hit\.active \{[^}]*color:#ef5c61;/)
assert.ok(!source.includes('--key-accent'),'No old per-key palette')
assert.equal((offHTML.match(/push-enabled/g) || []).length, 0)
const activeControls = { ...profile, buttons: profile.buttons.map(e => ({ ...e, type: 'cc' })), pushes: profile.pushes.map(e => ({ ...e, type: 'cc' })) }
const activeHTML = renderToStaticMarkup(React.createElement(exports.FrontPanel, { profile: activeControls, selection: { kind: 'encoders', id: 1 }, select() {}, action() {} }))
assert.equal((activeHTML.match(/control-on/g) || []).length, 20)
assert.equal((activeHTML.match(/push-enabled/g) || []).length, 32)
console.log('PASS: 130 hit targets incl. 32 labels + 2 OLED, 32 rotation + 32 push, 24 programmable keys, independent selection, bounds')
console.log('PASS: LED extrema/midpoint, bar/dot segments, CC channel mapping, nonmatching relative codes/note ignored')
console.log('PASS: OFF stays dark even at 127; keys and pushes reflect profile activation independently')
