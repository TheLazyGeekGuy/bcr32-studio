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
const { deviceGlobals, globalQuery, globalWrite, riskyGlobals, createGlobalsReader, settingsFromDevice, differingFields, valueOf, withValue, editableGlobals } = load('./device-globals')
const { DeviceSettings } = load('./DeviceSettings')
const { StudioConfig } = load('./StudioConfig')
const { createProfile, defaultSettings } = load('./profile')
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

// 2b. Labels from the official editor's BCR32 lists, matched by range (clock 3 = 24 PPQ, quantization 10 = "2").
assert.equal(by(0x18).label, '24 PPQ'); assert.equal(by(0x27).label, '2')
for (const g of deviceGlobals) if (g.choices) assert.ok(new Set(g.choices).size === g.choices.length || g.cmd === 0x1d, `no duplicate label in ${g.name}`)

// 2c. Read values become Config fields: the 2026-10-12 hardware values (operating mode 0, controller port 4).
const fields = settingsFromDevice(results)
assert.deepEqual(fields, { startupMode: 'ctrl', footswitchModes: ['ctrl', 'ctrl'], operationMode: 'usb', outputRouting: 'USB', thruSource: 'off', thruDestination: 'Off', thruFiltered: false,
  deviceValues: { '18': 3, '20': 0, '21': 0, '23': 0, '24': 0, '27': 10, '28': 0 } }, 'other settings kept by command; echo (25) and silence (26) left out')
const mixed = settingsFromDevice([{ cmd: 0x1f, value: 2, status: 'value' }, { cmd: 0x30, value: 5, status: 'value' }, { cmd: 0x1d, value: 2, status: 'value' }, { cmd: 0x1b, value: 1, status: 'value' }, { cmd: 0x1c, value: 0, status: 'value' }])
assert.deepEqual(mixed, { operationMode: 'mixed', outputRouting: 'USB & MIDI A', thruDestination: 'MIDI B', thruFiltered: true, footswitchModes: ['zaq', 'ctrl'] }, 'Oct 9 values, filtered thru, ZAQ footswitch')
assert.deepEqual(settingsFromDevice([{ cmd: 0x1f, value: null, status: 'echo' }]), {}, 'an echo never becomes a setting')
assert.deepEqual(differingFields({ ...defaultSettings(), operationMode: 'mixed' }, { operationMode: 'usb', outputRouting: 'USB' }), ['operationMode'])

// 2e. One value per setting, read and changed where Config keeps it: footswitch 2 alone, thru destination with its
// filter flag, clock rate in deviceValues; every editable setting round-trips through withValue/valueOf.
const base = { ...defaultSettings(), ...fields }
assert.deepEqual(withValue(0x1c, 1, base).footswitchModes, ['ctrl', 'zaq'])
const thru = withValue(0x1d, 2, base); assert.deepEqual([thru.thruDestination, thru.thruFiltered, valueOf(0x1d, thru)], ['MIDI B', true, 2])
assert.equal(withValue(0x18, 4, base).deviceValues['18'], 4)
for (const g of editableGlobals) for (const v of [0, Math.min(1, g.max), g.cmd === 0x1d ? 6 : g.max]) assert.equal(valueOf(g.cmd, withValue(g.cmd, v, base)), v, `${g.name} = ${v}`)
assert.equal(load('./device-globals').globalWritesEnabled, false, 'global writes disabled')
assert.deepEqual(deviceGlobals.filter(g => g.cmd === 0x1b || g.cmd === 0x1c).map(g => g.choices[1]), ['ZAQ · start/stop', 'ZAQ · next pattern'], 'footswitch ZAQ meanings from the manual')
assert.ok(!editableGlobals.some(g => g.cmd === 0x40 || g.cmd === 0x74), 'brightness and bootloader status are not edited here')

// 2f. The table: one choice list per editable setting, the device column, a marker on a changed value.
const table = props => renderToStaticMarkup(React.createElement(DeviceSettings, { results, settings: base, change() {}, autoLoad: true, setAutoLoad() {}, canRead: true, busy: false, read() {}, reset() {}, ...props }))
const t1 = table({})
assert.equal((t1.match(/<select /g) ?? []).length, editableGlobals.length, 'one select per editable setting')
assert.match(t1, /<option value="3" selected="">24 PPQ<\/option>/, 'clock rate shows the value read, labelled')
assert.equal((t1.match(/class="device-row-differs"/g) ?? []).length, 0, 'nothing differs right after a read')
assert.equal((table({ settings: withValue(0x1f, 2, base) }).match(/class="device-row-differs"/g) ?? []).length, 1, 'a changed operating mode is marked')
assert.ok(!table({ results: null }).includes('device-row-differs') && table({ results: null }).includes('<select'), 'choices available before any read, nothing marked')
const order = t1.indexOf('Read from the BCR32') < t1.indexOf('<table'); assert.ok(order, 'buttons above the table')
const changed = withValue(0x18, 4, withValue(0x1f, 2, base))
const t2 = table({ settings: changed })
assert.ok(!t2.includes('device-write"') && !t2.includes('Write all changes'), 'no write button anywhere while writes are disabled')
assert.ok(t2.includes('Writing to the BCR32 is disabled: it froze the controller.'), 'the reason is shown')
assert.equal((t2.match(/class="device-row-differs"/g) ?? []).length, 2, 'differences still marked')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
assert.match(css, /\.profile-actions > \.device-globals\s*\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\)/, 'stacked vertically, overriding the generic Config row layout')

