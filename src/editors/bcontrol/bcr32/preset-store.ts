import { bclLine, bclResponse } from './bcl'
import { integer, isFrame } from './firmware-codec'
import type { PresetRead, PresetReadResult } from './controller-presets'

// Physical 1.0.2: slot63 store + independent export matched; working contents restored, 2026-10-19.
// Persistence across a power cycle has not been tested.
export const presetStorageValidated = true
export function isBclWrite(bytes: readonly number[], device: number) {
  if (device === 127 || !isFrame(bytes) || bytes[4] !== device || bytes[6] !== 32 || bytes.length < 10 || bytes.length > 610) return false
  try { return bclLine(bytes[7] * 128 + bytes[8], String.fromCharCode(...bytes.slice(9, -1))).every((v, i) => i === 4 || v === bytes[i]) } catch { return false }
}

// $store <1..64> was captured in the BCR32's own complete bank export on firmware 1.0.2.
// Only a complete single-preset device export can enter this path. Global/recall/erase directives are excluded.
export function presetStorePlan(source: string, slot: number, name: string) {
  integer(slot, 0, 63)
  if (!name.trim() || name.length > 24 || /[^\x20-\x7e]|'/.test(name)) throw Error('Preset name requires 1–24 ASCII characters without quotes')
  const lines = source.split('\n')
  if (lines[0] !== '$rev BCR32' || lines[1] !== '$preset' || lines.at(-1) !== '$end' || lines.filter(l => l.trim() === '$preset').length !== 1 || lines.filter(l => /^\s*\.name /.test(l)).length !== 1) throw Error('A complete single hardware preset is required')
  for (const [index, line] of lines.entries()) {
    bclLine(index, line)
    const directive = line.trim()
    if (directive.startsWith('$') && !['$rev BCR32', '$preset', '$end'].includes(directive) && !/^\$encoder (?:[1-9]|[12]\d|3[0-2])$/.test(directive) && !/^\$button (?:[1-9]|[1-4]\d|50)$/.test(directive)) throw Error('Unexpected preset directive')
    if (directive === '$end' && index !== lines.length - 1 || directive === '$rev BCR32' && index !== 0) throw Error('Unexpected preset boundary')
  }
  const expected = lines.map(l => /^\s*\.name /.test(l) ? `  .name '${name.trim()}'` : l).join('\n')
  const transfer = expected.replace(/\n\$end$/, `\n$store ${slot + 1}\n$end`)
  return { slot, name: name.trim(), expected, lines: transfer.split('\n') }
}
export function createBclSender(send: (bytes: number[]) => void, device: number, timeout = 1500, gap = 15, authorize?: (frames:number[][])=>(()=>void)) {
  integer(device, 0, 126)
  let closed = false, running = false
  let pending: { line: number; timer: ReturnType<typeof setTimeout>; resolve: (status: number) => void } | null = null
  let gapTimer: ReturnType<typeof setTimeout> | null = null, release: (() => void) | null = null
  return {
    async transfer(lines: readonly string[], progress: (count: number) => void = () => {}) {
      if (closed || running || !lines.length || lines.length > 16384) throw Error('BCL sender unavailable')
      const frames = lines.map((line, index) => { const frame = bclLine(index, line); frame[4] = device; return frame })
      const revoke=authorize?.(frames)
      running = true
      try {
        for (const [index, frame] of frames.entries()) {
          if (closed) throw Error('BCL transfer cancelled; partial hardware changes may remain')
          const status = await new Promise<number>((resolve, reject) => {
            pending = { line: index, resolve, timer: setTimeout(() => { pending = null; resolve(-1) }, timeout) }
            try { send(frame) } catch (error) { clearTimeout(pending.timer); pending = null; reject(error) }
          })
          if (status !== 0) throw Error(`BCL line ${index + 1} not acknowledged (${status}); transfer stopped`)
          progress(index + 1)
          await new Promise<void>(resolve => { release = resolve; gapTimer = setTimeout(() => { release = null; gapTimer = null; resolve() }, gap) })
        }
      } finally { revoke?.(); running = false }
    },
    receive(bytes: readonly number[]) {
      if (!pending || !isFrame(bytes) || bytes[4] !== device) return false
      const reply = bclResponse(bytes)
      if (reply?.kind !== 'status' || reply.line !== pending.line) return false
      const p = pending; pending = null; clearTimeout(p.timer); p.resolve(reply.status); return true
    },
    close() {
      closed = true
      if (pending) { const p = pending; pending = null; clearTimeout(p.timer); p.resolve(-2) }
      if (gapTimer) clearTimeout(gapTimer); gapTimer = null; release?.(); release = null
    },
  }
}

export type HardwarePresetStorePlan = ReturnType<typeof presetStorePlan>
export async function storeHardwarePreset({ read, transfer, backup, source, slot, name, onAcknowledged }: {
  read: (request: PresetRead) => Promise<PresetReadResult>
  transfer: (lines: readonly string[]) => Promise<void>
  backup: (contents: string) => void
  source: 'working' | number; slot: number; name: string
  onAcknowledged?: (plan: HardwarePresetStorePlan) => void
}) {
  async function complete(request: PresetRead) {
    const result = await read(request)
    if (result.status !== 'complete') throw Error('Complete hardware read required; transfer stopped. See the retained backup if import has started.')
    return result.text
  }
  const working = await complete({ kind: 'working' })
  presetStorePlan(working, slot, name) // Validate the restoration source before any mutation as well.
  const contents = source === 'working' ? working : await complete({ kind: 'slot', slot: source })
  const plan = presetStorePlan(contents, slot, name)
  const destination = await complete({ kind: 'slot', slot })
  // Storage must be durable and checked by the caller before the first import line.
  backup(JSON.stringify({ at: new Date().toISOString(), slot, working, destination, proposed: plan.expected }))
  await transfer(plan.lines)
  onAcknowledged?.(plan)
  const stored = await complete({ kind: 'slot', slot })
  if (stored !== plan.expected) throw Error('Stored preset differs; backup retained. Working preset may have changed.')
  await transfer(working.split('\n'))
  const restored = await complete({ kind: 'working' })
  if (restored !== working) throw Error('Preset stored, but working preset restoration differs; backup retained.')
  if (await complete({ kind: 'slot', slot }) !== plan.expected) throw Error('Stored preset differs after working restoration; backup retained.')
  return plan
}
