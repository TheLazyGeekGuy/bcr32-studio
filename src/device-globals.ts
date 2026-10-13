import type { ControllerSettings } from './profile'

// BCR32 global settings (docs/PROTOCOL.md, "Global settings").
// Read: the exact request the official editor sends at every connection, F0 00 20 32 7F 64 <cmd> F7; the device answers
// F0 00 20 32 7F 64 <cmd> <value> F7. Write: F0 00 20 32 7F 64 <cmd> <value> F7, the layout the official editor builds
// for all 17 globals (one code path, LED brightness included); verified on hardware on 2026-10-13 (Clock rate out
// 3 -> 4 -> 3, each acknowledged and read back). Every write is followed by a read-back.
const prefix = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64]
// Option lists: the official editor's BCR32 lists, matched to each setting by value range and meaning (2026-10-12).
// Abbreviations spelled out: U = USB, A/B = MIDI A/B, F = filtered (thru), STDL = standalone.
const routing = ['Off', 'MIDI A', 'MIDI B', 'MIDI A & B', 'USB', 'USB & MIDI A', 'USB & MIDI B', 'USB & MIDI A & B']
const notes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const channels = Array.from({ length: 16 }, (_, i) => `CH ${i + 1}`)
const chRanges = Array.from({ length: 13 }, (_, i) => `CH ${i + 1}-${i + 4}`)

// Order = the official editor's own read order; max = the value range of the official editor's parameter table. Settings without a reliable list (range and list sizes differ) show
// their raw value only.
export const deviceGlobals: { cmd: number; name: string; max?: number; choices?: string[] }[] = [
  { cmd: 0x74, name: 'Bootloader status' },
  // Manual (global settings 9 and 10): ZAQ starts/stops the sequencer on footswitch 1, moves to the next pattern on 2.
  { cmd: 0x1b, name: 'Footswitch 1', max: 1, choices: ['CTRL · programmable', 'ZAQ · start/stop'] },
  { cmd: 0x1c, name: 'Footswitch 2', max: 1, choices: ['CTRL · programmable', 'ZAQ · next pattern'] },
  { cmd: 0x1e, name: 'MIDI thru source', max: 2, choices: ['Off', 'MIDI in', 'USB in'] },
  { cmd: 0x1d, name: 'MIDI thru destination', max: 15, choices: ['Off', 'MIDI A (filtered)', 'MIDI B (filtered)', 'MIDI A & B (filtered)', 'MIDI A', 'MIDI B', 'MIDI A & B'] },
  { cmd: 0x1f, name: 'Operating mode', max: 2, choices: ['USB', 'Standalone', 'Mixed'] },
  { cmd: 0x40, name: 'LED brightness', max: 15 },
  { cmd: 0x30, name: 'Controller output port', max: 7, choices: routing },
  { cmd: 0x17, name: 'Start on', max: 1, choices: ['CTRL', 'ZAQ'] },
  { cmd: 0x18, name: 'Clock rate out', max: 4, choices: ['1 PPQ', '2 PPQ', '4 PPQ', '24 PPQ', '48 PPQ'] },
  { cmd: 0x20, name: 'Sync mode', max: 3, choices: ['Internal', 'Sync in', 'MIDI in', 'USB in'] },
  { cmd: 0x21, name: 'Clock output port', max: 8 },
  { cmd: 0x23, name: 'Scale', max: 127 },
  { cmd: 0x24, name: 'Scale base', max: 11, choices: notes },
  { cmd: 0x25, name: 'Transpose mode', max: 30, choices: ['Off', ...channels, 'Track', ...chRanges] },
  { cmd: 0x26, name: 'Trigger mode', max: 16, choices: ['Off', ...channels] },
  { cmd: 0x27, name: 'Quantization mode', max: 15, choices: ['96', 't32', '32', 't16', '16', 't8', '8', 't4', '4', 't2', '2', 't1bar', '1bar', 't2bar', '2bar', '4bar'] },
  { cmd: 0x28, name: 'Quantization mixer', max: 1 },
]
// Hard safety rule: never STORE (0x72) nor bootloader/firmware (0x77).
if (deviceGlobals.some(g => g.cmd === 0x72 || g.cmd === 0x77)) throw Error('Forbidden SysEx command in the global reads')

