import type { DeviceDefinition } from './device-definition'

// Reading a B-Control (BCR2000 / BCF2000) over SysEx: identity, one preset, the global setup, the preset names.
// Requests only (commands 01, 40, 41, 42); the replies are BCL lines (command 20) or names (command 21). Nothing here
// can change the device: no BCL is ever sent (command 20), no firmware (34). Source: third-party "B-Control MIDI
// Implementation" 1.2.9; not yet checked on a unit.
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (timer: unknown) => void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: t => clearTimeout(t as ReturnType<typeof setTimeout>) }
export const readCommands = [0x01, 0x40, 0x41, 0x42, 0x43] as const
export type BcIdentity = { text: string; model: string; firmware: string | null; deviceId: number }
export type BcChain = { lines: string[]; issues: string[]; complete: boolean }
export type PresetName = { slot: number | null; name: string }

const head = (device: DeviceDefinition, deviceId = 0x7f) => [0xf0, ...device.sysex.manufacturer, deviceId, device.sysex.model]
export function bcRequest(device: DeviceDefinition, command: typeof readCommands[number], data: number[] = []) {
  if (!readCommands.includes(command)) throw Error('Not a read request')
  if (!device.bclModel || data.some(b=>!Number.isInteger(b)||b<0||b>127)) throw Error('Invalid B-Control read request')
  return [...head(device), command, ...data, 0xf7]
}
export const identityRequest = (device: DeviceDefinition) => bcRequest(device, 0x01)
// slot: 1–32 memory preset, 'temporary' the preset being played (edits included), 'all' global setup + filled presets.
export const presetRequest = (device: DeviceDefinition, slot: number | 'temporary' | 'all') => {
  if(typeof slot==='number'&&(!Number.isInteger(slot)||slot<1||slot>32))throw Error('Invalid preset slot')
  return bcRequest(device, 0x40, [slot === 'temporary' ? 0x7f : slot === 'all' ? 0x7e : slot - 1])
}
export const globalRequest = (device: DeviceDefinition) => bcRequest(device, 0x41)
export const namesRequest = (device: DeviceDefinition) => bcRequest(device, 0x42, [0x7e])
export const snapshotRequest = (device: DeviceDefinition) => bcRequest(device,0x43)

// A message from this model: F0 00 20 32 <device 00–0F> <model> <command> … F7 (a device always sends its own model).
function fromModel(device: DeviceDefinition, bytes: ArrayLike<number>) {
  return bytes.length >= 8 && bytes[0] === 0xf0 && bytes[bytes.length - 1] === 0xf7 && Array.from(bytes).slice(1,-1).every(b=>Number.isInteger(b)&&b>=0&&b<=127) && device.sysex.manufacturer.every((b, i) => bytes[i + 1] === b) && bytes[4] <= 0x0f && bytes[5] === device.sysex.model
}
const text = (bytes: ArrayLike<number>, from: number, to: number) => String.fromCharCode(...Array.from(bytes).slice(from, to).filter(c => c >= 32 && c <= 127))
export function parseIdentity(device: DeviceDefinition, bytes: ArrayLike<number>): BcIdentity | null {
  if (!fromModel(device, bytes) || bytes[6] !== 0x02) return null
  const s = text(bytes, 7, bytes.length - 1).trim(), m = /^(\S+)(?:\s+(\S+))?/.exec(s)
  return m ? { text: s, model: m[1], firmware: m[2] ?? null, deviceId: bytes[4] + 1 } : null
}

