import type { Encoder, EncoderType } from './profile'

// Front-panel export of a Controller preset (docs/PROTOCOL.md, "Dump container"): 273 bytes,
// F0 00 20 32 7F 64 | 04 0C <type?> <page?> <preset?> <block 0–7> | 256 nibbles (128 bytes) | 4-nibble checksum | F7.
// Checksum: 16-bit sum of bytes 0–267, high nibble first. The 128 data bytes split into 11-byte records
// [type][channel][parameter LE16][minimum LE16][maximum LE16][mode][option][display] (hypothesis, consistent with captures).
// Read-only: nothing here sends anything to the device.
const header = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x04, 0x0c]
// Type byte, hypothesis except 2 = CC (observed). MMC does not fit in this enumeration.
const types: (EncoderType | null)[] = ['off', 'pc', 'cc', 'nrpn', 'pb', 'note', 'at', 'gs']

export type DumpRecord = { index: number; raw: number[]; type: EncoderType | null; channel: number; parameter: number; minimum: number; maximum: number; mode: number; option: number; display: number; plausible: boolean }
export type ControllerDump = { block: number; header: number[]; checksumOk: boolean; checksum: number; expected: number; data: number[]; records: DumpRecord[]; raw: number[] }

// Records whose control is established on hardware (differential tests): record 0 = encoder 1 (CC 10 -> 11 -> 16).
export const knownRecords: Record<number, { kind: 'encoders'; id: number }> = { 0: { kind: 'encoders', id: 1 } }

export const isControllerDump = (bytes: ArrayLike<number>) => bytes.length === 273 && header.every((v, i) => bytes[i] === v) && bytes[272] === 0xf7

export function decodeControllerDump(bytes: ArrayLike<number>): ControllerDump | null {
  if (!isControllerDump(bytes)) return null
  const raw = Array.from(bytes)
  for (let i = 12; i < 272; i++) if (raw[i] > 0x0f) return null // the payload and checksum are nibbles
  const data: number[] = []
  for (let i = 12; i < 268; i += 2) data.push((raw[i] << 4) | raw[i + 1])
  const checksum = raw.slice(268, 272).reduce((n, nibble) => (n << 4) | nibble, 0)
  const expected = raw.slice(0, 268).reduce((sum, b) => sum + b, 0) & 0xffff
  const records: DumpRecord[] = []
  for (let r = 0; r * 11 + 11 <= data.length; r++) {
    const b = data.slice(r * 11, r * 11 + 11)
    const le = (i: number) => b[i] | (b[i + 1] << 8)
    const record = { index: r, raw: b, type: types[b[0]] ?? null, channel: b[1] + 1, parameter: le(2), minimum: le(4), maximum: le(6), mode: b[8], option: b[9], display: b[10], plausible: false }
    // Uninitialised memory shows as A5 / F5 bytes: such a record is not a real assignment.
    record.plausible = record.type !== null && b[1] <= 15 && record.parameter <= 16383 && record.minimum <= 16383 && record.maximum <= 16383 && !b.includes(0xa5) && !b.includes(0xf5)
    records.push(record)
  }
  return { block: raw[11], header: raw.slice(0, 12), checksumOk: checksum === expected, checksum, expected, data, records, raw }
}

// The fields this import trusts: type, channel, parameter, range. Mode, option and display bytes stay unmapped.
export function applyRecord(encoder: Encoder, record: DumpRecord): Encoder {
  if (!record.plausible || !record.type) return encoder
  return { ...encoder, type: record.type, channel: record.channel, parameter: record.parameter, minimum: record.minimum, maximum: record.maximum }
}
