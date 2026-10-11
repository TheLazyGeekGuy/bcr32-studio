import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
const transpile = name => ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const require = createRequire(import.meta.url)
const web = {}
new Function('require', 'exports', transpile('web-midi.ts'))(require, web)
const { parseFirmwareReply, productQuery, isSystemRealtime } = web
// Only observed sample: ControlTribe displays it as v0.56.0.
const observed = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0x01, 0x00, 0x00, 0x00, 0x38, 0x00, 0xf7]
assert.equal(parseFirmwareReply(observed), '0.56.0')
assert.equal(parseFirmwareReply(Uint8Array.from(observed)), '0.56.0', 'Accepts the Web MIDI Uint8Array')
assert.equal(parseFirmwareReply([0xf0, 0x00, 0x21, 0x32, 0x7f, 0x64, 0x00, 0x01, 0x00, 0x00, 0x00, 0x38, 0x00, 0xf7]), null, 'Wrong manufacturer header')
assert.equal(parseFirmwareReply([0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x01, 0x01, 0x00, 0x00, 0x00, 0x38, 0x00, 0xf7]), null, 'Wrong command byte')
assert.equal(parseFirmwareReply(observed.slice(0, 13)), null, 'Short message')
assert.equal(parseFirmwareReply(productQuery), null, 'The query itself is not a reply')
assert.equal(parseFirmwareReply([0xb0, 0x10, 0x7b]), null, 'Non-SysEx')
assert.equal(parseFirmwareReply([0xf8]), null, 'Clock')
assert.equal(parseFirmwareReply([]), null)
assert.equal(parseFirmwareReply([0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x38, 0x00, 0xf7]), null, 'Payload must start with 01')
assert.equal(parseFirmwareReply([0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0x01, 0x01, 0x00, 0x00, 0x02, 0x03, 0xf7]), '1.2.3', 'Same layout, other bytes')
// App.tsx skips the activity pulse and the log line for these (no App render per clock tick).
for (const frame of [[0xf8], [0xfa], [0xfb], [0xfc], [0xfe], [0xff]]) assert.ok(isSystemRealtime(frame), 'Realtime: ' + frame[0].toString(16))
for (const frame of [[], [0xb0, 0x10, 0x40], [0x90, 60, 100], observed, productQuery, [0xf8, 0xf8], [0xf7], [0xf0]]) assert.ok(!isSystemRealtime(frame), 'Not realtime: ' + frame.join(' '))
console.log('PASS: observed BCR-32 product reply decodes to 0.56.0; header, command, length and non-SysEx frames rejected; realtime bytes identified')