export function createBcReader(device: DeviceDefinition, send: (bytes: number[]) => void, idleMs = 1500, timers: Timers = realTimers, deviceId?: number) {
  if(deviceId!==undefined&&(!Number.isInteger(deviceId)||deviceId<1||deviceId>16))throw Error('Invalid device ID')
  const addressed=(bytes:number[])=>deviceId===undefined?bytes:bytes.map((b,i)=>i===4?deviceId-1:b)
  type Pending = { kind: 'chain' | 'identity' | 'names'; settle: (value: unknown) => void; timer: unknown; lines: string[]; issues: string[]; expected: number; names: PresetName[] }
  let pending: Pending | null = null, closed = false
  let queue: Promise<unknown> = Promise.resolve(), queued=0
  function serial<T>(job: () => Promise<T>): Promise<T> { queued++;const next = queue.then(job, job).finally(()=>{queued--}); queue = next.catch(() => {}); return next }
  // The reply is over at $end (a chain), at 32 names, or after idleMs of silence: then what came is returned as incomplete.
  const finish = (complete: boolean) => {
    if (!pending) return
    const p = pending; pending = null; timers.clear(p.timer)
    if (p.kind === 'chain') p.settle({ lines: p.lines, issues: complete ? p.issues : [...p.issues, p.lines.length ? 'Reply incomplete: no $end received' : 'No reply'], complete } satisfies BcChain)
    else if (p.kind === 'names') p.settle(p.names)
    else p.settle(null)
  }
  const restart = () => { if (!pending) return; timers.clear(pending.timer); pending.timer = timers.set(() => finish(false), idleMs) }
  function exchange<T>(kind: Pending['kind'], bytes: number[]) {
    return serial(() => new Promise<T>(resolve => {
      if (closed) { resolve((kind === 'chain' ? { lines: [], issues: ['Reader closed'], complete: false } : kind === 'names' ? [] : null) as T); return }
      pending = { kind, settle: v => resolve(v as T), timer: null, lines: [], issues: [], expected: 0, names: [] }
      restart(); try { send(addressed(bytes)) } catch { finish(false) }
    }))
  }
  return {
    identify: () => exchange<BcIdentity | null>('identity', identityRequest(device)),
    readPreset: (slot: number | 'temporary') => exchange<BcChain>('chain', presetRequest(device, slot)),
    readGlobal: () => exchange<BcChain>('chain', globalRequest(device)),
    readAll: () => exchange<BcChain>('chain', presetRequest(device,'all')),
    readNames: () => exchange<PresetName[]>('names', namesRequest(device)),
    requestSnapshot() {if(closed||pending||queued)throw Error('Reader busy or closed');send(addressed(snapshotRequest(device)))},
    // Returns true when the message belonged to the request in progress.
    receive(bytes: ArrayLike<number>): boolean {
      if (!pending || !fromModel(device, bytes) || deviceId!==undefined&&bytes[4]!==deviceId-1) return false
      const command = bytes[6]
      if (pending.kind === 'identity' && command === 0x02) { const id = parseIdentity(device, bytes); const p = pending; pending = null; timers.clear(p.timer); p.settle(id); return true }
      if (pending.kind === 'chain' && command === 0x20 && bytes.length >= 10) {
        if(pending.lines.length>=65536){pending.issues.push('Reply exceeds line budget');finish(false);return true}
        const index = bytes[7] << 7 | bytes[8], line = text(bytes, 9, bytes.length - 1)
        if (index !== pending.expected) pending.issues.push(`Line index ${index} where ${pending.expected} was expected`)
        pending.expected = (index + 1)&16383; pending.lines.push(line); restart()
        if (line.trim() === '$end') finish(true)
        return true
      }
      // Send Preset Name: 21 00 <preset index or 7F> <24 characters>.
      if (pending.kind === 'names' && command === 0x21 && bytes.length === 34 && bytes[7] === 0x00 && bytes[8]<=31) {
        const slot=bytes[8]+1
        if(!pending.names.some(n=>n.slot===slot))pending.names.push({ slot, name: text(bytes, 9, bytes.length - 1).trimEnd() }); restart()
        if (pending.names.length >= 32) finish(true)
        return true
      }
      return false
    },
    close() { closed = true; finish(false) },
  }
}
export type BcReader = ReturnType<typeof createBcReader>