export const globalQuery = (cmd: number) => [...prefix, cmd, 0xf7]
// Settings whose wrong value can cut the USB link with the editor (standalone mode, controller output Off or MIDI only):
// the UI asks for a second confirmation before writing them.
export const riskyGlobals = new Set([0x1f, 0x30])
// DISABLED on 2026-10-13: writing global settings froze the owner's BCR32 (firmware 0.56.0). The verified test on
// Clock rate out did not freeze it, but the cause is not understood. Re-enable only after a reproduced, explained test.
export const globalWritesEnabled = false
export function globalWrite(cmd: number, value: number) {
  const g = deviceGlobals.find(x => x.cmd === cmd)
  if (!g || cmd === 0x74 || cmd === 0x72 || cmd === 0x77 || g.max === undefined) throw Error('Not a writable global setting')
  if (!Number.isInteger(value) || value < 0 || value > g.max) throw Error(`${g.name}: 0–${g.max}`)
  return [...prefix, cmd, value, 0xf7]
}
export type GlobalResult = { cmd: number; name: string; value: number | null; label: string | null; status: 'value' | 'echo' | 'no reply' }
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: t => clearTimeout(t as ReturnType<typeof setTimeout>) }

// Sequential reader: one request at a time, the next only after the reply or the timeout. receive() returns true when
// the message was the awaited reply (so the caller may skip other handlers if it wants).
export function createGlobalsReader(send: (bytes: number[]) => void, timeoutMs = 400, timers: Timers = realTimers) {
  let pending: { cmd: number; settle: (r: { value: number | null; status: GlobalResult['status'] }) => void; timer: unknown } | null = null
  let closed = false
  // One exchange at a time: a message out, the reply carrying the same command (or the timeout).
  const exchange = (cmd: number, bytes: number[]) => new Promise<{ value: number | null; status: GlobalResult['status'] }>(resolve => {
    const timer = timers.set(() => { pending = null; resolve({ value: null, status: 'no reply' }) }, timeoutMs)
    pending = { cmd, timer, settle: r => { timers.clear(timer); pending = null; resolve(r) } }
    send(bytes)
  })
  const ask = (cmd: number) => exchange(cmd, globalQuery(cmd))
  let queue: Promise<unknown> = Promise.resolve()
  function serial<T>(job: () => Promise<T>): Promise<T> { const next = queue.then(job, job); queue = next.catch(() => {}); return next }
  return {
    read: (): Promise<GlobalResult[]> => serial(async () => {
      const results: GlobalResult[] = []
      for (const g of deviceGlobals) {
        if (closed) break
        const r = await ask(g.cmd)
        results.push({ cmd: g.cmd, name: g.name, value: r.value, status: r.status, label: r.value !== null && g.choices ? g.choices[r.value] ?? null : null })
      }
      return results
    }),
    // Write one setting, then read it back: the read-back is the truth shown to the user.
    write: (cmd: number, value: number): Promise<{ value: number | null; status: GlobalResult['status'] }> => serial(async () => {
      if (!globalWritesEnabled) throw Error('Writing global settings is disabled')
      const bytes = globalWrite(cmd, value)
      await exchange(cmd, bytes)
      return closed ? { value: null, status: 'no reply' as const } : ask(cmd)
    }),
    receive(bytes: number[]): boolean {
      if (!pending || !prefix.every((v, i) => bytes[i] === v) || bytes[6] !== pending.cmd || bytes.at(-1) !== 0xf7) return false
      if (bytes.length === 9 && bytes[7] <= 0x7f) pending.settle({ value: bytes[7], status: 'value' })
      else if (bytes.length === 8) pending.settle({ value: null, status: 'echo' })
      else return false
      return true
    },
    close() { closed = true; if (pending) { timers.clear(pending.timer); pending.settle({ value: null, status: 'no reply' }) } },
  }
}

