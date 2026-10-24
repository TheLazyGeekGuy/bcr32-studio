// MIDI clock master for the BCR32 sequencer when its clock source is USB (ZAQ global 26, CLOCK INT/EXT). The Zaquencer
// expects Start (FA), then Clock (F8, 24 per quarter note) to drive it, and Stop (FC) to stop and reset (BCR2000 manual
// 1.04 §7.3). Only these three one-byte messages can leave this module; ticks are scheduled ahead with timestamps.
export const clockMessages = { start: 0xfa, clock: 0xf8, stop: 0xfc } as const
export const isClockMessage = (bytes: readonly number[]) => bytes.length === 1 && (bytes[0] === 0xfa || bytes[0] === 0xf8 || bytes[0] === 0xfc)
export const tempoRange = { min: 30, max: 300 } // the BCR32's own BPM range (manual Rev1, ZAQ global 25)

export type ClockTimers = { now(): number; every(fn: () => void, ms: number): unknown; cancel(handle: unknown): void }
const realTimers: ClockTimers = {
  now: () => performance.now(),
  every: (fn, ms) => setInterval(fn, ms),
  cancel: handle => clearInterval(handle as ReturnType<typeof setInterval>),
}

export function createClockMaster(send: (bytes: number[], at: number) => void, onChange: (running: boolean) => void = () => {},
  { timers = realTimers, lookaheadMs = 60, intervalMs = 15 }: { timers?: ClockTimers; lookaheadMs?: number; intervalMs?: number } = {}) {
  let handle: unknown = null, next = 0, bpm = 120
  const tickMs = () => 60000 / bpm / 24
  const emit = (byte: number, at: number) => {
    try { send([byte], at) } catch (error) { halt(); throw error }
  }
  const pump = () => { const until = timers.now() + lookaheadMs; while (next <= until) { emit(clockMessages.clock, next); next += tickMs() } }
  const halt = () => { if (handle !== null) { timers.cancel(handle); handle = null; onChange(false) } }
  const tempo = (value: number) => {
    if (!Number.isFinite(value)) throw Error('Tempo must be a number')
    bpm = Math.max(tempoRange.min, Math.min(tempoRange.max, Math.round(value)))
  }
  return {
    get running() { return handle !== null },
    get bpm() { return bpm },
    tempo,
    start(value = bpm) {
      tempo(value); if (handle !== null) return
      const now = timers.now(); emit(clockMessages.start, now); next = now
      handle = timers.every(pump, intervalMs); onChange(true); pump()
    },
    stop() { if (handle === null) return; halt(); emit(clockMessages.stop, timers.now()) },
  }
}
export type ClockMaster = ReturnType<typeof createClockMaster>
