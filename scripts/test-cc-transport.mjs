import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const transpile = name => ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const require = createRequire(import.meta.url)
const transport = {}
const panel = {}
const localRequire = name => { if (name.endsWith('.json')) return JSON.parse(readFileSync(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url), 'utf8'));
  if (!name.startsWith('./')) return require(name)
  const exports = {}
  new Function('require', 'exports', transpile(name.slice(2) + (['./ActivityLeds', './OledDisplay', './i18n', './Icon'].includes(name) ? '.tsx' : '.ts')))(localRequire, exports)
  return exports
}
new Function('require', 'exports', transpile('cc-transport.ts'))(localRequire, transport)
const { encoderCC, isBcrOutput, createCcSender } = transport
new Function('require', 'exports', transpile('FrontPanel.tsx'))(localRequire, panel)
const encoder = { id: 1, type: 'cc', mode: 'absolute', channel: 1, parameter: 16, minimum: 0, maximum: 127 }
assert.deepEqual(encoderCC(encoder, 123), [0xb0, 0x10, 0x7b])
assert.deepEqual(encoderCC({ ...encoder, channel: 16 }, 200), [0xbf, 0x10, 127])
assert.deepEqual(encoderCC({ ...encoder, minimum: 20, maximum: 80 }, -10), [0xb0, 0x10, 20])
for (const change of [{ type: 'off' }, { mode: 'rel1' }, { parameter: 128 }, { channel: 0 }]) assert.equal(encoderCC({ ...encoder, ...change }, 10), null)
assert.equal(encoderCC(encoder, NaN), null)
const profile = { encoders: [encoder] }
assert.deepEqual(panel.receiveCC(profile, {}, [0xb0, 0x10, 0x7b]), { 1: { value: 123, source: 'midi' } })
assert.deepEqual(panel.receiveCC(profile, {}, [0xb1, 0x10, 0x7b]), {})
assert.deepEqual(panel.receiveCC(profile, {}, [0xb0, 0x11, 0x7b]), {})
assert.equal(isBcrOutput({ name: 'Behringer BCR-32', state: 'connected', send() {} }), true)
assert.equal(isBcrOutput({ name: 'Other instrument', state: 'connected', send() {} }), false)
assert.equal(isBcrOutput({ name: 'Behringer BCR-32', state: 'disconnected', send() {} }), false)
const wait = () => new Promise(r => setTimeout(r, 25))
const writes = [], logs = [], errors = []
const sender = createCcSender(b => writes.push(b), b => logs.push(b), e => errors.push(e), 5)
for (let i = 0; i <= 127; i++) sender.enqueue(encoderCC(encoder, i))
await wait()
assert.deepEqual(writes, [[0xb0, 16, 127]])
assert.deepEqual(logs, writes)
sender.enqueue([0xf0, 1, 0xf7]); sender.enqueue([0xb0, 16, 128])
await wait(); assert.equal(writes.length, 1)
sender.enqueue([0xb0, 16, 64]); sender.close(); await wait(); assert.equal(writes.length, 1)
const failing = createCcSender(() => { throw new Error('disconnected') }, () => assert.fail('not sent'), e => errors.push(e), 5)
failing.enqueue([0xb0, 16, 20]); await wait(); assert.equal(errors.length, 1)
failing.enqueue([0xb0, 16, 21]); await wait(); assert.equal(errors.length, 1)
failing.close()
// UI state update from incoming MIDI is not a local gesture and does not enqueue.
const received = panel.receiveCC(profile, {}, [0xb0, 16, 99])
assert.equal(received[1].value, 99)
assert.equal(writes.length, 1)
let echoed = {}, echoCount = 0
const echoedSender = createCcSender(bytes => { echoCount++; echoed = panel.receiveCC(profile, echoed, bytes) }, () => {}, assert.fail, 5)
echoedSender.enqueue(encoderCC(encoder, 64)); await wait(); await wait()
assert.equal(echoed[1].value, 64)
assert.equal(echoCount, 1)
echoedSender.close()
const web = {}
new Function('require', 'exports', transpile('web-midi.ts'))(localRequire, web)
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const requested = []
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: async options => { requested.push(options); return { sysexEnabled: options.sysex } } } })
try {
  await web.requestMidiAccess()
  await web.requestSysexAccess()
  assert.deepEqual(requested, [{ sysex: false }, { sysex: true }])
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globalThis.navigator
}
console.log('PASS: Enc1 CC16 ↔ B0 10 value; channel, range and mode guards; rate coalescing; final value; no SysEx; cancellation/errors; receive path separate from sender')
console.log('PASS: echoed CC updates UI without retransmission; normal MIDI permission separate from SysEx')