// Values read from the device, expressed as the editor's Config fields (only the fields the editor has).
export function settingsFromDevice(results: GlobalResult[]): Partial<ControllerSettings> {
  const v = (cmd: number) => results.find(r => r.cmd === cmd && r.status === 'value')?.value ?? null
  const out: Partial<ControllerSettings> = {}
  const start = v(0x17); if (start === 0 || start === 1) out.startupMode = start ? 'zqr' : 'ctrl'
  const f1 = v(0x1b), f2 = v(0x1c)
  if ((f1 === 0 || f1 === 1) && (f2 === 0 || f2 === 1)) out.footswitchModes = [f1 ? 'zaq' : 'ctrl', f2 ? 'zaq' : 'ctrl']
  const extra: Record<string, number> = {}
  for (const g of editableGlobals) { const value = v(g.cmd); if (!mapped.has(g.cmd) && value !== null && value <= (g.max ?? 127)) extra[hexKey(g.cmd)] = value }
  if (Object.keys(extra).length) out.deviceValues = extra
  const mode = v(0x1f); if (mode !== null && mode <= 2) out.operationMode = (['usb', 'stdl', 'mixed'] as const)[mode]
  const port = v(0x30); if (port !== null && port <= 7) out.outputRouting = routing[port]
  const source = v(0x1e); if (source !== null && source <= 2) out.thruSource = (['off', 'midi', 'usb'] as const)[source]
  const dest = v(0x1d)
  if (dest !== null && dest <= 6) {
    out.thruDestination = ['Off', 'MIDI A', 'MIDI B', 'MIDI A & B', 'MIDI A', 'MIDI B', 'MIDI A & B'][dest]
    out.thruFiltered = dest >= 1 && dest <= 3
  }
  return out
}
// Config fields whose current value differs from what was read on the device.
export function differingFields(current: ControllerSettings, device: Partial<ControllerSettings>): (keyof ControllerSettings)[] {
  return (Object.keys(device) as (keyof ControllerSettings)[]).filter(k => JSON.stringify(current[k]) !== JSON.stringify(device[k]))
}

// Settings the editor keeps in its own Config fields (StudioConfig); the others live in settings.deviceValues.
const mapped = new Set([0x17, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x30])
// Not edited here: the bootloader status is informative; the LED brightness has its own verified control.
export const editableGlobals = deviceGlobals.filter(g => g.cmd !== 0x74 && g.cmd !== 0x40)
export const hexKey = (cmd: number) => cmd.toString(16).padStart(2, '0')

// Value of a setting as currently held by the editor (Config fields or deviceValues), null when unknown.
export function valueOf(cmd: number, s: ControllerSettings): number | null {
  switch (cmd) {
    case 0x17: return s.startupMode === 'zqr' ? 1 : 0
    case 0x1b: return s.footswitchModes[0] === 'zaq' ? 1 : 0
    case 0x1c: return s.footswitchModes[1] === 'zaq' ? 1 : 0
    case 0x1e: return ['off', 'midi', 'usb'].indexOf(s.thruSource)
    case 0x1f: return ['usb', 'stdl', 'mixed'].indexOf(s.operationMode)
    case 0x30: { const i = routing.indexOf(s.outputRouting); return i < 0 ? null : i }
    case 0x1d: {
      if (s.thruDestination === 'Off') return 0
      const i = ['MIDI A', 'MIDI B', 'MIDI A & B'].indexOf(s.thruDestination)
      return i < 0 ? null : (s.thruFiltered ? 1 : 4) + i
    }
    default: return s.deviceValues?.[hexKey(cmd)] ?? null
  }
}
// Settings with one value changed, written to the same place valueOf reads it from.
export function withValue(cmd: number, value: number, s: ControllerSettings): ControllerSettings {
  const fromDevice = settingsFromDevice([{ cmd, name: '', value, label: null, status: 'value' }])
  if (mapped.has(cmd)) {
    if (cmd === 0x1b || cmd === 0x1c) {
      const modes = [...s.footswitchModes] as ControllerSettings['footswitchModes']
      modes[cmd === 0x1b ? 0 : 1] = value ? 'zaq' : 'ctrl'
      return { ...s, footswitchModes: modes }
    }
    return { ...s, ...fromDevice }
  }
  return { ...s, deviceValues: { ...s.deviceValues, [hexKey(cmd)]: value } }
}
