// Read-only view of the BCR32 global settings (docs/PROTOCOL.md, "Global settings").
// Each read is the exact request the official editor sends at every connection: F0 00 20 32 7F 64 <cmd> F7.
// The device answers F0 00 20 32 7F 64 <cmd> <value> F7. Nothing here writes to the device.
const prefix = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64]
const routing = ['Off', 'A', 'B', 'A+B', 'USB', 'USB+A', 'USB+B', 'USB+A+B']

// Order = the official editor's own read order. Choice labels come from the editor's option lists; they are not
// hardware-verified one by one, so the raw value is always shown next to them.
export const deviceGlobals: { cmd: number; name: string; choices?: string[] }[] = [
  { cmd: 0x74, name: 'Bootloader status' },
  { cmd: 0x1b, name: 'Footswitch 1' },
  { cmd: 0x1c, name: 'Footswitch 2' },
  { cmd: 0x1e, name: 'MIDI thru source', choices: ['Off', 'MIDI in', 'USB in'] },
  { cmd: 0x1d, name: 'MIDI thru destination' },
  { cmd: 0x1f, name: 'Operating mode', choices: ['USB', 'Standalone', 'Mixed'] },
  { cmd: 0x40, name: 'LED brightness' },
  { cmd: 0x30, name: 'Controller output port', choices: routing },
  { cmd: 0x17, name: 'Start on' },
  { cmd: 0x18, name: 'Clock rate out' },
  { cmd: 0x20, name: 'Sync mode' },
  { cmd: 0x21, name: 'Clock output port', choices: routing },
  { cmd: 0x23, name: 'Scale' },
  { cmd: 0x24, name: 'Scale base' },
  { cmd: 0x25, name: 'Transpose mode' },
  { cmd: 0x26, name: 'Trigger mode' },
  { cmd: 0x27, name: 'Quantization mode' },
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
