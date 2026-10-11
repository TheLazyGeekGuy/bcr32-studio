import { selectionKey, type ControlSelection } from './multi-selection'

// Display arbiter: decides which control the OLED shows when several controls send at once.
// Pure module, no React, no MIDI: push() receives decoded changes with their timestamp, a fixed-rate tick chooses `shown`,
// and `settled` is the control the inspector selection may follow once the stream calms down. Timers and clock are
// injectable (same pattern as createLearnSession) so every rule is testable with a simulated clock.
export type ArbiterRule = 'last' | 'share'
export type ArbiterTimers = { set: (fn: () => void, ms: number) => unknown; clear: (timer: unknown) => void }
export type ActiveControl = { control: ControlSelection; share: number; lastAt: number }
export type ArbiterState = { shown: ControlSelection | null; active: ActiveControl[]; settled: ControlSelection | null }
// Inspector follow (same guard as the former per-message follow): the selection moves to `settled` only when
// it is a single selection, Learn is not armed and the settled control is not already selected. Pure so the App wiring is testable.
export function followSettled(settled: ControlSelection | null, selection: ControlSelection, selections: readonly ControlSelection[], learnArmed: boolean): ControlSelection | null {
  return settled && selections.length === 1 && !learnArmed && selectionKey(selection) !== selectionKey(settled) ? settled : null
}
export type ArbiterOptions = {
  tickMs?: number // refresh period of the simulated screen
  dwellMs?: number // minimum time a control stays shown before another may replace it (one slot of the 'share' rule)
  windowMs?: number // sliding window over which pulse shares are counted
  holdMs?: number // silence after which the arbiter freezes on the last shown control and stops ticking
  settleMs?: number // silence from *other* controls after which the shown control becomes `settled`
  rule?: ArbiterRule // 'last': the most recent event wins at each tick; 'share': stride scheduling on window shares
  timers?: ArbiterTimers
  clock?: () => number // time base of the ticks; push() receives its own `now` from the caller on the same base
  onChange?: (state: ArbiterState) => void
}
// Defaults. Measured end to end with a headless browser on an earlier rule set: 'last' with 100 ms slots gave 100 ms views at 3:1
// (unreadable) and, with two encoders at the same rate, 100 % of the screen to the one whose message always lands last before
// the tick (phase locking). 'share' is proportional by construction, whatever the phase; 300 ms slots keep a value readable.
// Still provisional until the share the hardware screen itself gives is measured.
export const arbiterDefaults = { tickMs: 50, dwellMs: 300, windowMs: 600, holdMs: 1500, settleMs: 250, rule: 'share' as ArbiterRule }
const realTimers: ArbiterTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }
const keyOf = (control: ControlSelection | null) => control ? selectionKey(control) : ''

