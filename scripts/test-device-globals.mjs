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
const { deviceGlobals, globalQuery, createGlobalsReader } = load('./device-globals')
const { catalog } = load('./i18n')

// 1. Exactly the official editor's 18 reads, in its order; never STORE or bootloader.
assert.deepEqual(deviceGlobals.map(g => g.cmd.toString(16)), ['74', '1b', '1c', '1e', '1d', '1f', '40', '30', '17', '18', '20', '21', '23', '24', '25', '26', '27', '28'])
assert.ok(deviceGlobals.every(g => g.cmd !== 0x72 && g.cmd !== 0x77))
assert.deepEqual(globalQuery(0x1f), [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x1f, 0xf7], 'short read, no value byte')

// 2. Reader against a simulated device answering like the BCR32 did on 2026-10-12 (and one echo, one silence).
const device = { 0x1f: 0, 0x40: 7, 0x30: 4, 0x18: 3, 0x27: 10 }
let now = 0, timers = []
const fake = { set: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t }, clear: t => { timers = timers.filter(x => x !== t) } }
const sent = []
let reader
const send = bytes => {
  sent.push(bytes)
  const cmd = bytes[6]
  if (cmd === 0x26) return // silence
  queueMicrotask(() => reader.receive(cmd === 0x25 ? bytes : [...bytes.slice(0, 7), device[cmd] ?? 0, 0xf7]))
}
reader = createGlobalsReader(send, 400, fake)
const tick = async () => { for (let i = 0; i < 50; i++) { await new Promise(r => setImmediate(r)); now += 50; for (const t of timers.filter(t => t.at <= now)) { timers = timers.filter(x => x !== t); t.fn() } } }
const done = reader.read(); await tick(); const results = await done
assert.equal(sent.length, 18, 'one request per global, sequential')
assert.ok(sent.every(b => b.length === 8 && b[6] !== 0x72 && b[6] !== 0x77), 'only short reads were sent')
const by = cmd => results.find(r => r.cmd === cmd)
assert.deepEqual([by(0x1f).value, by(0x1f).label, by(0x1f).status], [0, 'USB', 'value'], 'operating mode decoded')
assert.deepEqual([by(0x30).value, by(0x30).label], [4, 'USB'], 'controller output port decoded')
assert.deepEqual([by(0x40).value, by(0x40).status], [7, 'value'])
assert.equal(by(0x25).status, 'echo', 'an echo is reported as such, not as a value')
assert.equal(by(0x26).status, 'no reply', 'silence is reported after the timeout')
assert.equal(reader.receive([0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x1f, 0x02, 0xf7]), false, 'no stray reply accepted when nothing is pending')

// 3. UI: Config section, read button disabled without a BCR32, strings in the catalog.
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.match(html, /<button[^>]*disabled=""[^>]*>Read from the BCR32<\/button>/, 'read button disabled while no BCR32 is connected')
assert.ok(html.includes('Device settings'))
for (const k of ['Device settings', 'Read from the BCR32', 'Read-only: values reported by the BCR32, nothing is written.', ...deviceGlobals.map(g => g.name)]) assert.ok(catalog[k], 'catalog: ' + k)
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes('globalsReader.current?.receive(data)'), 'replies reach the reader')
console.log('PASS: device globals — the official editor\'s 18 short reads only, sequential, values decoded, echo and silence reported, read-only UI disabled without a BCR32, translated')
