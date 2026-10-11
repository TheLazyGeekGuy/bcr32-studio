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
const { createLearnParser, applyLearn, describeLearn, describeApplied, createLearnSession } = load('./midi-learn')
const { createProfile, createEncoder, parseProfile } = load('./profile')
const { applySelectionChange } = load('./multi-selection')
const { catalog, translate } = load('./i18n')

// --- Parser ---
let parse = createLearnParser()
const cc = (ch, n, v) => [0xb0 | (ch - 1), n, v]
// Lone CC: 0-31 is a possible MSB (pending), 32-127 is final.
assert.deepEqual(parse(cc(1, 16, 64)), { type: 'cc', channel: 1, parameter: 16, fourteenBit: false, value: 64, pending: true })
assert.deepEqual(parse(cc(3, 74, 5)), { type: 'cc', channel: 3, parameter: 74, fourteenBit: false, value: 5, pending: false })
// 14-bit CC pair: n then n+32 on the same channel.
parse = createLearnParser()
assert.equal(parse(cc(2, 16, 1)).pending, true)
assert.deepEqual(parse(cc(2, 48, 2)), { type: 'cc', channel: 2, parameter: 16, fourteenBit: true, value: 130, pending: false })
assert.equal(parse(cc(2, 48, 2)).fourteenBit, false, 'LSB without a preceding MSB is a lone CC 48')
parse(cc(2, 16, 1)); assert.equal(parse(cc(5, 48, 2)).fourteenBit, false, 'pair must share the channel')
parse(cc(2, 16, 1)); parse(cc(2, 17, 1)); assert.equal(parse(cc(2, 48, 2)).fourteenBit, false, 'LSB must immediately follow its MSB')
parse(cc(2, 16, 1)); parse([0x90 | 1, 60, 100]); assert.equal(parse(cc(2, 48, 2)).fourteenBit, false, 'another channel message breaks the pair')
parse(cc(2, 16, 1)); assert.equal(parse([0xf8]), null); assert.equal(parse(cc(2, 48, 2)).fourteenBit, true, 'realtime does not break the pair')
// NRPN 7-bit, then 14-bit with CC 38.
parse = createLearnParser()
assert.equal(parse(cc(1, 99, 8)), null); assert.equal(parse(cc(1, 98, 1)), null)
assert.deepEqual(parse(cc(1, 6, 100)), { type: 'nrpn', channel: 1, parameter: 1025, fourteenBit: false, value: 100, pending: true })
assert.deepEqual(parse(cc(1, 38, 3)), { type: 'nrpn', channel: 1, parameter: 1025, fourteenBit: true, value: 12803, pending: false })
assert.equal(parse(cc(1, 38, 3)), null, 'CC 38 without a fresh CC 6 gives nothing')
assert.equal(parse(cc(1, 96, 1)).incDec, true); assert.equal(parse(cc(1, 97, 1)).parameter, 1025)
assert.equal(parse(cc(2, 6, 100)).type, 'cc', 'selector is per channel: CC 6 on channel 2 is a plain CC')
parse(cc(1, 101, 0)); assert.equal(parse(cc(1, 6, 100)).type, 'cc', 'RPN resets the NRPN selector: CC 6 becomes a plain CC')
parse(cc(1, 99, 8)); parse(cc(1, 98, 1)); parse(cc(1, 100, 0)); assert.equal(parse(cc(1, 6, 1)).type, 'cc')
parse(cc(1, 99, 127)); parse(cc(1, 98, 127)); assert.equal(parse(cc(1, 6, 1)), null, 'null selector 16383 is not learnable')
parse = createLearnParser(); assert.equal(parse(cc(1, 6, 7)).type, 'cc'); assert.deepEqual(parse(cc(1, 38, 1)), { type: 'cc', channel: 1, parameter: 6, fourteenBit: true, value: 897, pending: false }, 'CC 6/38 without selector form a plain 14-bit CC pair')
// Same selector rule as createMidiDecoder (controller-midi.ts): both address bytes must be fresh; a lone CC 98 after a complete address starts a new one.
parse = createLearnParser(); parse(cc(1, 99, 8)); parse(cc(1, 98, 1)); parse(cc(1, 98, 2)); assert.equal(parse(cc(1, 6, 5)).type, 'cc', 'stale MSB does not form NRPN 1026')
parse(cc(1, 99, 8)); assert.equal(parse(cc(1, 6, 5)).parameter, 1026, 'fresh MSB completes the new address with the fresh LSB')
parse = createLearnParser(); parse(cc(1, 98, 1)); parse(cc(1, 99, 8)); assert.equal(parse(cc(1, 6, 5)).parameter, 1025, 'selector bytes in either order')
// Note on/off, PC, channel and poly aftertouch, pitch bend, channel extraction.
parse = createLearnParser()
assert.deepEqual(parse([0x95, 60, 100]), { type: 'note', channel: 6, parameter: 60, fourteenBit: false, value: 100, pending: false })
assert.deepEqual(parse([0x85, 60, 64]), { type: 'note', channel: 6, parameter: 60, fourteenBit: false, value: 0, pending: false })
assert.deepEqual(parse([0xcf, 5]), { type: 'pc', channel: 16, fourteenBit: false, value: 5, pending: false }, 'a Program Change carries no bank: no parameter')
assert.deepEqual(parse([0xd0, 77]), { type: 'at', channel: 1, aftertouchAll: true, fourteenBit: false, value: 77, pending: false })
assert.deepEqual(parse([0xa1, 62, 9]), { type: 'at', channel: 2, parameter: 62, fourteenBit: false, value: 9, pending: false })
assert.deepEqual(parse([0xe2, 0, 64]), { type: 'pb', channel: 3, fourteenBit: false, value: 8192, pending: false })
// Ignored: SysEx, realtime, system common, malformed frames.
for (const data of [[0xf0, 0, 0x20, 0x32, 0x7f, 0x64, 0, 0xf7], [0xf8], [0xfe], [0xf2, 0, 0], [], [0xb0, 16], [0xb0, 16, 128], [0xc0, 1, 1], [0x90, 60], [16, 1, 1]]) assert.equal(parse(data), null, JSON.stringify(data))

