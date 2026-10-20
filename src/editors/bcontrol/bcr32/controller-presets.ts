import { bclLine, bclResponse, bclText } from './bcl'
import { integer, isFrame, midiFrame } from './firmware-codec'

// Selectors used by ControlTribe 1.11.3. Reads only; no recall or storage command.
export type PresetRead = { kind: 'names' } | { kind: 'working' } | { kind: 'all' } | { kind: 'global' } | { kind: 'slot'; slot: number }
export const isControllerPageRequest = (bytes: readonly number[]) => bytes.length === 8 && bytes.every((v, i) => v === [240, 0, 32, 50, 127, 100, 12, 247][i])
export function presetReadQuery(request: PresetRead) {
  if (request.kind === 'names') return midiFrame(0x42, [126])
  if (request.kind === 'global') return midiFrame(0x41)
  return midiFrame(0x40, [request.kind === 'working' ? 127 : request.kind === 'all' ? 126 : integer(request.slot, 0, 63)])
}
export type PresetReadResult = { status: 'complete' | 'timeout' | 'cancelled' | 'invalid'; request: PresetRead; names: Record<number, string>; frames: number[][]; text: string }
export function createPresetReader(send: (bytes: number[]) => void, device: number, timeout = 3000, progress: (count: number) => void = () => {}) {
  integer(device, 0, 126)
  let pending: { result: PresetReadResult; bytes: number; resolve: (r: PresetReadResult) => void; timer: ReturnType<typeof setTimeout>; deadline: ReturnType<typeof setTimeout> } | null = null
  let closed = false
  function finish(status: PresetReadResult['status']) {
    if (!pending) return
    const p = pending; pending = null; clearTimeout(p.timer); clearTimeout(p.deadline)
    p.resolve({ ...p.result, status })
  }
  function arm() {
    if (!pending) return
    clearTimeout(pending.timer); pending.timer = setTimeout(() => finish('timeout'), timeout)
  }
  return {
    read(request: PresetRead, enterController = true): Promise<PresetReadResult> {
      const bytes = presetReadQuery(request)
      if (closed || pending) return Promise.resolve({ status: 'cancelled', request, names: {}, frames: [], text: '' })
      return new Promise((resolve, reject) => {
        pending = { result: { status: 'timeout', request, names: {}, frames: [], text: '' }, bytes: 0, resolve, timer: setTimeout(() => finish('timeout'), timeout), deadline: setTimeout(() => finish('timeout'), 45000) }
        try { if (enterController) send(midiFrame(0x0c)); send(bytes) } catch (error) { clearTimeout(pending.timer); clearTimeout(pending.deadline); pending = null; reject(error) }
      })
    },
    receive(bytes: readonly number[]) {
      if (!pending || !isFrame(bytes) || bytes[4] !== device) return false
      const result = pending.result
      if (result.request.kind === 'names') {
        const response = bclResponse(bytes)
        if (response?.kind !== 'name') return false
        if (/[^\x20-\x7e]/.test(response.name) || Object.hasOwn(result.names, response.preset)) { finish('invalid'); return true }
        result.names[response.preset] = response.name
        progress(Object.keys(result.names).length); arm()
        if (Object.keys(result.names).length === 64) finish('complete')
        return true
      }
      if (bytes[6] !== 0x20) return false
      try {
        if (result.frames.length >= 16384 || pending.bytes + bytes.length > 4 * 1024 * 1024 || bytes.length < 10 || bytes.length > 610 || bytes[7] * 128 + bytes[8] !== result.frames.length) throw Error('BCL limit or sequence')
        const line = String.fromCharCode(...bytes.slice(9, -1))
        bclLine(result.frames.length, line)
        result.frames.push([...bytes]); pending.bytes += bytes.length
        progress(result.frames.length); arm()
        if (line.trim().toLowerCase() === '$end') { result.text = bclText(result.frames); finish('complete') }
      } catch { finish('invalid') }
      return true
    },
    cancel() { finish('cancelled') },
    close() { closed = true; finish('cancelled') },
  }
}
