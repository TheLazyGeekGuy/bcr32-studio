import { integer, isFrame, midiFrame } from './firmware-codec'

export interface ZaqBlock { device: number; kind: number; bank: number; page: number; block: number; data: number[] }
export interface ZaqPattern { identity: string; blocks: ZaqBlock[]; data: number[] }
export function decodeZaqBlock(bytes: readonly number[]): ZaqBlock | null {
  if (bytes.length !== 273 || !isFrame(bytes) || bytes[6] !== 4 || bytes[7] !== 11 || bytes[8] > 3 || bytes[10] > 15 || bytes[11] > (bytes[8] === 3 ? 1 : 7) || bytes.slice(12, 272).some(v => v > 15)) return null
  const checksum = bytes.slice(268, 272).reduce((n, v) => n * 16 + v, 0)
  if ((bytes.slice(0, 268).reduce((n, v) => n + v, 0) & 65535) !== checksum) return null
  return { device: bytes[4], kind: bytes[8], bank: bytes[9], page: bytes[10], block: bytes[11], data: Array.from({ length: 128 }, (_, i) => bytes[12 + i * 2] * 16 + bytes[13 + i * 2]) }
}
// File builder only; never wired to a MIDI sender.
export function zaqBlockFile(b: ZaqBlock): number[] {
  integer(b.device, 0, 127); integer(b.kind, 0, 3); integer(b.bank, 0, 127); integer(b.page, 0, 15); integer(b.block, 0, b.kind === 3 ? 1 : 7)
  if (b.data.length !== 128) throw Error('Invalid block length')
  const nibbles = b.data.flatMap(v => { integer(v, 0, 255); return [v >> 4, v & 15] })
  const head = midiFrame(4, [11, b.kind, b.bank, b.page, b.block, ...nibbles], b.device).slice(0, -1)
  const sum = head.reduce((n, v) => n + v, 0) & 65535
  return [...head, ...[12, 8, 4, 0].map(shift => sum >> shift & 15), 247]
}
export const blockIdentity = (b: ZaqBlock) => [b.device, b.kind, b.bank, b.page].join(':')
// Consume chronological messages; restart only that destination on block 0.
// Never combine partial exports from different sessions, ports, kinds or destinations.
export function createZaqAssembler() {
  const pending = new Map<string, ZaqBlock[]>()
  return {
    receive(b: ZaqBlock): ZaqPattern | null {
      if (b.kind === 3) return null // preserved as raw messages, not interpreted as a pattern
      const key = blockIdentity(b), blocks = b.block === 0 ? [] : pending.get(key)
      if (!blocks || b.block !== blocks.length) { pending.delete(key); return null }
      blocks.push({ ...b, data: [...b.data] })
      if (blocks.length === 8) { pending.delete(key); return { identity: key, blocks, data: blocks.flatMap(v => v.data) } }
      if (pending.size >= 192 && !pending.has(key)) pending.delete(pending.keys().next().value!)
      pending.set(key, blocks); return null
    },
    reset() { pending.clear() },
  }
}
export type ZaqStep = { note: number; velocity: number; delay: number; gate: number; alpha: number; beta: number; voices: number; rest: boolean; mask: boolean }
function checkPattern(data: readonly number[]) { if (data.length !== 1024) throw Error('Expected a four-track pattern'); data.forEach(v => integer(v, 0, 255)) }
function position(track: number, step: number) { return integer(track, 0, 3) * 256 + integer(step, 0, 31) }
const u32 = (data: readonly number[], p: number) => (data[p] | data[p + 1] << 8 | data[p + 2] << 16 | data[p + 3] << 24) >>> 0
export function readStep(data: readonly number[], track: number, step: number): ZaqStep {
  checkPattern(data); const pos = position(track, step), base = pos - step, delay = data[base + 80 + step]
  return { note: data[base + 16 + step], velocity: data[base + 48 + step] & 127, delay: delay >= 128 ? delay - 256 : delay,
    gate: step < 24 ? data[base + 112 + (step >> 1)] >> ((step & 1) * 4) & 15 : [0, 1, 2, 3].reduce((v, i) => v | (data[base + 48 + (step - 24) * 4 + i] >> 7) << i, 0),
    alpha: data[base + 124 + step], beta: data[base + 156 + step], voices: data[base + 188 + 2 * step] | data[base + 189 + 2 * step] << 8,
    rest: !!(u32(data, base + 252) & 1 << step), mask: !!(u32(data, base) & 1 << step) }
}
export function patchStep(data: readonly number[], track: number, step: number, patch: Partial<ZaqStep>): number[] {
  checkPattern(data); const pos = position(track, step), base = pos - step, result = [...data]
  const ranges: Record<keyof ZaqStep, [number, number]> = { note: [0, 127], velocity: [0, 127], delay: [-127, 127], gate: [0, 15], alpha: [0, 255], beta: [0, 255], voices: [0, 65535], rest: [0, 1], mask: [0, 1] }
  for (const [rawKey, value] of Object.entries(patch)) {
    if (!(rawKey in ranges)) throw Error('Unknown step field')
    const key = rawKey as keyof ZaqStep
    if (key === 'rest' || key === 'mask') { if (typeof value !== 'boolean') throw Error('Expected step flag') } else integer(value as number, ...ranges[key])
    const v = Number(value)
    if (key === 'gate') {
      if (step < 24) { const p = base + 112 + (step >> 1), shift = (step & 1) * 4; result[p] = result[p] & ~(15 << shift) | v << shift }
      else for (let i = 0; i < 4; i++) { const p = base + 48 + (step - 24) * 4 + i; result[p] = result[p] & 127 | (v >> i & 1) << 7 }
    } else if (key === 'rest' || key === 'mask') {
      const p = base + (key === 'rest' ? 252 : 0), word = u32(result, p) & ~(1 << step) | v << step
      for (let i = 0; i < 4; i++) result[p + i] = word >>> (8 * i) & 255
    } else if (key === 'voices') { result[base + 188 + step * 2] = v & 255; result[base + 189 + step * 2] = v >> 8 }
    else if (key === 'velocity') result[base + 48 + step] = result[base + 48 + step] & 128 | v
    else result[base + ({ note: 16, delay: 80, alpha: 124, beta: 156 } as const)[key] + step] = v & 255
  }
  return result
}
export function patternFile(pattern: ZaqPattern, data: readonly number[] = pattern.data): number[] {
  checkPattern(data)
  if (pattern.blocks.length !== 8 || pattern.blocks.some((b, i) => b.block !== i || b.kind === 3 || blockIdentity(b) !== pattern.identity)) throw Error('Incomplete pattern')
  return pattern.blocks.flatMap((b, i) => zaqBlockFile({ ...b, data: data.slice(i * 128, (i + 1) * 128) }))
}