// --- applyLearn ---
const rotation = createEncoder(3), button = { ...createEncoder(5), mode: 'momentary' }
const learned = (type, extra = {}) => ({ type, channel: 4, fourteenBit: false, value: 1, pending: false, ...extra })
assert.deepEqual(applyLearn(rotation, 'encoders', learned('cc', { parameter: 7 })), { type: 'cc', channel: 4, mode: 'absolute', parameter: 7 })
assert.deepEqual(applyLearn(rotation, 'encoders', learned('cc', { parameter: 7, fourteenBit: true })), { type: 'cc', channel: 4, mode: 'abs_14', parameter: 7, maximum: 16383 }, 'CC 14 bits: ABS_14 and the default range widens')
assert.deepEqual(applyLearn({ ...rotation, minimum: 10, maximum: 100 }, 'encoders', learned('cc', { parameter: 7, fourteenBit: true })).maximum, undefined, 'a custom range is left alone')
assert.deepEqual(applyLearn({ ...rotation, mode: 'r2_14', maximum: 16383 }, 'encoders', learned('cc', { parameter: 7, fourteenBit: true })).mode, 'r2_14', 'an existing 14-bit relative mode survives a 14-bit pair')
assert.deepEqual(applyLearn({ ...rotation, type: 'cc', mode: 'abs_14', minimum: 0, maximum: 16383 }, 'encoders', learned('cc', { parameter: 7 })), { type: 'cc', channel: 4, mode: 'absolute', parameter: 7, minimum: 0, maximum: 127 }, '7-bit CC leaves 14 bits: range clamped to 127')
assert.deepEqual(applyLearn({ ...rotation, type: 'cc', mode: 'rel2' }, 'encoders', learned('nrpn', { parameter: 1025 })).mode, 'rel2', 'compatible mode kept across a type change')
assert.deepEqual(applyLearn({ ...rotation, type: 'cc', mode: 'rel2' }, 'encoders', learned('pb')), { type: 'pb', channel: 4, mode: 'absolute' }, 'PB on a rotation: absolute only, no parameter')
assert.equal(applyLearn(rotation, 'encoders', learned('nrpn', { parameter: 1025, fourteenBit: true })).mode, 'abs_14')
assert.equal(applyLearn(rotation, 'encoders', learned('nrpn', { parameter: 1025, incDec: true })).mode, 'inc_dec')
assert.equal(applyLearn({ ...rotation, type: 'nrpn', mode: 'inc_dec' }, 'encoders', learned('nrpn', { parameter: 1025 })).mode, 'absolute', 'CC 6 data entry is not INC/DEC: leaves inc_dec')
assert.equal(applyLearn({ ...rotation, type: 'nrpn', mode: 'rel2' }, 'encoders', learned('nrpn', { parameter: 1025 })).mode, 'rel2', 'relative modes survive a 7-bit NRPN')
assert.equal(applyLearn(rotation, 'encoders', learned('nrpn', { parameter: 16382 })).parameter, 16382, 'NRPN up to parameterLimit on a rotation')
assert.deepEqual(applyLearn(rotation, 'encoders', learned('nrpn', { parameter: 20000 })), { error: 'Message NRPN 20000 out of range (max 16383) for this control.' }, 'over the limit: refused, not clamped')
assert.deepEqual(applyLearn(button, 'buttons', learned('nrpn', { parameter: 1025 })), { error: 'Message NRPN 1025 out of range (max 127) for this control.' }, 'buttons have the inspector limit of 127: refused, not clamped')
assert.equal(applyLearn(button, 'buttons', learned('nrpn', { parameter: 127 })).parameter, 127)
assert.deepEqual(applyLearn(rotation, 'encoders', learned('note', { parameter: 60 })), { error: 'Message Note 60 cannot be applied to this control.' })
assert.deepEqual(applyLearn(button, 'buttons', learned('pb')), { error: 'Message PB cannot be applied to this control.' })
assert.deepEqual(applyLearn(button, 'buttons', learned('note', { parameter: 60, value: 100 })), { type: 'note', channel: 4, mode: 'momentary', parameter: 60 })
assert.equal(applyLearn({ ...button, mode: 'toggle' }, 'pushes', learned('cc', { parameter: 7, fourteenBit: true })).mode, 'toggle', 'buttons keep their mode, no 14-bit mode')
assert.deepEqual(applyLearn({ ...button, mode: 'toggle' }, 'buttons', learned('pc', { value: 2 })), { type: 'pc', channel: 4, mode: 'momentary' }, 'PC has no toggle: first compatible mode; the bank is left alone')
assert.deepEqual(applyLearn(button, 'buttons', learned('at', { aftertouchAll: true })), { type: 'at', channel: 4, mode: 'momentary', aftertouchAll: true })
assert.deepEqual(applyLearn(button, 'buttons', learned('at', { parameter: 61 })), { type: 'at', channel: 4, mode: 'momentary', parameter: 61, aftertouchAll: false })
// Every change goes through the shared validation and yields a profile parseProfile accepts.
for (const [kind, control, result] of [['encoders', rotation, learned('cc', { parameter: 7, fourteenBit: true })], ['encoders', rotation, learned('nrpn', { parameter: 16382 })], ['buttons', button, learned('note', { parameter: 60 })], ['pushes', button, learned('at', { aftertouchAll: true })]]) {
  const profile = createProfile(), id = kind === 'buttons' ? 5 : 3
  const next = applySelectionChange(profile, [{ kind, id }], applyLearn(control, kind, result))
  assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(next))), next)
  assert.equal(next[kind].find(e => e.id === id).type, result.type)
}
// Log/notice wording: MIDI terms untouched, control name translated through the {detail} slot.
assert.equal(describeLearn(learned('cc', { parameter: 16, fourteenBit: true })), 'CC 16 + 48')
assert.equal(describeLearn(learned('nrpn', { parameter: 1025, fourteenBit: true })), 'NRPN 1025 · CC 6 + 38')
assert.equal(describeLearn(learned('at', { aftertouchAll: true })), 'AT'); assert.equal(describeLearn(learned('at', { parameter: 3 })), 'AT 3'); assert.equal(describeLearn(learned('pc', { value: 5 })), 'PC')
// The notice describes what was assigned: a 14-bit pair on a button or push is applied as CC n alone.
assert.equal(describeApplied(learned('cc', { parameter: 16, fourteenBit: true }), 'buttons'), 'CC 16'); assert.equal(describeApplied(learned('nrpn', { parameter: 1025, fourteenBit: true }), 'pushes'), 'NRPN 1025')
assert.equal(describeApplied(learned('cc', { parameter: 16, fourteenBit: true }), 'encoders'), 'CC 16 + 48')
assert.equal(translate('Message NRPN 1025 out of range (max 127) for this control.', 'fr'), 'Message NRPN 1025 hors limite (max 127) pour ce contrôle.')
assert.equal(translate('Learned: Encoder 3 · CC 16 + 48 · channel 1', 'fr'), 'Appris : Encodeur 3 · CC 16 + 48 · canal 1')
assert.equal(translate('learned → Button 5 · Note 60 · channel 2', 'de'), 'gelernt → Taste 5 · Note 60 · Kanal 2')
assert.equal(translate('Learn armed: move the physical control to assign to Push 3.', 'en'), 'Learn armed: move the physical control to assign to Push 3.')
assert.equal(translate('Learn armed: move the physical control to assign to Encoder 3.', 'fr'), 'Learn armé : bouger le contrôle physique à associer à Encodeur 3.')
assert.equal(translate('Message Note 60 cannot be applied to this control.', 'es'), 'Mensaje Note 60 no aplicable a este control.')
for (const key of ['Learn', 'Learn cancelled: no assignment changed.', 'Waiting for the physical control…', 'MSB received · waiting for a 14-bit LSB (60 ms)…']) assert.ok(catalog[key], key)

