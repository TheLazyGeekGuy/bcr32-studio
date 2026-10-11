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
const { createDisplayArbiter, followSettled, arbiterDefaults } = load('./display-arbiter')
const { catalog, translate } = load('./i18n')

// --- Simulated clock and timers (pattern of the createLearnSession tests): `now` is the single time base. ---
let now = 0, timers = []
const fake = { set: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t }, clear: t => { timers = timers.filter(x => x !== t) } }
const A = { kind: 'encoders', id: 1 }, B = { kind: 'encoders', id: 17 }, key = c => c ? `${c.kind}:${c.id}` : null
// Advance the clock in 1 ms steps, firing due timers and calling `every(t)` (pushes) at each step.
const run = (ms, every = () => {}) => { for (let i = 0; i < ms; i++) { now += 1; every(now); for (const t of timers.filter(t => t.at <= now)) { timers = timers.filter(x => x !== t); t.fn() } } }
const make = options => { const changes = []; const a = createDisplayArbiter({ timers: fake, clock: () => now, onChange: s => changes.push({ at: now, shown: key(s.shown), settled: key(s.settled), active: s.active.map(x => key(x.control)) }), ...options }); return { a, changes } }
const reset = () => { now = 0; timers = [] }

// Single control: shown at the first tick (50 ms after the first push), settled at once, no further onChange while it keeps sending.
{ reset(); const { a, changes } = make()
  a.push(A, now); assert.equal(changes.length, 0, 'push alone fires nothing'); assert.equal(a.current().shown, null)
  run(49); assert.equal(changes.length, 0, 'nothing before the first tick')
  run(1); assert.equal(changes.length, 1); assert.equal(changes[0].shown, 'encoders:1'); assert.equal(changes[0].settled, 'encoders:1', 'single active control: settled at once'); assert.deepEqual(changes[0].active, ['encoders:1'])
  run(500, t => { if (t % 10 === 0) a.push(A, t) }); assert.equal(changes.length, 1, 'same control, same shares: no extra onChange')
  assert.equal(a.current().active[0].share, 1) }

// Rule 'last' with dwell = tick: at each tick the shown control is the control of the most recent event.
{ reset(); const { a } = make({ rule: 'last', dwellMs: 50 }); const seen = [], expected = []
  let lastEvent = null
  const observe = () => { seen.push(key(a.current().shown)); expected.push(key(lastEvent)) }
  // 3:1 pattern over 1 s: A at 0, 10, 20 and B at 30 of every 40 ms. Sample after each tick (ticks at multiples of 50 ms).
  for (let t = 1; t <= 1000; t++) { now = t; const phase = t % 40; if (phase === 0 || phase === 10 || phase === 20) { a.push(A, t); lastEvent = A } else if (phase === 30) { a.push(B, t); lastEvent = B } for (const x of timers.filter(x => x.at <= now)) { timers = timers.filter(y => y !== x); x.fn(); observe() } }
  assert.ok(seen.length >= 19, 'ticks observed: ' + seen.length)
  assert.deepEqual(seen, expected, "rule 'last': shown equals the control of the last message before each tick") }

// Rule 'share', 3:1 over ten seconds once the 300 ms window is full: display share 75/25 within one tick (0.5 pt over 200 ticks).
// (During the first window the shares are still converging; the stride scheduler's own quantum is one slot = dwell.)
{ reset(); const { a } = make({ rule: 'share', dwellMs: 100, windowMs: 300 }); const shown = []
  for (let t = 1; t <= 10300; t++) { now = t; const phase = t % 40; if (phase === 0 || phase === 10 || phase === 20) a.push(A, t); else if (phase === 30) a.push(B, t); for (const x of timers.filter(x => x.at <= now)) { timers = timers.filter(y => y !== x); x.fn(); if (t > 300) shown.push(key(a.current().shown)) } }
  const shareA = shown.filter(k => k === 'encoders:1').length / shown.length
  assert.ok(Math.abs(shareA - 0.75) <= 1 / shown.length + 1e-9, `share rule: A shown ${(shareA * 100).toFixed(1)} % of ${shown.length} ticks, expected 75 % within one tick`)
  assert.ok(shown.includes('encoders:17'), 'B gets slots too') }

