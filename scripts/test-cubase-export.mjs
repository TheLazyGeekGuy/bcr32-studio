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
const { cubaseMidiRemoteScript, cubaseFileName, cubaseFolder } = load('./cubase-export')
const { createProfile } = load('./profile')
const { emptyLabels } = load('./presets')
const { catalog, translate } = load('./i18n')

// --- Profile covering every branch of the generator. ---
const profile = createProfile(), labels = emptyLabels()
const set = (kind, id, patch) => { const list = profile[kind], i = list.findIndex(e => e.id === id); list[i] = { ...list[i], ...patch } }
set('encoders', 1, { type: 'cc', channel: 1, parameter: 16, mode: 'absolute' })
set('encoders', 2, { type: 'cc', channel: 2, parameter: 20, mode: 'rel2' })
set('encoders', 3, { type: 'cc', channel: 3, parameter: 7, mode: 'abs_14', minimum: 0, maximum: 16383 })
set('encoders', 4, { type: 'cc', channel: 1, parameter: 40, mode: 'abs_14', minimum: 0, maximum: 16383 })
set('encoders', 5, { type: 'nrpn', channel: 1, parameter: 300, mode: 'absolute', minimum: 0, maximum: 1000 })
set('encoders', 6, { type: 'pc', channel: 1, parameter: 0, mode: 'absolute' })
set('encoders', 7, { type: 'cc', channel: 1, parameter: 21, mode: 'rel1', minimum: 127, maximum: 1 })
set('encoders', 8, { type: 'cc', channel: 1, parameter: 22, mode: 'rel1', minimum: 0, maximum: 127 })
set('encoders', 9, { type: 'cc', channel: 1, parameter: 23, mode: 'rel3' })
set('encoders', 10, { type: 'pb', channel: 4, parameter: 0, mode: 'absolute' })
set('encoders', 11, { type: 'cc', channel: 16, parameter: 24, mode: 'absolute', parameterOff: true })
set('encoders', 12, { type: 'nrpn', channel: 1, parameter: 301, mode: 'inc_dec' })
set('pushes', 1, { type: 'cc', channel: 1, parameter: 64, mode: 'toggle' })
set('buttons', 5, { type: 'note', channel: 10, parameter: 36, mode: 'toggle' })
set('buttons', 6, { type: 'at', channel: 1, parameter: 0, mode: 'momentary', aftertouchAll: true })
set('buttons', 7, { type: 'at', channel: 1, parameter: 60, mode: 'momentary' })
set('buttons', 8, { type: 'cc', channel: 1, parameter: 80, mode: 'momentary', minimum: 0, maximum: 100 })
labels.encoders[0] = 'Cutoff */ evil\nline'
const result = cubaseMidiRemoteScript(profile, labels, { studioVersion: '9.9.9', date: '2026-10-11' })
const src = result.source