// --- Learn session: the 60 ms wait for a 14-bit LSB, with injected timers. ---
let now = 0, timers = []
const fake = { set: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t }, clear: t => { timers = timers.filter(x => x !== t) } }
const advance = ms => { now += ms; for (const t of timers.filter(t => t.at <= now)) { timers = timers.filter(x => x !== t); t.fn() } }
const session = () => { const got = [], waits = []; const s = createLearnSession((result, data) => got.push({ result, data }), () => waits.push(now), 60, fake); return { s, got, waits } }
{ const { s, got } = session(); assert.equal(s.receive(cc(1, 16, 1)), true); assert.equal(got.length, 0); s.receive(cc(1, 48, 2)); assert.equal(got.length, 1); assert.deepEqual(got[0], { result: { type: 'cc', channel: 1, parameter: 16, fourteenBit: true, value: 130, pending: false }, data: cc(1, 48, 2) }, 'LSB within the wait: 14 bits'); assert.equal(timers.length, 0, 'no timer left') }
{ const { s, got } = session(); s.receive(cc(1, 16, 1)); s.receive(cc(1, 16, 2)); assert.equal(got.length, 1, 'second gesture ignored: one-shot'); assert.deepEqual(got[0], { result: { type: 'cc', channel: 1, parameter: 16, fourteenBit: false, value: 1, pending: true }, data: cc(1, 16, 1) }, 'repeated 7-bit CC: the first one, 7 bits'); assert.equal(timers.length, 0) }
{ const { s, got, waits } = session(); s.receive(cc(1, 16, 1)); assert.deepEqual(waits, [now], 'onPending once'); advance(59); assert.equal(got.length, 0, 'still waiting at 59 ms'); advance(1); assert.equal(got.length, 1); assert.equal(got[0].result.fourteenBit, false, 'lone MSB learned as 7 bits at the deadline'); assert.equal(timers.length, 0) }
{ const { s, got } = session(); s.receive(cc(1, 16, 1)); assert.equal(s.receive([0xf8]), false); assert.equal(s.receive([0xf0, 0, 0x20, 0x32, 0xf7]), false); assert.equal(got.length, 0, 'realtime and SysEx keep the wait'); s.receive(cc(1, 48, 2)); assert.equal(got[0].result.fourteenBit, true) }
{ const { s, got } = session(); s.receive(cc(1, 16, 1)); s.cancel(); advance(100); assert.equal(got.length, 0, 'cancel during the wait: nothing learned'); assert.equal(timers.length, 0, 'no residual timer'); s.cancel() }
{ const { s, got } = session(); s.receive(cc(1, 99, 8)); s.receive(cc(1, 98, 1)); assert.equal(s.receive(cc(1, 6, 100)), true); assert.equal(got.length, 0); s.receive(cc(1, 38, 3)); assert.deepEqual(got[0].result, { type: 'nrpn', channel: 1, parameter: 1025, fourteenBit: true, value: 12803, pending: false }, 'NRPN CC 6 then CC 38: 14 bits') }
{ const { s, got } = session(); s.receive(cc(1, 16, 1)); s.receive([0x90, 60, 100]); assert.equal(got.length, 1); assert.equal(got[0].result.type, 'cc', 'another channel message resolves the pending CC as 7 bits') }
{ const { s, got } = session(); s.receive(cc(1, 74, 5)); assert.equal(got.length, 1); assert.equal(timers.length, 0, 'CC 32-127 applied at once, no wait') }
{ const { s, got } = session(); s.receive(cc(1, 16, 1)); s.receive(cc(2, 48, 2)); assert.equal(got[0].result.fourteenBit, false, 'LSB on another channel does not complete the pair') }