// Dwell never violated, even with events every 5 ms alternating between two controls (A, B, B, A, B, B… so that the last
// event before a tick is not always the same control); share bookkeeping says both active.
for (const rule of ['last', 'share']) { reset(); const { a, changes } = make({ rule, dwellMs: 100 })
  run(1000, t => { if (t % 5 === 0) a.push(Math.floor(t / 5) % 3 === 0 ? A : B, t) })
  const switches = changes.filter((c, i) => i === 0 || c.shown !== changes[i - 1].shown)
  assert.ok(switches.length > 3, `${rule}: the screen alternates (${switches.length} switches)`)
  for (let i = 1; i < switches.length; i++) assert.ok(switches[i].at - switches[i - 1].at >= 100, `${rule}: dwell violated: ${switches[i - 1].at} -> ${switches[i].at}`)
  assert.deepEqual([...changes.at(-1).active].sort(), ['encoders:1', 'encoders:17'])
  assert.ok(changes.every(c => c.settled === null), `${rule}: settled stays null while two controls alternate`) }

// Hold: 1500 ms of silence stops the tick, freezes shown and empties the active list; the next push restarts.
{ reset(); const { a, changes } = make()
  run(200, t => { if (t % 10 === 0) a.push(A, t) })
  const before = changes.length
  run(1499); assert.ok(timers.length === 1, 'still ticking before the hold elapses')
  run(60); assert.equal(timers.length, 0, 'no timer left after hold: nothing idles')
  assert.equal(key(a.current().shown), 'encoders:1', 'frozen on the last shown control'); assert.deepEqual(a.current().active, [])
  assert.ok(changes.length >= before + 1 && changes.at(-1).active.length === 0, 'active emptied once')
  run(1000); assert.equal(timers.length, 0)
  a.push(B, now); assert.equal(timers.length, 1, 'push restarts the tick'); run(50); assert.equal(key(a.current().shown), 'encoders:17') }

// Settled: null while alternating, becomes the winner 250 ms after the last foreign event; onChange not fired per push.
// Pinned to rule 'last' with 100 ms dwell so the switch to A happens at the first tick past the settle delay.
{ reset(); const { a, changes } = make({ rule: 'last', dwellMs: 100, windowMs: 300 })
  run(600, t => { if (t % 5 === 0) a.push(t % 10 === 0 ? A : B, t) }) // alternation until t=600, B's last event at 595
  assert.ok(changes.length < 600 / 5 / 2, `onChange (${changes.length}) far below the push count (120)`)
  assert.equal(a.current().settled, null)
  run(400, t => { if (t % 10 === 0) a.push(A, t) }) // only A from 600 on
  const settledAt = changes.find(c => c.at > 600 && c.settled === 'encoders:1')?.at
  assert.ok(settledAt !== undefined, 'A settles once B stops')
  assert.ok(settledAt >= 595 + 250 && settledAt < 595 + 250 + 50, `settled at ${settledAt}: 250 ms after B's last event (595), within one tick`)
  assert.ok(changes.filter(c => c.at > 600 && c.at < settledAt).every(c => c.settled === null), 'no settled before the settle delay') }

// stop() clears the timer and the state; reset() does the same so the next MIDI tick re-announces its winner.
{ reset(); const { a, changes } = make()
  run(100, t => { if (t % 10 === 0) a.push(A, t) }); assert.equal(timers.length, 1)
  const before = changes.length
  a.stop(); assert.equal(timers.length, 0, 'stop clears timers'); assert.deepEqual(a.current(), { shown: null, active: [], settled: null })
  assert.equal(changes.length, before + 1, 'stop publishes the empty state once'); assert.deepEqual(changes.at(-1), { at: now, shown: null, settled: null, active: [] })
  a.stop(); assert.equal(changes.length, before + 1, 'a second stop on an empty arbiter publishes nothing')
  const n = changes.length; run(2000); assert.equal(changes.length, n, 'no onChange after stop')
  a.push(B, now); run(50); assert.equal(changes.at(-1).shown, 'encoders:17', 'usable again after stop')
  a.reset(); assert.equal(timers.length, 0); a.push(B, now); run(50); assert.equal(changes.at(-1).shown, 'encoders:17', 'after reset the same winner is announced again') }

