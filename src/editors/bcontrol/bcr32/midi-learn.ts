import { is14Bit, modesFor, parameterLimit, typesFor, type Encoder, type EncoderMode, type EncoderType } from './profile'
import type { ControlChange } from './multi-selection'

// MIDI Learn: pure decoding of one incoming message into the parameters a control can take.
// Nothing here writes to the hardware; the caller applies the ControlChange to the local profile.
export type LearnType = 'cc' | 'nrpn' | 'note' | 'pc' | 'at' | 'pb'
export type LearnResult = {
  type: LearnType
  channel: number // 1-16
  parameter?: number // CC number, NRPN address, note; absent for PC (a program is a value, not the bank), PB and channel pressure
  fourteenBit: boolean // CC pair n / n+32, or NRPN data entry CC 6 + 38
  value: number // 0-127, or the 14-bit word when fourteenBit
  aftertouchAll?: boolean // channel pressure (D0) as opposed to poly pressure (A0)
  incDec?: boolean // NRPN data increment/decrement (CC 96/97)
  // A CC in 0-31 or an NRPN CC 6 may be the first half of a 14-bit pair: the caller waits briefly for the LSB.
  pending: boolean
}

const validData = (data: number[]) => data.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && data.slice(1).every(n => n <= 127)

export function createLearnParser() {
  const lastMsb = new Map<number, { cc: number; value: number }>() // channel -> CC 0-31 awaiting its n+32 LSB
  // NRPN selector per channel, same rule as createMidiDecoder (controller-midi.ts): an address is active only
  // while both of its bytes are fresh; a new CC 99/98 after a complete address starts a new one.
  const nrpn = new Map<number, { msb?: number; lsb?: number; data?: number; freshMsb?: boolean; freshLsb?: boolean }>()
  return (data: number[]): LearnResult | null => {
    if (!data.length || !validData(data) || data[0] < 0x80 || data[0] >= 0xf0) return null // SysEx, system common and realtime
    const status = data[0] & 0xf0, channel = (data[0] & 15) + 1
    const expected = status === 0xc0 || status === 0xd0 ? 2 : 3
    if (data.length !== expected) return null
    const base = { channel, fourteenBit: false, pending: false }
    if (status !== 0xb0) {
      lastMsb.delete(channel)
      if (status === 0x90 || status === 0x80) return { ...base, type: 'note', parameter: data[1], value: status === 0x80 ? 0 : data[2] }
      if (status === 0xc0) return { ...base, type: 'pc', value: data[1] } // the bank (CC 0/32) is not in a Program Change
      if (status === 0xd0) return { ...base, type: 'at', aftertouchAll: true, value: data[1] }
      if (status === 0xa0) return { ...base, type: 'at', parameter: data[1], value: data[2] }
      return { ...base, type: 'pb', value: data[2] * 128 + data[1] }
    }
    const cc = data[1], raw = data[2]
    const selector = nrpn.get(channel) ?? {}
    const address = selector.freshMsb && selector.freshLsb ? selector.msb! * 128 + selector.lsb! : null
    // The LSB of a 14-bit CC pair: only when it immediately follows its MSB on the same channel.
    const msb = lastMsb.get(channel)
    if (cc >= 32 && cc <= 63 && msb?.cc === cc - 32) {
      lastMsb.delete(channel)
      return { ...base, type: 'cc', parameter: cc - 32, fourteenBit: true, value: msb.value * 128 + raw }
    }
    lastMsb.delete(channel)
    if (cc === 99 || cc === 98) {
      if (address !== null) { selector.freshMsb = false; selector.freshLsb = false }
      if (cc === 99) { selector.msb = raw; selector.freshMsb = true } else { selector.lsb = raw; selector.freshLsb = true }
      selector.data = undefined; nrpn.set(channel, selector); return null
    }
    if (cc === 100 || cc === 101 || cc === 121) { nrpn.delete(channel); return null } // RPN or reset all controllers cancels the NRPN selector
    if (address !== null && [6, 38, 96, 97].includes(cc)) {
      if (address === 16383) return null // null selector, not a configurable address
      if (cc === 6) { selector.data = raw; return { ...base, type: 'nrpn', parameter: address, value: raw, pending: true } }
      if (cc === 38) { const msb = selector.data; selector.data = undefined; return msb === undefined ? null : { ...base, type: 'nrpn', parameter: address, fourteenBit: true, value: msb * 128 + raw } }
      return { ...base, type: 'nrpn', parameter: address, value: raw, incDec: true }
    }
    if (cc <= 31) lastMsb.set(channel, { cc, value: raw })
    return { ...base, type: 'cc', parameter: cc, value: raw, pending: cc <= 31 }
  }
}