// --- Rendered App: Learn toggle in the selection tools, off by default, no status line while disarmed. ---
const html = renderToStaticMarkup(React.createElement(load('./App').default))
const tools = html.slice(html.indexOf('<div class="selection-tools">'), html.indexOf('</div>', html.indexOf('<div class="selection-tools">')))
assert.ok(tools.includes('<button aria-pressed="false" class="learn-toggle">Learn</button>'), 'Learn toggle rendered in the selection tools: ' + tools)
assert.ok(!html.includes('class="surface-help learn-status"'), 'No learn status while disarmed')
// Source-level guards (no DOM renderer): learn feeds before the selection follow, and disarms on port change, tab change and preset recall.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.indexOf('learnReceive.current(data)') < app.indexOf('controlForChanges(selectionRef.current, changes)'), 'Learn parser fed before the selection follow')
assert.ok(app.includes("const receivedControl = learned ? null : controlForChanges("), 'Selection follow skipped while armed')
assert.ok(app.includes('useEffect(() => () => disarmLearn(), [inputId])') && app.includes("useEffect(() => { if (tab !== 'control') disarmLearn() }, [tab])") && app.includes('stopEmission(); disarmLearn()'), 'Disarm on port change, tab change and preset recall')
assert.ok(!readFileSync(new URL('../src/midi-learn.ts', import.meta.url), 'utf8').includes('send'), 'midi-learn never sends anything')
assert.ok(app.includes('describeApplied(result, target.kind)') && app.includes('learnSession.current?.receive(data)') && app.includes('learnSession.current?.cancel()'), 'App announces what was applied and drives Learn through the session')
console.log('PASS: learn parser (CC, 14-bit pairs, NRPN 7/14/inc-dec with fresh selector and RPN reset, note, PC without bank, AT, PB, ignored frames), applyLearn type/limit/mode/range rules through shared validation, 60 ms session with injected timers, catalog wording, rendered Learn toggle')