// Wiring (shared-CC follow through the arbiter): A turned -> selection follows A; panel click on B (selection B, reset());
// A turned again -> the selection must come back to A. Mirror of the App onChange closure built on the exported followSettled.
{ reset(); let selection = A, selections = [A], learnArmed = false, strip = []
  const a = createDisplayArbiter({ timers: fake, clock: () => now, onChange: state => {
    strip = state.active.map(x => key(x.control))
    const next = followSettled(state.settled, selection, selections, learnArmed)
    if (next) { selection = next; selections = [next] }
  } })
  selection = B; selections = [B]
  run(300, t => { if (t % 10 === 0) a.push(A, t) }); assert.equal(key(selection), 'encoders:1', 'selection follows the settled control')
  run(2000); assert.equal(timers.length, 0); assert.deepEqual(strip, [], 'strip empty after the hold')
  selection = B; selections = [B]; a.reset() // panel click on B
  run(300, t => { if (t % 10 === 0) a.push(A, t) }); assert.equal(key(a.current().settled), 'encoders:1'); assert.equal(key(selection), 'encoders:1', 'A turned again after a click on B: the selection comes back to A')
  // Reset during the hold (click on a strip row): the strip must empty at once even though no tick will ever run again.
  assert.deepEqual(strip, ['encoders:1']); selection = B; selections = [B]; a.reset()
  assert.deepEqual(strip, [], 'reset publishes the empty state: strip emptied'); run(5000); assert.equal(timers.length, 0); assert.deepEqual(strip, [])
  assert.equal(key(selection), 'encoders:17', 'reset does not move the selection')
  // Guards: multi-selection and Learn armed never follow; an already selected control is not re-selected.
  assert.equal(followSettled(A, B, [A, B], false), null, 'multi-selection: no follow')
  assert.equal(followSettled(A, B, [B], true), null, 'Learn armed: no follow')
  assert.equal(followSettled(A, A, [A], false), null, 'already selected: no follow'); assert.equal(followSettled(null, B, [B], false), null)
  assert.deepEqual(followSettled(A, B, [B], false), A) }


// --- Defaults: rule 'share', 300 ms slots, 600 ms window. Regressions measured end to end on an earlier rule set. ---
assert.deepEqual({ ...arbiterDefaults }, { tickMs: 50, dwellMs: 300, windowMs: 600, holdMs: 1500, settleMs: 250, rule: 'share' })
const views = changes => { const runs = []; for (const c of changes) if (!runs.length || runs.at(-1).shown !== c.shown) runs.push({ shown: c.shown, at: c.at }); return runs }
// Two encoders at the same rate whose messages land in the same order before every tick (A then B, every 20 ms): the former 'last'/100 ms defaults gave
// 100 % of the screen to B. Default config must alternate, near 50/50, every view lasting at least one slot.
{ reset(); const { a, changes } = make()
  run(4000, t => { if (t % 20 === 0) { a.push(A, t); a.push(B, t) } })
  const runs = views(changes.filter(c => c.shown)), time = { 'encoders:1': 0, 'encoders:17': 0 }
  for (let i = 0; i < runs.length; i++) time[runs[i].shown] += (runs[i + 1]?.at ?? 4000) - runs[i].at
  const shareA = time['encoders:1'] / (time['encoders:1'] + time['encoders:17'])
  assert.ok(shareA > 0.4 && shareA < 0.6, `phase-locked 1:1: A shown ${(shareA * 100).toFixed(0)} % (expected about 50 %)`)
  for (let i = 1; i < runs.length; i++) assert.ok(runs[i].at - runs[i - 1].at >= arbiterDefaults.dwellMs, `view shorter than a slot: ${runs[i - 1].at} -> ${runs[i].at}`)
  assert.ok(runs.length >= 8, `the screen alternates (${runs.length} views in 4 s)`) }
