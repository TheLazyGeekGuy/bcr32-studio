import type { ControllerSettings } from './profile'

// Read-only view of the BCR32 global settings (docs/PROTOCOL.md, "Global settings").
// Each read is the exact request the official editor sends at every connection: F0 00 20 32 7F 64 <cmd> F7.
// The device answers F0 00 20 32 7F 64 <cmd> <value> F7. Nothing here writes to the device.
const prefix = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64]
// Option lists: the official editor's BCR32 lists, matched to each setting by value range and meaning (2026-10-12).
// Abbreviations spelled out: U = USB, A/B = MIDI A/B, F = filtered (thru), STDL = standalone.
const routing = ['Off', 'MIDI A', 'MIDI B', 'MIDI A & B', 'USB', 'USB & MIDI A', 'USB & MIDI B', 'USB & MIDI A & B']
const notes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const channels = Array.from({ length: 16 }, (_, i) => `CH ${i + 1}`)
const chRanges = Array.from({ length: 13 }, (_, i) => `CH ${i + 1}-${i + 4}`)

// Order = the official editor's own read order. Settings without a reliable list (range and list sizes differ) show
// their raw value only.
export const deviceGlobals: { cmd: number; name: string; choices?: string[] }[] = [
  { cmd: 0x74, name: 'Bootloader status' },
  { cmd: 0x1b, name: 'Footswitch 1', choices: ['CTRL', 'ZAQ'] },
  { cmd: 0x1c, name: 'Footswitch 2', choices: ['CTRL', 'ZAQ'] },
  { cmd: 0x1e, name: 'MIDI thru source', choices: ['Off', 'MIDI in', 'USB in'] },
  { cmd: 0x1d, name: 'MIDI thru destination', choices: ['Off', 'MIDI A (filtered)', 'MIDI B (filtered)', 'MIDI A & B (filtered)', 'MIDI A', 'MIDI B', 'MIDI A & B'] },
  { cmd: 0x1f, name: 'Operating mode', choices: ['USB', 'Standalone', 'Mixed'] },
  { cmd: 0x40, name: 'LED brightness' },
  { cmd: 0x30, name: 'Controller output port', choices: routing },
  { cmd: 0x17, name: 'Start on', choices: ['CTRL', 'ZAQ'] },
  { cmd: 0x18, name: 'Clock rate out', choices: ['1 PPQ', '2 PPQ', '4 PPQ', '24 PPQ', '48 PPQ'] },
  { cmd: 0x20, name: 'Sync mode', choices: ['Internal', 'Sync in', 'MIDI in', 'USB in'] },
  { cmd: 0x21, name: 'Clock output port' },
  { cmd: 0x23, name: 'Scale' },
  { cmd: 0x24, name: 'Scale base', choices: notes },
  { cmd: 0x25, name: 'Transpose mode', choices: ['Off', ...channels, 'Track', ...chRanges] },
  { cmd: 0x26, name: 'Trigger mode', choices: ['Off', ...channels] },
  { cmd: 0x27, name: 'Quantization mode', choices: ['96', 't32', '32', 't16', '16', 't8', '8', 't4', '4', 't2', '2', 't1bar', '1bar', 't2bar', '2bar', '4bar'] },
  { cmd: 0x28, name: 'Quantization mixer' },
]
// Hard safety rule: never STORE (0x72) nor bootloader/firmware (0x77).
if (deviceGlobals.some(g => g.cmd === 0x72 || g.cmd === 0x77)) throw Error('Forbidden SysEx command in the global reads')

export const globalQuery = (cmd: number) => [...prefix, cmd, 0xf7]
export type GlobalResult = { cmd: number; name: string; value: number | null; label: string | null; status: 'value' | 'echo' | 'no reply' }
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: t => clearTimeout(t as ReturnType<typeof setTimeout>) }

// Sequential reader: one request at a time, the next only after the reply or the timeout. receive() returns true when
// the message was the awaited reply (so the caller may skip other handlers if it wants).
export function createGlobalsReader(send: (bytes: number[]) => void, timeoutMs = 400, timers: Timers = realTimers) {
  let pending: { cmd: number; settle: (r: { value: number | null; status: GlobalResult['status'] }) => void; timer: unknown } | null = null
  let closed = false
  const ask = (cmd: number) => new Promise<{ value: number | null; status: GlobalResult['status'] }>(resolve => {
    const timer = timers.set(() => { pending = null; resolve({ value: null, status: 'no reply' }) }, timeoutMs)
    pending = { cmd, timer, settle: r => { timers.clear(timer); pending = null; resolve(r) } }
    send(globalQuery(cmd))
  })
  return {
    async read(): Promise<GlobalResult[]> {
      const results: GlobalResult[] = []
      for (const g of deviceGlobals) {
        if (closed) break
        const r = await ask(g.cmd)
        results.push({ cmd: g.cmd, name: g.name, value: r.value, status: r.status, label: r.value !== null && g.choices ? g.choices[r.value] ?? null : null })
      }
      return results
    },
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
