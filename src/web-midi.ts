export interface MidiPort {
  id: string
  name?: string | null
  manufacturer?: string | null
  state?: string
  onmidimessage: ((event: { data: Uint8Array }) => void) | null
  send?(message: number[]): void
}

export interface MidiAccess {
  sysexEnabled: boolean
  inputs: Map<string, MidiPort>
  outputs: Map<string, MidiPort>
  onstatechange: (() => void) | null
}

type MidiNavigator = Navigator & {
  requestMIDIAccess?: (options: { sysex: boolean }) => Promise<MidiAccess>
}

export const productQuery = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0xf7]

export const supportsWebMidi = () => typeof navigator !== 'undefined' &&
  typeof (navigator as MidiNavigator).requestMIDIAccess === 'function'

export const requestMidiAccess = async (sysex = false) => {
  const request = (navigator as MidiNavigator).requestMIDIAccess
  if (!request) throw new Error('Web MIDI is unavailable in this browser.')
  return request.call(navigator, { sysex })
}
export const requestSysexAccess = () => requestMidiAccess(true)

export const asHex = (message: ArrayLike<number>) =>
  Array.from(message, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')

// Single-byte System Real-Time (F8 clock … FE active sensing, FF reset): never worth a log line or a render.
export const isSystemRealtime = (message: ArrayLike<number>) => message.length === 1 && message[0] >= 0xf8

export const describeMessage = (message: ArrayLike<number>) => {
  const data = Array.from(message)
  if (data.length >= 8 && data.slice(0, 7).every((byte, index) => productQuery[index] === byte)) {
    return 'BCR-32 SysEx — product reply or query'
  }
  if ((data[0] & 0xf0) === 0xb0 && data.length >= 3) {
    return `CC channel ${(data[0] & 0x0f) + 1} · ${data[1]} → ${data[2]}`
  }
  return 'Raw MIDI message'
}

// Reply to productQuery. Single observed sample:
// F0 00 20 32 7F 64 00 01 00 00 00 38 00 F7, shown by ControlTribe as v0.56.0.
// Payload after the 7-byte header is 01 <p1> <p2> <p3> <p4> <p5>; 0x38 = 56 is the
// only non-zero byte, so the layout major=p1, minor=p4, patch=p5 is a hypothesis
// that fits this one sample, not a documented field map.
export const parseFirmwareReply = (message: ArrayLike<number>): string | null => {
  const data = Array.from(message)
  if (data.length < 14 || data[13] !== 0xf7) return null
  if (!productQuery.slice(0, 7).every((byte, index) => data[index] === byte)) return null
  const payload = data.slice(7, 13)
  if (payload[0] !== 0x01 || payload.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 127)) return null
  return `${payload[1]}.${payload[4]}.${payload[5]}`
}
