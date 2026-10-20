// Static analysis of BCR32 application 1.0.2; see docs/FIRMWARE-1.0.2.md.
// Pure byte/file codecs only. No MIDI writes or hardware access.
export function integer(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw Error('Invalid byte or field value')
  return value
}
export function midiFrame(command: number, payload: readonly number[] = [], device = 127): number[] {
  const interior = [integer(device, 0, 127), 100, integer(command, 0, 127), ...payload]
  interior.forEach(v => integer(v, 0, 127))
  return [240, 0, 32, 50, ...interior, 247]
}
export function isFrame(bytes: readonly number[]): boolean {
  return bytes.length >= 8 && [240, 0, 32, 50].every((v, i) => bytes[i] === v) && bytes[5] === 100 && bytes.at(-1) === 247 && bytes.slice(1, -1).every(v => Number.isInteger(v) && v >= 0 && v < 128)
}
export function pack7(raw: readonly number[]): number[] {
  const result: number[] = []
  for (let j = 0; j < raw.length; j += 7) {
    const chunk = raw.slice(j, j + 7).map(v => integer(v, 0, 255))
    result.push(chunk.reduce((mask, v, i) => mask | (v >> 7) << i, 0), ...chunk.map(v => v & 127))
  }
  return result
}
export function unpack7(wire: readonly number[]): number[] {
  wire.forEach(v => integer(v, 0, 127))
  const result: number[] = []
  for (let j = 0; j < wire.length; j += 8) {
    const chunk = wire.slice(j, j + 8)
    if (chunk.length < 2 || chunk[0] >> (chunk.length - 1)) throw Error('Invalid packed MIDI data')
    result.push(...chunk.slice(1).map((v, i) => v | ((chunk[0] >> i) & 1) << 7))
  }
  return result
}
// Strict .syx splitting. Ignore only MIDI realtime bytes (which may occur inside SysEx).
export function splitSysex(data: ArrayLike<number>): number[][] {
  const frames: number[][] = []; let current: number[] | null = null
  if (data.length > 4 * 1024 * 1024) throw Error('File is too large')
  for (const raw of Array.from(data)) {
    const byte = integer(raw, 0, 255)
    if (byte >= 248) continue
    if (byte === 240) { if (current) throw Error('Nested SysEx message'); current = [byte] }
    else if (byte === 247) { if (!current) throw Error('Unexpected SysEx end'); frames.push([...current, byte]); current = null }
    else { if (!current || byte > 127) throw Error('Invalid SysEx file'); current.push(byte) }
  }
  if (current) throw Error('Incomplete SysEx message')
  if (!frames.length) throw Error('No SysEx messages')
  return frames
}
export const firmwareOne = (version: string | null) => !!version && /^\d+\.\d+\.\d+$/.test(version) && Number(version.split('.')[0]) === 1

