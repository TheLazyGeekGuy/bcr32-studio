import { integer, isFrame, midiFrame } from './firmware-codec'

export function bclLine(index: number, text: string): number[] {
  integer(index, 0, 16383)
  if (text.length > 600 || /[^\x20-\x7e\t]/.test(text)) throw Error('BCL requires ASCII lines of at most 600 bytes')
  return midiFrame(0x20, [index >> 7, index & 127, ...Array.from(text, c => c.charCodeAt(0))])
}
export function bclFile(text: string): number[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop() // terminal newline is not an additional protocol line
  if (!lines.length || lines.length > 16384) throw Error('Invalid BCL line count')
  return lines.flatMap((line, index) => bclLine(index, line))
}
export function bclText(frames: readonly number[][]): string {
  const lines: string[] = []
  for (const bytes of frames) {
    if (!isFrame(bytes) || bytes[6] !== 0x20 || bytes.length < 10 || bytes.length > 610) throw Error('Expected BCL line messages')
    const index = bytes[7] * 128 + bytes[8]
    if (index !== lines.length) throw Error('BCL line sequence mismatch')
    const line = String.fromCharCode(...bytes.slice(9, -1)); bclLine(index, line); lines.push(line)
  }
  if (!lines.length) throw Error('No BCL lines')
  return lines.join('\n')
}
export type BclResponse = { kind: 'status'; line: number; status: number } | { kind: 'name'; preset: number; name: string }
export function bclResponse(bytes: readonly number[]): BclResponse | null {
  if (!isFrame(bytes) || bytes[6] !== 0x21) return null
  if (bytes.length === 11) return { kind: 'status', line: bytes[7] * 128 + bytes[8], status: bytes[9] }
  if (bytes.length === 34 && bytes[7] === 0 && bytes[8] < 64) return { kind: 'name', preset: bytes[8], name: String.fromCharCode(...bytes.slice(9, 33)).trimEnd() }
  return null
}
export function bclQuery(kind: 'preset' | 'global' | 'names', preset = 0) {
  integer(preset, 0, 63)
  return midiFrame(kind === 'preset' ? 0x40 : kind === 'global' ? 0x41 : 0x42, kind === 'global' ? [] : [preset])
}
// Table at 0x08038154. Opcodes are internal .tx markers, not SysEx commands.
export const bclTokens = ['val', 'val0.6', 'val0', 'val0.3', 'val4.7', 'val8.11', 'val12.13', 'val7.13', 'val1.7', 'reloffs', 'relsign', 'rel2s', 'cks-1', 'cks-2', 'cks-3', 'ifp', 'ifn', 'ntimes']
