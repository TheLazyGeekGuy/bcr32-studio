// Standard MIDI File import/export for the BCR32 sequencer view. Pure bytes: no DOM, no MIDI I/O, no dependencies.
// Channels are 0-15 throughout; only display names use 1-16.
export interface MidiNote { tick: number; duration: number; note: number; velocity: number; channel: number }
export interface MidiTrack { index: number; name: string; channels: number[]; notes: MidiNote[] }
export interface MidiFile { format: number; ppq: number; tracks: MidiTrack[]; tempoBpm?: number }
export interface SequencerStep { note: number; velocity: number; delay: number; lengthSteps: number }
export interface StepImport { steps: (SequencerStep | null)[]; chordsDropped: number; beyond: number; delayClamped: number }
export type ExportStep = Pick<SequencerStep, 'note' | 'velocity' | 'lengthSteps'>
export interface ExportTrack { name: string; channel: number; steps: readonly (ExportStep | null)[] }

const MAX_BYTES = 4 * 1024 * 1024, MAX_TRACKS = 512, MAX_TICK = 0x0fffffff, MAX_STEPS = 4096
function whole(value: number, min: number, max: number, what: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw Error(`${what} must be an integer from ${min} to ${max}`)
  return value
}
const ascii = (b: Uint8Array, p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3])
function text(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return Array.from(bytes, c => String.fromCharCode(c)).join('') } // older files use Latin-1
}

function parseTrack(data: Uint8Array, index: number) {
  const notes: MidiNote[] = [], open = new Map<number, { tick: number; velocity: number }[]>()
  const fail = (why: string): never => { throw Error(`MIDI track ${index + 1}: ${why}`) }
  let p = 0, tick = 0, status = 0, name: string | undefined, tempo: { tick: number; bpm: number } | undefined
  const byte = () => p < data.length ? data[p++] : fail('event runs past the end of the chunk (truncated)')
  const data7 = () => { const b = byte(); return b < 128 ? b : fail(`status byte ${b} where a data byte was expected`) }
  const vlq = () => { let v = 0; for (let i = 0; i < 4; i++) { const b = byte(); v = v * 128 + (b & 127); if (b < 128) return v } return fail('variable-length value longer than 4 bytes') }
  const skip = (what: string) => { const length = vlq(); if (p + length > data.length) fail(`${what} runs past the end of the chunk (truncated)`); return data.subarray(p, p += length) }
  // FIFO per channel and pitch: overlapping same-pitch notes end in the order they started.
  const close = (key: number, at: number) => { const on = open.get(key)?.shift(); if (on) notes.push({ tick: on.tick, duration: at - on.tick, note: key & 127, velocity: on.velocity, channel: key >> 7 }) }
  while (p < data.length) {
    if ((tick += vlq()) > MAX_TICK) fail('tick position overflows')
    if (p >= data.length) fail('event runs past the end of the chunk (truncated)')
    let s = data[p]
    if (s & 128) p++; else if (status) s = status; else fail('data byte without a status byte (no running status)')
    if (s === 0xff) {
      const type = byte(), body = skip('meta event')
      if (type === 0x2f) break
      if (type === 0x03 && name === undefined) name = text(body)
      if (type === 0x51) {
        if (body.length !== 3) fail('tempo meta event must hold 3 bytes')
        const us = body[0] << 16 | body[1] << 8 | body[2]
        if (!us) fail('tempo of 0 microseconds per quarter note')
        tempo ??= { tick, bpm: 60e6 / us }
      }
    } else if (s === 0xf0 || s === 0xf7) skip('SysEx event') // not sequencer data
    else if (s > 0xf0) fail(`status 0x${s.toString(16)} is not allowed in a MIDI file`)
    else {
      status = s
      const kind = s >> 4, a = data7(), b = kind === 0xc || kind === 0xd ? 0 : data7(), key = (s & 15) << 7 | a
      if (kind === 0x9 && b > 0) { const q = open.get(key); if (q) q.push({ tick, velocity: b }); else open.set(key, [{ tick, velocity: b }]) }
      else if (kind === 0x8 || kind === 0x9) close(key, tick)
    }
  }
  for (const [key, q] of open) while (q.length) close(key, tick) // a missing note-off ends at the end of the track
  notes.sort((x, y) => x.tick - y.tick || x.channel - y.channel || x.note - y.note)
  const track: MidiTrack = { index, name: name ?? `Track ${index + 1}`, channels: [...new Set(notes.map(n => n.channel))].sort((x, y) => x - y), notes }
  return { track, tempo }
}