// --- Script shape: the Cubase engine is ES5; nothing that could break out of a comment. ---
assert.equal(result.fileName, 'Behringer_BCR32.js'); assert.equal(cubaseFileName, result.fileName)
assert.equal(result.folder, 'Driver Scripts/Local/Behringer/BCR32'); assert.equal(cubaseFolder, result.folder)
assert.ok(!/\b(let|const|class)\s|=>|`/.test(src), 'ES5 only: no let/const/class, arrow functions or template literals')
assert.ok(!src.includes('*/') && !src.includes('evil\nline'), 'labels sanitized: no comment terminator, no raw newline')
assert.ok(src.includes('Encoder 1 (Cutoff * / evil line): CC 16 · channel 1'), 'custom label in the comment')
assert.ok(src.includes('MIDI Studio 9.9.9') && src.includes('2026-10-11'), 'header: version and date')

// --- Execute the script against a mock of midiremote_api_v1 that only knows the methods of the official reference. ---
const calls = [], allowed = new Set(['makeDeviceDriver', 'makeMidiInput', 'makeMidiOutput', 'makeDetectionUnit', 'detectPortPair', 'expectInputNameContains', 'expectOutputNameContains',
  'makePushEncoder', 'makeButton', 'setTypeToggle', 'setTypePush', 'setInputPort', 'setOutputPort', 'bindToControlChange', 'bindToControlChange14Bit', 'bindToControlChange14BitNRPN',
  'bindToNote', 'bindToPitchBend', 'bindToChannelPressure', 'setValueRange', 'setTypeAbsolute', 'setTypeRelativeBinaryOffset', 'setTypeRelativeSignedBit', 'setTypeRelativeTwosComplement', 'makePage'])
const properties = new Set(['mPorts', 'mSurface', 'mMapping', 'mEncoderValue', 'mPushValue', 'mSurfaceValue', 'mMidiBinding'])
function node(path) {
  return new Proxy(function () {}, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined
      if (properties.has(prop)) return node(`${path}.${prop}`)
      if (!allowed.has(prop)) throw new Error(`API method not in the reference: ${path}.${prop}`)
      return (...args) => { calls.push({ path, method: prop, args }); return node(`${path}.${prop}(${args.map(x => typeof x === 'function' ? '<ref>' : x).join(',')})`) }
    },
  })
}
let required = null
new Function('require', src)(name => { required = name; return node('api') })
assert.equal(required, 'midiremote_api_v1')
const find = method => calls.filter(c => c.method === method)
assert.deepEqual(find('makeDeviceDriver')[0].args, ['Behringer', 'BCR32', 'MIDI Studio'])
assert.deepEqual(find('expectInputNameContains').map(c => c.args[0]), ['BCR32', 'BCR-32', 'BCR 32'], 'one detection unit per port spelling')
assert.equal(find('makePushEncoder').length, 32, '32 push encoders'); assert.equal(find('makeButton').length, profile.buttons.length, 'every programmable key')
assert.equal(find('makePage').length, 1, 'one (empty) mapping page'); assert.ok(!src.includes('makeValueBinding'), 'no Cubase function mapped: the Mapping Assistant does it')
// Binding chains, read from the source (one statement per bound control).
const chain = target => src.split('\n').find(l => l.startsWith(`${target}.mMidiBinding`))
assert.equal(chain('encoder1.mEncoderValue'), 'encoder1.mEncoderValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, 16)', 'absolute CC, channel 0-based, ring feedback')
assert.equal(chain('encoder2.mEncoderValue'), 'encoder2.mEncoderValue.mMidiBinding.setInputPort(midiInput).bindToControlChange(1, 20).setTypeRelativeBinaryOffset()', 'REL2 = binary offset, no feedback to a relative encoder')
assert.equal(chain('encoder3.mEncoderValue'), 'encoder3.mEncoderValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange14Bit(2, 7)', '14-bit CC')
assert.equal(chain('encoder4.mEncoderValue'), undefined, '14-bit CC above 31 not bound')
assert.equal(chain('encoder5.mEncoderValue'), 'encoder5.mEncoderValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange14BitNRPN(0, 300).setValueRange(0, 1000)', 'NRPN with its range')
assert.equal(chain('encoder6.mEncoderValue'), undefined, 'Program Change not bound')
assert.equal(chain('encoder7.mEncoderValue'), 'encoder7.mEncoderValue.mMidiBinding.setInputPort(midiInput).bindToControlChange(0, 21).setTypeRelativeTwosComplement()', 'REL1 127/1 = two\'s complement')
assert.equal(chain('encoder8.mEncoderValue'), undefined, 'REL1 0/127 is no Cubase relative encoding')
assert.equal(chain('encoder9.mEncoderValue'), 'encoder9.mEncoderValue.mMidiBinding.setInputPort(midiInput).bindToControlChange(0, 23).setTypeRelativeSignedBit()', 'REL3 = signed bit')
assert.equal(chain('encoder10.mEncoderValue'), 'encoder10.mEncoderValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToPitchBend(3)')
assert.equal(chain('encoder11.mEncoderValue'), undefined, 'Parameter Off sends nothing'); assert.equal(chain('encoder12.mEncoderValue'), undefined, 'NRPN INC/DEC not bound')
assert.equal(chain('encoder1.mPushValue'), 'encoder1.mPushValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, 64)', 'push of encoder 1')
assert.equal(chain('button5.mSurfaceValue'), 'button5.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToNote(9, 36)')
assert.ok(src.includes('button5.setTypeToggle()'), 'latching key = toggle button'); assert.ok(!src.includes('button8.setTypeToggle()'), 'momentary key stays push')
assert.equal(chain('button6.mSurfaceValue'), 'button6.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToChannelPressure(0)', 'Aftertouch All = channel pressure')
assert.equal(chain('button7.mSurfaceValue'), undefined, 'polyphonic aftertouch not bound')
assert.equal(chain('button8.mSurfaceValue'), 'button8.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, 80).setValueRange(0, 100)', 'momentary CC with its range')
assert.equal(chain('encoder13.mEncoderValue'), undefined, 'unassigned controls get a surface element, no binding')
// Report returned to the UI: every bound and skipped control, the direction warnings.
assert.equal(result.bound.length, 11, 'bound: ' + result.bound.map(b => b.control).join(', '))
assert.deepEqual(result.skipped.map(s => s.control.split(' (')[0]).sort(), ['Button 7', 'Encoder 11', 'Encoder 12', 'Encoder 4', 'Encoder 6', 'Encoder 8'].sort())
assert.ok(result.bound.find(b => b.id === 9 && b.kind === 'encoders').verify.includes('direction'), 'REL3 flagged: direction to check')
assert.ok(src.includes('Bindings: 11. Not bound: 6.'))
// Surface geometry follows the front panel: row 2 below row 1, encoder 8 right of encoder 1.
const pos = id => find('makePushEncoder')[id - 1].args
assert.ok(pos(9)[1] > pos(1)[1] && pos(8)[0] > pos(1)[0], 'encoder grid follows the panel')

// --- UI: Files tab button and catalog rows. ---
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(html.includes('Export Cubase script'), 'Files tab renders the Cubase export button')
assert.ok(html.includes('Driver Scripts/Local/Behringer/BCR32'), 'install folder shown')
for (const key of ['Cubase · MIDI Remote', 'Export Cubase script']) assert.ok(catalog[key], 'catalog: ' + key)
assert.equal(translate('Cubase script exported: 11 bindings; not bound: 6.', 'fr'), 'Script Cubase exporté : 11 liaisons ; non liés : 6.')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes("download(result.source, result.fileName, 'text/javascript')"), 'App downloads the generated script')
const generator = readFileSync(new URL('../src/cubase-export.ts', import.meta.url), 'utf8')
assert.ok(!/\.(send|enqueue\w*)\s*\(/.test(generator), 'cubase-export: no MIDI output')
console.log('PASS: Cubase MIDI Remote export — ES5 script run against a reference-only API mock, exact bindings (CC 7/14-bit, relative types, NRPN, note, pitch bend, channel pressure, ranges, toggle keys), unsupported modes skipped with reasons, empty mapping page, Files tab button and catalog')
