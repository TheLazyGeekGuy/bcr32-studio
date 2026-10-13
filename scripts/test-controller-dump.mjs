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
const { decodeControllerDump, isControllerDump, applyRecord, knownRecords, groupExports } = load('./controller-dump')
const { ExportImport } = load('./ExportImport')
const { createEncoder } = load('./profile')

// A synthetic export with the structure of the real 2026-10-12 captures: record 0 = CC 10 channel 1 0–127, record 1
// uninitialised (A5/F5), records 2+ OFF defaults. Nibbles high first; checksum = 16-bit sum of bytes 0–267.
function build(records, block = 0, corrupt = false, preset = 0) {
  const data = records.flat(); while (data.length < 128) data.push(0)
  const bytes = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x04, 0x0c, 0x01, 0x00, preset, block]
  for (const b of data.slice(0, 128)) bytes.push(b >> 4, b & 15)
  const sum = bytes.reduce((s, b) => s + b, 0) & 0xffff
  bytes.push((sum >> 12) & 15, (sum >> 8) & 15, (sum >> 4) & 15, (sum + (corrupt ? 1 : 0)) & 15, 0xf7)
  return bytes
}
const rec0 = [0x02, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x7f, 0x00, 0x00, 0x01, 0x01]
const noise = [0x00, 0x00, 0x00, 0x00, 0x00, 0xa5, 0xa5, 0xf5, 0xa5, 0xf5, 0xa5]
const off = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7f, 0x00, 0x00, 0x01, 0x01]
const dumpBytes = build([rec0, noise, off, off])
assert.equal(dumpBytes.length, 273)

// 1. Decode: container, checksum, records.
const d = decodeControllerDump(dumpBytes)
assert.ok(d && d.checksumOk && d.block === 0)
assert.equal(d.records.length, 11, '128 bytes = 11 whole records of 11 bytes')
assert.deepEqual({ type: d.records[0].type, channel: d.records[0].channel, parameter: d.records[0].parameter, min: d.records[0].minimum, max: d.records[0].maximum, plausible: d.records[0].plausible }, { type: 'cc', channel: 1, parameter: 10, min: 0, max: 127, plausible: true })
assert.equal(d.records[1].plausible, false, 'uninitialised memory is not an assignment')
assert.equal(d.records[2].type, 'off')
assert.equal(decodeControllerDump(build([rec0], 0, true)).checksumOk, false, 'checksum error detected')
assert.equal(decodeControllerDump(dumpBytes.slice(0, 272)), null, 'wrong length')
const notNibble = [...dumpBytes]; notNibble[20] = 0x10; assert.equal(decodeControllerDump(notNibble), null, 'payload must be nibbles')
assert.equal(isControllerDump([0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x40, 0x07, 0xf7]), false, 'brightness reply is not a dump')

// 2. Apply: only record 0 is known (encoder 1); trusted fields only.
assert.deepEqual(knownRecords, { 0: { kind: 'encoders', id: 1 } })
const e1 = applyRecord({ ...createEncoder(1), mode: 'rel2', ledMode: 'bar' }, d.records[0])
assert.deepEqual([e1.type, e1.channel, e1.parameter, e1.minimum, e1.maximum, e1.mode, e1.ledMode], ['cc', 1, 10, 0, 127, 'rel2', 'bar'], 'mode and LED ring untouched')
assert.deepEqual(applyRecord(createEncoder(1), d.records[1]), createEncoder(1), 'implausible record changes nothing')

// 3. Real capture, when available on this machine (never committed): same decode as the synthetic one.
const real = process.env.BCR32_CAPTURE
if (real && existsSync(real)) {
  const r = decodeControllerDump([...readFileSync(real)])
  assert.ok(r && r.checksumOk && r.records[0].parameter === 10, 'real capture: checksum OK, encoder 1 on CC 10')
}

// 3b. All-presets export: grouped by header identity; 8 valid blocks rebuild a preset of 1024 bytes = 93 records.
const full = [0, 1, 2, 3, 4, 5, 6, 7].map(b => decodeControllerDump(build(b === 0 ? [rec0, noise, off] : [off, off], b, false, 5)))
const partial = [0, 1, 2].map(b => decodeControllerDump(build([off], b, false, 6)))
const bad = decodeControllerDump(build([off], 3, true, 6))
const groups = groupExports([...full, ...partial, bad].reverse())
const g5 = groups.find(g => g.identity === '01 00 05'), g6 = groups.find(g => g.identity === '01 00 06')
assert.ok(g5.complete && g5.records.length === 93, 'complete preset: 93 records across the 8 blocks')
assert.equal(g5.records[0].parameter, 10, 'record 0 of the rebuilt preset = record 0 of block 0')
assert.equal(g5.records[1].plausible, false)
assert.deepEqual([g6.complete, g6.blocks], [false, [0, 1, 2]], 'incomplete preset; the corrupt block 3 is ignored')
assert.equal(d.identity, '01 00 00', 'identity = header bytes 8–10')

// 4. UI: waiting state, then the decoded table with Apply on the known record only.
const ui = dumps => renderToStaticMarkup(React.createElement(ExportImport, { dumps, apply() {}, save() {}, saveAll() {} }))
assert.ok(ui([]).includes('Waiting for an export…') && ui([]).includes('then encoder 7.') && ui([]).includes('then encoder 8.'), 'both export procedures shown')
const html = ui([d])
assert.equal((html.match(/<tr/g) ?? []).length, 12, 'header + 11 records')
assert.equal((html.match(/>Apply<\/button>/g) ?? []).length, 1, 'Apply only on the identified record')
assert.ok(html.includes('CC 10 · ch 1 · 0–127') && html.includes('checksum OK'))
assert.equal((ui([decodeControllerDump(build([rec0], 0, true))]).match(/>Apply<\/button>/g) ?? []).length, 0, 'never apply from a corrupt export')
const many = ui([...full].reverse())
assert.ok(many.includes('Save all exports (.syx)') && many.includes('1 complete (8 blocks)'), 'summary and save-all for an all-presets export')
assert.equal((many.match(/<option /g) ?? []).length, 8, 'every received block can be shown')
assert.equal((many.match(/>Apply<\/button>/g) ?? []).length, 0, 'block 7 shown first: no identified record, no Apply')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes('const dump = decodeControllerDump(data)') && app.includes('<ExportImport '), 'App listens for exports and shows them in Files')
console.log('PASS: front-panel export — all-presets grouping and 8-block rebuild, save all, both procedures, container, nibbles, checksum, 11-byte records, uninitialised records rejected, apply to encoder 1 only (trusted fields), corrupt export never applied, Files section' + (real ? ', real capture decoded' : ''))