// Text the log and notices show for a learned message; MIDI terms stay untranslated.
export const describeLearn = (result: Pick<LearnResult, 'type' | 'parameter' | 'fourteenBit' | 'aftertouchAll'>) =>
  result.type === 'cc' ? `CC ${result.parameter}${result.fourteenBit ? ` + ${result.parameter! + 32}` : ''}` :
  result.type === 'nrpn' ? `NRPN ${result.parameter}${result.fourteenBit ? ' · CC 6 + 38' : ''}` :
  result.type === 'note' ? `Note ${result.parameter}` : result.type === 'pc' ? 'PC' :
  result.type === 'at' ? result.aftertouchAll || result.parameter === undefined ? 'AT' : `AT ${result.parameter}` : 'PB'
// What was actually assigned: buttons and pushes have no 14-bit mode, so a received pair is applied as CC n alone.
export const describeApplied = (result: Pick<LearnResult, 'type' | 'parameter' | 'fourteenBit' | 'aftertouchAll'>, kind: 'encoders' | 'pushes' | 'buttons') =>
  describeLearn(kind === 'encoders' ? result : { ...result, fourteenBit: false })

export function applyLearn(control: Encoder, kind: 'encoders' | 'pushes' | 'buttons', result: LearnResult): ControlChange | { error: string } {
  const rotation = kind === 'encoders', type: EncoderType = result.type
  if (!typesFor(rotation).includes(type)) return { error: `Message ${describeLearn(result)} cannot be applied to this control.` }
  // Same limit as the inspector (parameterLimit on a rotation, 127 on buttons and pushes): refused, never silently clamped.
  const limit = rotation ? parameterLimit({ type }) : 127
  if (result.parameter !== undefined && result.parameter > limit) return { error: `Message ${describeLearn(result)} out of range (max ${limit}) for this control.` }
  const modes = modesFor(type, rotation)
  let mode: EncoderMode
  if (!rotation) mode = modes.includes(control.mode) ? control.mode : modes[0]
  else if (result.incDec && modes.includes('inc_dec')) mode = 'inc_dec'
  // A 14-bit message keeps an existing 14-bit mode (relative stays relative), otherwise ABS_14.
  else if (result.fourteenBit) mode = is14Bit(control) && modes.includes(control.mode) ? control.mode : 'abs_14'
  // A 7-bit message leaves a 14-bit mode; INC/DEC only comes from CC 96/97, so a data entry (CC 6) leaves it; an incompatible mode falls back to absolute.
  else mode = !is14Bit(control) && control.mode !== 'inc_dec' && modes.includes(control.mode) ? control.mode : 'absolute'
  const change: ControlChange = { type, channel: result.channel, mode }
  if (result.parameter !== undefined) change.parameter = result.parameter
  if (type === 'at' && !rotation) change.aftertouchAll = !!result.aftertouchAll
  // Same range rule as applySelectionChange: default 0-127 widens to 0-16383 entering 14 bits; leaving 14 bits clamps to 127.
  const next = { mode }
  if (is14Bit(next) && !is14Bit(control) && control.minimum === 0 && control.maximum === 127) change.maximum = 16383
  if (!is14Bit(next) && is14Bit(control)) { change.minimum = Math.min(control.minimum, 127); change.maximum = Math.min(control.maximum, 127) }
  return change
}

// One armed Learn: parses each message and holds the 60 ms wait for the LSB of a 14-bit pair (CC n+32 after CC n in 0-31,
// CC 38 after NRPN CC 6). Timers are injectable so the wait is testable without React or real time.
export type LearnTimers = { set: (fn: () => void, ms: number) => unknown; clear: (timer: unknown) => void }
const realTimers: LearnTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }
export function createLearnSession(onLearn: (result: LearnResult, data: number[]) => void, onPending: () => void = () => {}, waitMs = 60, timers: LearnTimers = realTimers) {
  const parse = createLearnParser()
  let pending: { result: LearnResult; data: number[]; timer: unknown } | null = null
  const cancel = () => { if (pending) { timers.clear(pending.timer); pending = null } }
  return {
    // True when the message was a learnable channel message (applied, or the start of a wait).
    receive(data: number[]): boolean {
      const result = parse(data)
      if (!result) return false
      if (pending) {
        // The LSB of the awaited pair completes it as 14-bit; any other message resolves the first one as 7-bit and is ignored (Learn is one-shot).
        const first = pending
        cancel()
        const completes = result.fourteenBit && result.type === first.result.type && result.channel === first.result.channel && result.parameter === first.result.parameter
        if (completes) onLearn(result, data); else onLearn(first.result, first.data)
        return true
      }
      if (result.pending) {
        pending = { result, data, timer: timers.set(() => { pending = null; onLearn(result, data) }, waitMs) }
        onPending()
        return true
      }
      onLearn(result, data)
      return true
    },
    cancel,
  }
}