// 2d. Config shows the read time and marks a field edited after the read.
const profile = { ...createProfile(), settings: { ...defaultSettings(), operationMode: 'mixed' } }
const cfg = renderToStaticMarkup(React.createElement(StudioConfig, { profile, update() {}, select() {}, brightness: 7, draft: 7, setDraft() {}, brightnessEnabled: true, brightnessStatus: '', deviceSnapshot: { at: '19:42', settings: { operationMode: 'usb', outputRouting: 'USB' } } }))
assert.ok(cfg.includes('ZAQ · start/stop') && cfg.includes('ZAQ · next pattern'), 'Config footswitch choices say what ZAQ does')
assert.ok(cfg.includes('Read from the BCR32 at 19:42.'), 'read time shown')
assert.equal((cfg.match(/class="device-differs"/g) ?? []).length, 1, 'only the edited field is marked')
assert.ok(!renderToStaticMarkup(React.createElement(StudioConfig, { profile, update() {}, select() {}, brightness: 7, draft: 7, setDraft() {}, brightnessEnabled: true, brightnessStatus: '' })).includes('device-differs'), 'no marker without a read')

// 2g. Writes: the hardware-verified layout, guarded; a write is acknowledged, then read back.
assert.deepEqual(globalWrite(0x18, 4), [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x18, 0x04, 0xf7], 'Clock rate out = 48 PPQ, as verified on 2026-10-13')
for (const [cmd, v] of [[0x18, 5], [0x18, -1], [0x18, 1.5], [0x74, 0], [0x72, 0], [0x77, 0], [0x99, 0]]) assert.throws(() => globalWrite(cmd, v), `refused: ${cmd.toString(16)}=${v}`)
assert.deepEqual([...riskyGlobals].sort(), [0x1f, 0x30], 'operating mode and controller output need a confirmation')
{
  // Writes are disabled since they froze the owner's BCR32 (2026-10-13): nothing may be sent, whatever the value.
  const out = []
  const w = createGlobalsReader(bytes => out.push(bytes), 400, fake)
  await assert.rejects(w.write(0x18, 3), /disabled/, 'write refused while disabled')
  assert.equal(out.length, 0, 'no byte sent')
}

// 3. UI: Config section, read button disabled without a BCR32, strings in the catalog.
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.match(html, /<button[^>]*disabled=""[^>]*>Read from the BCR32<\/button>/, 'read button disabled while no BCR32 is connected')
assert.ok(html.includes('Device settings'))
assert.match(html, /<input type="checkbox" checked=""[^>]*\/>Load the settings from the BCR32 at connection/, 'automatic load on by default')
assert.ok(!html.includes('Reset to editor defaults'), 'reset offered only when automatic load is off')
for (const k of ['Load the settings from the BCR32 at connection', 'Reset to editor defaults', 'Read from the BCR32 at {detail}.', 'Differs from the value read on the BCR32', 'Device settings', 'Read from the BCR32', 'Values read from the BCR32 and chosen here. Write sends a changed value to the BCR32, then reads it back.', 'Values read from the BCR32 and chosen here. Writing to the BCR32 is disabled: it froze the controller.', ...deviceGlobals.map(g => g.name)]) assert.ok(catalog[k], 'catalog: ' + k)
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes('globalsReader.current?.receive(data)'), 'replies reach the reader')
assert.ok(app.includes('if (autoLoadRef.current) void loadDeviceSettings(reader)') && app.includes('settingsFromDevice(results)'), 'read at connection and applied to Config')
console.log('PASS: device globals — writes DISABLED (froze the BCR32): nothing sent, no write button, reason shown; editable choice lists linked to Config (round trip for every setting), device column and change markers, official labels, read values mapped to Config fields with edit markers, automatic load at connection (default on), the official editor\'s 18 short reads only, sequential, values decoded, echo and silence reported, read-only UI disabled without a BCR32, translated')
