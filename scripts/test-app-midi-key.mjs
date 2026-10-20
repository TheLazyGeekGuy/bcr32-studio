import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) { if (name.endsWith('.json')) return JSON.parse(readFileSync(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url), 'utf8'));
  if (!name.startsWith('./')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name.slice(2)}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}; cache.set(name, exports); new Function('require', 'exports', code)(load, exports); return exports
}
const { createProfile } = load('./profile')
const { decoderKey } = load('./controller-midi')
const base = createProfile()
const key = decoderKey(base)
assert.equal(typeof key, 'string')
assert.equal(decoderKey(JSON.parse(JSON.stringify(base))), key, 'Key depends on content, not identity')
// Edits that must NOT recreate the decoder (App.tsx receive effect depends on this key).
const cosmetic = [
  p => ({ ...p, device: { ...p.device, firmwareObserved: '0.56.0' } }),
  p => ({ ...p, encoders: p.encoders.map(e => ({ ...e, ledMode: 'dot' })) }),
  p => ({ ...p, encoders: p.encoders.map(e => ({ ...e, display: false })) }),
  p => ({ ...p, buttons: p.buttons.map(e => ({ ...e, increment: 5 })) }),
  p => ({ ...p, buttons: p.buttons.map(e => ({ ...e, minimumOff: true, aftertouchAll: true })) }),
  p => ({ ...p, buttons: p.buttons.map(e => ({ ...e, mmc: { deviceId: 'all', command: 'Play', locate: [0, 0, 0, 0], frameRate: 'off' } })) }),
  p => ({ ...p, settings: { ...p.settings, deviceId: 7, footswitchModes: ['zaq', 'ctrl'] } }),
]
for (const edit of cosmetic) assert.equal(decoderKey(edit(base)), key, 'Cosmetic edit changed the decoder key')
// Edits that MUST recreate the decoder.
const midi = [
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, type: 'cc' } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, channel: 2 } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, parameter: 16 } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, mode: 'rel2' } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, minimum: 1 } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, maximum: 100 } : e) }),
  p => ({ ...p, encoders: p.encoders.map((e, i) => i === 0 ? { ...e, parameterOff: true } : e) }),
  p => ({ ...p, pushes: p.pushes.map((e, i) => i === 3 ? { ...e, mode: 'toggle' } : e) }),
  p => ({ ...p, buttons: p.buttons.map((e, i) => i === 25 ? { ...e, type: 'note' } : e) }),
]
for (const edit of midi) assert.notEqual(decoderKey(edit(base)), key, 'MIDI-relevant edit left the decoder key unchanged')
assert.equal(base.device.firmwareObserved, null, 'Firmware version comes from the device reply (test-firmware-reply), never from a default')
// The App's receive effect must depend on the key, not on the whole profile. Effect dependency lists are
// not observable without a DOM renderer, so this remains a source-level guard.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes('}, [inputId, inputs, midiKey])'), 'Receive effect keyed on MIDI-relevant fields only')
assert.ok(app.includes('}, [sendCC, output])'), 'CC sender effect must not depend on profile')
console.log('PASS: decoder key ignores labels/LED/display/MMC/settings/firmware, changes on type/channel/parameter/mode/range/parameterOff; App effects keyed accordingly')