export function parseMidiFile(bytes: Uint8Array): MidiFile {
  if (!(bytes instanceof Uint8Array)) throw Error('Expected the MIDI file as bytes')
  if (bytes.length > MAX_BYTES) throw Error('MIDI file is larger than 4 MB')
  if (bytes.length < 14 || ascii(bytes, 0) !== 'MThd') throw Error('Not a Standard MIDI File (missing MThd header)')
  const u16 = (p: number) => bytes[p] << 8 | bytes[p + 1], u32 = (p: number) => (u16(p) << 16 | u16(p + 2)) >>> 0
  const headerLength = u32(4)
  if (headerLength < 6 || 8 + headerLength > bytes.length) throw Error('Truncated MIDI file header')
  const format = u16(8), count = u16(10), ppq = u16(12)
  if (format > 2) throw Error(`Unsupported MIDI file format ${format}`)
  if (ppq & 0x8000) throw Error('SMPTE time division is not supported; export the file with ticks per quarter note')
  if (!ppq) throw Error('MIDI file has a time division of 0 ticks')
  if (count > MAX_TRACKS) throw Error(`MIDI file declares ${count} tracks; at most ${MAX_TRACKS} are supported`)
  if (!count || format === 0 && count !== 1) throw Error(`MIDI format ${format} file cannot declare ${count} tracks`)
  const tracks: MidiTrack[] = []
  let p = 8 + headerLength, tempo: { tick: number; bpm: number } | undefined
  while (tracks.length < count) {
    if (p + 8 > bytes.length) throw Error(`Truncated MIDI file: ${count} tracks declared, ${tracks.length} found`)
    const id = ascii(bytes, p), length = u32(p + 4), start = p + 8
    if (start + length > bytes.length) throw Error(`Truncated MIDI file: chunk ${JSON.stringify(id)} declares ${length} bytes, ${bytes.length - start} remain`)
    if (id === 'MTrk') {
      const t = parseTrack(bytes.subarray(start, start + length), tracks.length)
      tracks.push(t.track)
      if (t.tempo && (!tempo || t.tempo.tick < tempo.tick)) tempo = t.tempo
    }
    p = start + length // unknown chunk types are skipped, as the SMF specification requires
  }
  const tempoBpm = tempo ? { tempoBpm: tempo.bpm } : {}
  const [only] = tracks
  if (format === 0 && only.channels.length) return { format, ppq, ...tempoBpm, tracks: only.channels.map((channel, index) => ({ index, name: `Channel ${channel + 1}`, channels: [channel], notes: only.notes.filter(n => n.channel === channel) })) }
  return { format, ppq, ...tempoBpm, tracks }
}

// Coarsest of 1/4, 1/8, 1/16, 1/32 that holds 90 % of the onsets within ppq/24; grids that would fall between ticks are skipped.
export function suggestStepTicks(notes: readonly { tick: number }[], ppq: number): number {
  whole(ppq, 1, 0x7fff, 'ppq')
  for (const n of notes) whole(n.tick, 0, MAX_TICK, 'Note tick')
  if (notes.length) for (const division of [1, 2, 4, 8]) {
    if (ppq % division) continue
    const step = ppq / division, aligned = notes.filter(n => { const r = n.tick % step; return Math.min(r, step - r) <= ppq / 24 }).length
    if (aligned >= 0.9 * notes.length) return step
  }
  return Math.max(1, Math.round(ppq / 4))
}

// Delay keeps source ticks: the sequencer's own tick scale is not characterized, so no rescaling is attempted.
// Notes rounding outside the window (before startTick or past the last step) are counted in `beyond`.
export function trackToSteps(notes: readonly Omit<MidiNote, 'channel'>[], { stepTicks, startTick = 0, steps = 32 }: { stepTicks: number; startTick?: number; steps?: number }): StepImport {
  whole(stepTicks, 1, MAX_TICK, 'stepTicks'); whole(startTick, 0, MAX_TICK, 'startTick'); whole(steps, 1, MAX_STEPS, 'steps')
  const kept: ({ step: SequencerStep; clamped: boolean } | null)[] = Array(steps).fill(null)
  let chordsDropped = 0, beyond = 0
  for (const n of notes) {
    whole(n.tick, 0, MAX_TICK, 'Note tick'); whole(n.duration, 0, MAX_TICK, 'Note duration'); whole(n.note, 0, 127, 'Note'); whole(n.velocity, 1, 127, 'Velocity')
    const index = Math.round((n.tick - startTick) / stepTicks)
    if (index < 0 || index >= steps) { beyond++; continue }
    const raw = n.tick - startTick - index * stepTicks, delay = Math.max(-127, Math.min(127, raw)), held = kept[index]
    if (held) chordsDropped++
    if (!held || n.velocity > held.step.velocity) kept[index] = { step: { note: n.note, velocity: n.velocity, delay, lengthSteps: Math.max(1, Math.round(n.duration / stepTicks)) }, clamped: raw !== delay }
  }
  return { steps: kept.map(k => k && k.step), chordsDropped, beyond, delayClamped: kept.filter(k => k?.clamped).length }
}

