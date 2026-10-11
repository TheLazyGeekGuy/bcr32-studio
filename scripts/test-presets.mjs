import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const root = new URL('../', import.meta.url).pathname
const out = root + 'output/preset-test'
mkdirSync(out, { recursive: true })
for (const module of ['presets', 'profile', 'preset-pdf']) await build({ entryPoints: [root + `src/${module}.ts`], bundle: true, platform: 'node', format: 'cjs', outfile: `${out}/${module}.cjs` })
const require = createRequire(import.meta.url)
const { createProfile, ccPlan } = require(out + '/profile.cjs')
const { emptyLabels, emptyValues, makePreset, parsePreset, parseLibrary, libraryFile, sameState } = require(out + '/presets.cjs')
const { presetPdf } = require(out + '/preset-pdf.cjs')
const state = { profile: ccPlan(createProfile()), labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' }
state.labels.encoders[0] = 'ADSR · Attack'
state.labels.encoders[1] = 'Resonanz α / β'
state.labels.pushes[0] = 'Auslöser'
state.labels.buttons[0] = 'Filter on'
state.values.encoders[0] = 93
state.values.pushes[0] = 127
state.values.buttons[0] = 0
state.profile.pushes[0].type = 'cc'; state.profile.pushes[0].parameter = 90
state.profile.buttons[0].type = 'cc'; state.profile.buttons[0].parameter = 60
state.profile.encoders[0].ledMode = 'pan'
const p = makePreset(state, 'Synth · ADSR · Größe', 'fixture', '2026-10-09T20:25:00.000Z')
state.profile.encoders[0].parameter = 99
state.labels.encoders[0] = 'changed'
assert.equal(p.profile.encoders[0].parameter, 0)
assert.equal(p.profile.encoders[0].ledMode, 'pan')
assert.equal(parsePreset(JSON.parse(JSON.stringify(p))).profile.encoders[0].ledMode, 'pan')
assert.equal(p.labels.encoders[0], 'ADSR · Attack')
assert.equal(p.values.encoders[1], null)
assert.equal(p.profile.pushes[0].parameter, 90)
assert.equal(p.profile.buttons[0].parameter, 60)
assert.deepEqual(parsePreset(JSON.parse(JSON.stringify(p))), p)
assert.deepEqual(parseLibrary(JSON.parse(JSON.stringify(libraryFile([p])))), [p])
assert.equal(sameState(p, parsePreset(p)), true)
assert.equal(sameState(p, { ...p, ringMode: 'dot' }), false)
for (const candidate of [null, {}, { ...p, version: 2 }, { ...p, name: '' }, { ...p, labels: emptyValues() }, { ...p, values: { ...p.values, encoders: Array(32).fill(128) } }, { ...p, values: { ...p.values, buttons: [] } }]) assert.throws(() => parsePreset(candidate))
assert.throws(() => parseLibrary(libraryFile([p, p])))
const pdf = await presetPdf(p, readFileSync(root + 'public/fonts/NotoSans-Regular.ttf'))
await assert.rejects(() => presetPdf({ ...p, name: 'Synth 🎹' }, readFileSync(root + 'public/fonts/NotoSans-Regular.ttf')), /not available in the PDF font/)
writeFileSync(out + '/preset-A4.pdf', pdf)
const { PDFDocument } = require('pdf-lib')
const doc = await PDFDocument.load(pdf)
assert.equal(doc.getPageCount(), 3)
for (const page of doc.getPages()) { assert.ok(Math.abs(page.getWidth() - 595.28) < .01); assert.ok(Math.abs(page.getHeight() - 841.89) < .01) }
console.log('PASS: independent full snapshots, known/unknown values, labels, JSON bank/roundtrip, invalid imports, 3-page A4 PDF')