export function createDisplayArbiter(options: ArbiterOptions = {}) {
  const { tickMs = arbiterDefaults.tickMs, dwellMs = arbiterDefaults.dwellMs, windowMs = arbiterDefaults.windowMs, holdMs = arbiterDefaults.holdMs, settleMs = arbiterDefaults.settleMs, rule = arbiterDefaults.rule, timers = realTimers, clock = () => performance.now(), onChange = () => {} } = options
  // Per control: event timestamps inside the window (pruned at each tick) and the last event seen since the last reset.
  const events = new Map<string, { control: ControlSelection; times: number[]; lastAt: number }>()
  const pass = new Map<string, number>() // stride scheduling positions, rule 'share'
  let last: { control: ControlSelection; at: number } | null = null
  let lastPushAt = -Infinity
  let shown: ControlSelection | null = null, shownSince = -Infinity
  let settled: ControlSelection | null = null
  let active: ActiveControl[] = []
  let timer: unknown = null
  let signature = ''

  const stopTicking = () => { if (timer !== null) { timers.clear(timer); timer = null } }
  const schedule = () => { timer = timers.set(tick, tickMs) }
  const snapshot = (): ArbiterState => ({ shown, active, settled })

  const computeActive = (now: number): ActiveControl[] => {
    let total = 0
    for (const [key, entry] of events) {
      entry.times = entry.times.filter(t => now - t < windowMs)
      total += entry.times.length
      if (now - entry.lastAt >= holdMs) events.delete(key) // heard before the hold: no longer active
    }
    return [...events.values()]
      .map(entry => ({ control: entry.control, share: total ? entry.times.length / total : 0, lastAt: entry.lastAt }))
      .sort((a, b) => b.share - a.share || b.lastAt - a.lastAt || selectionKey(a.control).localeCompare(selectionKey(b.control)))
  }
  const choose = (): ControlSelection | null => {
    if (rule === 'last') return last?.control ?? shown
    // Stride scheduling: each control advances by 1/share per slot; the lowest position runs next. New controls start at the
    // lowest current position so they get a slot soon; controls that left the window keep no position.
    const candidates = active.filter(a => a.share > 0)
    // Stream over (nothing left in the window): end on the control that sent last, as the hardware's last message would.
    if (!candidates.length) return last?.control ?? shown
    const floor = Math.min(...candidates.map(a => pass.get(selectionKey(a.control)) ?? Infinity), Infinity)
    for (const key of [...pass.keys()]) if (!candidates.some(a => selectionKey(a.control) === key)) pass.delete(key)
    for (const a of candidates) if (!pass.has(selectionKey(a.control))) pass.set(selectionKey(a.control), floor === Infinity ? 0 : floor)
    let next = candidates[0]
    for (const a of candidates) if (pass.get(selectionKey(a.control))! < pass.get(selectionKey(next.control))!) next = a
    pass.set(selectionKey(next.control), pass.get(selectionKey(next.control))! + 1 / next.share)
    return next.control
  }
  const publish = () => {
    // Fire only on a real change: shown, settled, active membership/order or a share crossing a 5 % step (rounded to 1/20).
    const next = `${keyOf(shown)}|${keyOf(settled)}|${active.map(a => `${selectionKey(a.control)}:${Math.round(a.share * 20)}`).join(',')}`
    if (next === signature) return
    signature = next
    onChange(snapshot())
  }
  function tick() {
    timer = null
    const now = clock()
    active = computeActive(now)
    // Rule 'last' measures the dwell from the last switch (a switch may happen at any tick past it); rule 'share' runs
    // in slots of dwellMs so every scheduled slot has the same length and the display share follows the pulse share.
    if (shown === null || now - shownSince >= dwellMs) {
      const next = choose()
      if (next && (rule === 'share' || keyOf(next) !== keyOf(shown))) { shown = next; shownSince = now }
    }
    // Settled: the only active control, or the shown control once no other control has sent for settleMs.
    if (active.length === 1) settled = active[0].control
    else if (shown) {
      const lastOther = Math.max(-Infinity, ...[...events.values()].filter(e => selectionKey(e.control) !== keyOf(shown)).map(e => e.lastAt))
      settled = now - lastOther >= settleMs ? shown : null
    } else settled = null
    const held = now - lastPushAt >= holdMs
    if (held) active = [] // frozen on the last shown control; nothing is "active" any more
    publish()
    if (!held) schedule()
  }
  const clear = () => {
    stopTicking()
    const hadState = shown !== null || settled !== null || active.length > 0
    events.clear(); pass.clear()
    last = null; lastPushAt = -Infinity
    shown = null; shownSince = -Infinity; settled = null; active = []
    signature = ''
    // Publish the empty state once so a consumer that mirrors `active` (the activity strip) does not stay frozen: after a
    // reset during the hold no tick would ever run again to empty it.
    if (hadState) onChange(snapshot())
  }
  return {
    // One call per decoded control and message. Starts the tick loop when idle; never calls onChange itself (ticks do).
    push(control: ControlSelection, now: number) {
      const key = selectionKey(control), entry = events.get(key)
      if (entry) { entry.times.push(now); entry.lastAt = now } else events.set(key, { control, times: [now], lastAt: now })
      last = { control, at: now }
      lastPushAt = now
      if (timer === null) schedule()
    },
    current: snapshot,
    // The panel or a local gesture took the screen: forget the stream so the next MIDI tick re-announces its winner.
    // Calls onChange with the empty state if there was anything to forget.
    reset: clear,
    // Clears timers and state (onChange with the empty state if there was any); the arbiter stays usable (the next push restarts it).
    stop: clear,
  }
}
export type DisplayArbiter = ReturnType<typeof createDisplayArbiter>