// 3:1 with the defaults: proportional within one slot over ten seconds once the window is full, views never shorter than a slot.
{ reset(); const { a, changes } = make(); const shown = []
  for (let t = 1; t <= 10600; t++) { now = t; const phase = t % 40; if (phase === 0 || phase === 10 || phase === 20) a.push(A, t); else if (phase === 30) a.push(B, t); for (const x of timers.filter(x => x.at <= now)) { timers = timers.filter(y => y !== x); x.fn(); if (t > 600) shown.push(key(a.current().shown)) } }
  const shareA = shown.filter(k => k === 'encoders:1').length / shown.length, slot = arbiterDefaults.dwellMs / arbiterDefaults.tickMs
  assert.ok(Math.abs(shareA - 0.75) <= slot / shown.length + 1e-9, `defaults 3:1: A shown ${(shareA * 100).toFixed(1)} % of ${shown.length} ticks, expected 75 % within one slot`)
  const runs = views(changes.filter(c => c.shown))
  for (let i = 1; i < runs.length; i++) assert.ok(runs[i].at - runs[i - 1].at >= arbiterDefaults.dwellMs, `3:1 view shorter than a slot at ${runs[i].at}`) }
// When everything stops, the screen ends on the control that sent last (B here), not on whichever slot was running.
{ reset(); const { a } = make()
  run(1000, t => { if (t % 10 === 0) a.push(A, t); if (t % 40 === 5) a.push(B, t) })
  run(30, t => { if (t === 1010) a.push(B, t) })
  run(2000); assert.equal(timers.length, 0); assert.equal(key(a.current().shown), 'encoders:17', 'stream over: last sender shown') }

// --- Rendered App: no activity strip by default (no active control); catalog rows for its strings. ---
const html = renderToStaticMarkup(React.createElement(load('./App').default))
assert.ok(!html.includes('activity-strip'), 'Activity strip absent without MIDI activity')
assert.ok(html.includes('<div class="selection-tools">'), 'Inspector rendered')
for (const k of ['Active controls']) assert.ok(catalog[k], 'catalog: ' + k)
assert.equal(translate('75% of pulses', 'fr'), '75 % des impulsions')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes("const receivedControl = learned ? null : controlForChanges(") && app.includes('if (receivedControl) arbiter.push(receivedControl, performance.now())'), 'App pushes the controlForChanges choice (no guess among shared CCs) into the arbiter')
assert.ok(!app.includes('setScreenControl(receivedControl)'), 'No per-message screen update left')
assert.ok(app.includes('followSettled(state.settled, selectionRef.current, selectionsRef.current, learnArmed.current)') && !app.includes('settledKey'), 'App follows through followSettled, with no extra memo that would survive a reset')
const arbiterSource = readFileSync(new URL('../src/display-arbiter.ts', import.meta.url), 'utf8')
assert.ok(!arbiterSource.includes("from 'react'") && !/\.(send|enqueue\w*)\s*\(/.test(arbiterSource), 'display-arbiter: pure, no React import, no MIDI output')
console.log("PASS: display arbiter — defaults 'share' 300/600: phase-locked 1:1 alternates near 50/50, 3:1 proportional within a slot, views ≥ one slot, stream ends on the last sender; single control at first tick, rule 'last' = last message per tick, rule 'share' 75/25 within one tick over 10 s, dwell kept at 5 ms bursts, hold stops the tick and freezes, settled 250 ms after the last foreign event, onChange per change not per push, stop/reset publish the empty state once, follow comes back after a panel click; activity strip absent by default")