const vlq = (n: number) => { const out = [n & 127]; while ((n >>>= 7)) out.unshift(n & 127 | 128); return out }
const be32 = (n: number) => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255]
const chunk = (id: string, body: number[]) => [...id].map(c => c.charCodeAt(0)).concat(be32(body.length), body)
const meta = (type: number, body: number[]) => [0xff, type, ...vlq(body.length), ...body]
// Events at one tick: meta first, then note-offs before note-ons, so a repeated pitch never ends the note it just started.
function trackChunk(events: { tick: number; order: number; bytes: number[] }[]) {
  let last = 0; const body: number[] = []
  for (const e of events.sort((a, b) => a.tick - b.tick || a.order - b.order)) { body.push(...vlq(e.tick - last), ...e.bytes); last = e.tick }
  return chunk('MTrk', body.concat(0, meta(0x2f, [])))
}

// Format 1: a tempo track, then one track per input track. Notes sit on the step grid; delay is not written.
export function stepsToMidiFile({ ppq = 96, stepTicks, tempoBpm = 120, tracks }: { ppq?: number; stepTicks: number; tempoBpm?: number; tracks: readonly ExportTrack[] }): Uint8Array<ArrayBuffer> {
  whole(ppq, 1, 0x7fff, 'ppq'); whole(stepTicks, 1, MAX_TICK, 'stepTicks')
  const us = Math.round(60e6 / tempoBpm)
  if (typeof tempoBpm !== 'number' || !(tempoBpm > 0) || !(us >= 1 && us <= 0xffffff)) throw Error('tempoBpm must be a number from 3.58 to 60000000')
  if (!Array.isArray(tracks) || !tracks.length || tracks.length >= MAX_TRACKS) throw Error(`Expected 1 to ${MAX_TRACKS - 1} tracks`)
  const encoder = new TextEncoder(), chunks = [trackChunk([{ tick: 0, order: 0, bytes: meta(0x03, [...encoder.encode('Tempo')]) }, { tick: 0, order: 0, bytes: meta(0x51, [us >> 16, us >> 8 & 255, us & 255]) }])]
  tracks.forEach((t, i) => {
    if (typeof t?.name !== 'string' || t.name.length > 1024) throw Error(`Track ${i + 1}: name must be a string of at most 1024 characters`)
    const channel = whole(t.channel, 0, 15, `Track ${i + 1} channel`)
    if (!Array.isArray(t.steps) || t.steps.length > MAX_STEPS) throw Error(`Track ${i + 1}: steps must be an array of at most ${MAX_STEPS} entries`)
    const events = [{ tick: 0, order: 0, bytes: meta(0x03, [...encoder.encode(t.name)]) }]
    t.steps.forEach((s: ExportStep | null, n: number) => {
      const what = `Track ${i + 1} step ${n + 1}`
      if (s === null) return
      if (typeof s !== 'object') throw Error(`${what} must be a step or null`)
      const note = whole(s.note, 0, 127, `${what} note`), velocity = whole(s.velocity, 1, 127, `${what} velocity`)
      const start = n * stepTicks, end = (n + whole(s.lengthSteps, 1, MAX_TICK, `${what} lengthSteps`)) * stepTicks
      if (end > MAX_TICK) throw Error(`${what} ends past the largest MIDI tick`)
      events.push({ tick: start, order: 2, bytes: [0x90 | channel, note, velocity] }, { tick: end, order: 1, bytes: [0x80 | channel, note, 64] })
    })
    chunks.push(trackChunk(events))
  })
  return Uint8Array.from(chunk('MThd', [0, 1, chunks.length >> 8, chunks.length & 255, ppq >> 8, ppq & 255]).concat(...chunks))
}