export type TargetField = 'type' | 'channel' | 'parameter' | 'value1' | 'value2' | 'mode' | 'option' | 'display'
export const targetFields: TargetField[] = ['type', 'channel', 'parameter', 'value1', 'value2', 'mode', 'option', 'display']
export function targetQuery(index: number, field: TargetField) {
  const command = targetFields.indexOf(field)
  if (command < 0) throw Error('Unknown target field')
  return midiFrame(0x31 + command, [integer(index, 0, 81)])
}
// Sender boundary: these are the only new hardware requests allowed by the workbench.
export function isFirmwareRead(bytes: readonly number[]): boolean {
  if (!isFrame(bytes) || bytes[4] !== 127) return false
  if (bytes[6] >= 0x31 && bytes[6] <= 0x38) return bytes.length === 9 && bytes[7] < 82
  if (bytes[6] >= 0x29 && bytes[6] <= 0x2d) return bytes.length === 9 && bytes[7] < 4
  if (bytes[6] === 0x40) return bytes.length === 9 && (bytes[7] < 64 || bytes[7] === 126 || bytes[7] === 127)
  if (bytes[6] === 0x42) return bytes.length === 9 && (bytes[7] < 64 || bytes[7] === 126)
  return bytes[6] === 0x41 && bytes.length === 8
}
export const trackFields = ['mode', 'port', 'channel', 'alpha', 'beta'] as const
export type TrackField = typeof trackFields[number]
export function trackQuery(index: number, field: TrackField) {
  const position = trackFields.indexOf(field)
  if (position < 0) throw Error('Unknown track field')
  return midiFrame(0x29 + position, [integer(index, 0, 3)])
}
export type TrackValue = { index: number; field: TrackField; raw: number; signed: number; sentinel: boolean }
export function trackReply(bytes: readonly number[]): TrackValue | null {
  if (!isFrame(bytes) || bytes[6] < 0x29 || bytes[6] > 0x2d || bytes[7] > 3) return null
  const field = trackFields[bytes[6] - 0x29], packed = bytes[6] >= 0x2c
  if (bytes.length !== (packed ? 11 : 10)) return null
  let raw: number
  try { const data = packed ? unpack7(bytes.slice(8, -1)) : [bytes[8]]; if (data.length !== 1) return null; raw = data[0] } catch { return null }
  return { index: bytes[7], field, raw, signed: packed && raw >= 128 ? raw - 256 : raw, sentinel: false }
}
export type TargetValue = { index: number; field: TargetField; raw: number; signed: number; sentinel: boolean }
export function targetReply(bytes: readonly number[]): TargetValue | null {
  if (!isFrame(bytes) || bytes[6] < 0x31 || bytes[6] > 0x38 || bytes[7] > 81) return null
  const index = bytes[7], field = targetFields[bytes[6] - 0x31]
  const wide = ['parameter', 'value1', 'value2'].includes(field) || field === 'option' && index < 50
  if (bytes.length !== (wide ? 12 : 10)) return null // excludes query echoes
  let raw: number
  try { const data = wide ? unpack7(bytes.slice(8, -1)) : [bytes[8]]; if (data.length !== (wide ? 2 : 1)) return null; raw = wide ? data[0] * 256 + data[1] : data[0] } catch { return null }
  const signed = field === 'option' && index < 50 && raw >= 32768 ? raw - 65536 : raw
  return { index, field, raw, signed, sentinel: signed === raw && (raw === 0xf5a5 || raw === 0xfa5a || field === 'parameter' && raw === 65535) }
}

export type TargetReadResult = { status: 'value' | 'empty' | 'timeout' | 'cancelled'; value?: TargetValue }
// One explicit read at a time. No scan, auto retry, mutation, or queue surviving port changes.
export function createTargetReader(send: (bytes: number[]) => void, timeoutMs = 1200, replyDevice = 127) {
  return createParameterReader(send, targetQuery, targetReply, timeoutMs, replyDevice)
}
export function createTrackReader(send: (bytes: number[]) => void, timeoutMs = 1200, replyDevice = 127) {
  return createParameterReader(send, trackQuery, trackReply, timeoutMs, replyDevice)
}
function createParameterReader<Field extends string, Value extends { index: number; field: Field }>(send: (bytes: number[]) => void, query: (index: number, field: Field) => number[], decode: (bytes: readonly number[]) => Value | null, timeoutMs: number, replyDevice: number) {
  integer(replyDevice, 0, 127)
  type Result = { status: 'value' | 'empty' | 'timeout' | 'cancelled'; value?: Value }
  let pending: { index: number; field: Field; timer: ReturnType<typeof setTimeout>; resolve: (r: Result) => void } | null = null
  let closed = false
  const settle = (result: Result) => { if (!pending) return; const p = pending; pending = null; clearTimeout(p.timer); p.resolve(result) }
  return {
    read(index: number, field: Field): Promise<Result> {
      const bytes = query(index, field)
      if (closed || pending) return Promise.resolve({ status: 'cancelled' })
      return new Promise((resolve, reject) => {
        pending = { index, field, resolve, timer: setTimeout(() => settle({ status: 'timeout' }), timeoutMs) }
        try { send(bytes) } catch (error) { if (pending) clearTimeout(pending.timer); pending = null; reject(error) }
      })
    },
    receive(bytes: readonly number[]) {
      if (!pending || bytes[4] !== replyDevice) return false
      const value = decode(bytes)
      if (value && value.index === pending.index && value.field === pending.field) { settle({ status: 'value', value }); return true }
      // Physical 1.0.2 sends addressed, payload-free replies for some unused fields. They are not values.
      // With a non-broadcast reply ID, this differs from our 7F query and cannot be its unchanged echo.
      const request = query(pending.index, pending.field)
      if (replyDevice !== 127 && isFrame(bytes) && bytes.length === request.length && bytes.every((b, i) => i === 4 || b === request[i])) { settle({ status: 'empty' }); return true }
      return false
    },
    close() { closed = true; settle({ status: 'cancelled' }) },
  }
}
