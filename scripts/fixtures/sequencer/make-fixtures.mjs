// Generates the SYNTHETIC sequencer fixtures in this folder: `node scripts/fixtures/sequencer/make-fixtures.mjs`.
// Deterministic; scripts/test-midi-file.mjs checks the files on disk still match this output.
// The SMF writer below is deliberately independent of src/editors/bcontrol/bcr32/midi-file.ts, so it can serve as its oracle.
// The .syx patterns use zaquencer.ts's own frame builder: that codec has its own oracle in scripts/test-zaquencer.mjs.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = new URL('./', import.meta.url), root = fileURLToPath(new URL('../../../', import.meta.url))
const NOTICE = 'Synthetic fixture from make-fixtures.mjs; not a hardware capture'

const vlq = n => { const out = [n & 127]; while ((n >>>= 7)) out.unshift(n & 127 | 128); return out }
const be = (n, size) => Array.from({ length: size }, (_, i) => n >>> 8 * (size - 1 - i) & 255)
const chunk = (id, body) => [...Buffer.from(id, 'latin1'), ...be(body.length, 4), ...body]
const meta = (type, data) => [0xff, type, ...vlq(data.length), ...data]
const text = (type, s) => meta(type, [...Buffer.from(s, 'utf8')])
// events: [tick, ...bytes], already chronological; deltas are computed here.
const track = events => { let last = 0; return chunk('MTrk', [...events.flatMap(([tick, ...bytes]) => { const d = tick - last; last = tick; return [...vlq(d), ...bytes] }), 0, ...meta(0x2f, [])]) }
const smf = (format, ppq, tracks) => Uint8Array.from([...chunk('MThd', [...be(format, 2), ...be(tracks.length, 2), ...be(ppq, 2)]), ...tracks.flat()])
const header = (name, extra = []) => [[0, ...text(0x03, name)], [0, ...text(0x01, NOTICE)], ...extra]
// notes: [tick, note, velocity, duration, channel]; note-offs sort before note-ons at the same tick.
const noteEvents = (notes, zeroVelocityOff = false) => notes.flatMap(([tick, note, velocity, duration, ch = 0]) => [
  [tick + duration, 0, ...(zeroVelocityOff ? [0x90 | ch, note, 0] : [0x80 | ch, note, 64])], [tick, 1, 0x90 | ch, note, velocity],
]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([tick, , ...bytes]) => [tick, ...bytes])
const runningStatus = events => { let status = 0; return events.map(([tick, s, ...rest]) => { if (s < 0xf0 && s === status) return [tick, ...rest]; status = s < 0xf0 ? s : 0; return [tick, s, ...rest] }) }
const TEMPO_120 = [0, ...meta(0x51, be(500000, 3))]

// [step, note, velocity, lengthSteps]; durations are 4 ticks short of the step length, like a gated note.
export const LEAD = [[0, 60, 100, 2], [2, 62, 90, 1], [4, 64, 110, 4], [9, 65, 70, 1], [12, 72, 127, 3], [16, 60, 100, 2], [19, 67, 85, 1], [22, 69, 95, 2], [28, 48, 64, 4]]
const steps16 = (list, ch) => list.map(([s, note, velocity, length]) => [s * 24, note, velocity, length * 24 - 4, ch])
const range = n => Array.from({ length: n }, (_, i) => i)

function midiFixtures() {
  const bass = [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30].map(s => [s * 24, 36 + s % 5, 90, 20, 1])
  const snare = [4, 12, 20, 28].map(s => [s * 24, 38, 110, 10, 9]), hats = range(32).map(s => [s * 24, 42, 60 + s % 4 * 15, 6, 9])
  const groove = [
    track([...header('Synthetic lead', [TEMPO_120]), ...noteEvents(steps16(LEAD, 0))]),
    track([...header('Synthetic bass'), ...noteEvents(bass, true)]), // velocity-0 note-offs
    track([...header('Synthetic snare'), ...noteEvents(snare)]), track([...header('Synthetic hats'), ...noteEvents(hats)]),
  ]
  const long = range(20).map(k => track([...header(`Synthetic ${String(k + 1).padStart(2, '0')}`, k ? [] : [TEMPO_120]),
    ...noteEvents(range(64).filter(s => s % (k % 4 + 1) === 0).map(s => [s * 24, 48 + k, 100, 20, k % 16]))]))
  const format0 = [...range(8).map(i => [i * 96, 60, 100, 20, 0]), ...range(4).map(i => [i * 192, 40, 90, 40, 1]), ...range(8).map(i => [i * 96 + 48, 38, 120, 10, 9])]
  const swing = range(32).map(s => [s * 24 + (s % 4 === 1 ? 5 : s % 4 === 3 ? -5 : 0), 60 + s % 12, 100, 20, 0])
  const chords = range(4).flatMap(c => [0, 4, 7].map((interval, i) => [c * 96 + i * 2, 48 + c * 2 + interval, [70, 90, 110][(i + c) % 3], 44, 0]))
  // Same pitch overlapping: FIFO pairs the first note-off with the first note-on (durations 60 and 96).
  const overlap = [[480, 50, 100, 60, 0], [504, 50, 100, 96, 0]]
  const grooveBytes = smf(1, 96, groove)
  return {
    'groove-4tracks-16th.mid': grooveBytes,
    'long-20tracks-64steps.mid': smf(1, 96, long),
    'format0-3channels.mid': smf(0, 96, [track([...header('Synthetic format 0', [TEMPO_120]), ...noteEvents(format0)])]),
    'running-status.mid': smf(1, 96, [track(runningStatus([...header('Synthetic running status'), ...noteEvents(range(16).map(s => [s * 24, 60 + s, 64 + s, 20, 0]), true)]))]),
    'off-grid-swing.mid': smf(1, 96, [track([...header('Synthetic swing'), ...noteEvents(swing)])]),
    'chords.mid': smf(1, 96, [track([...header('Synthetic chords'), ...noteEvents([...chords, ...overlap])])]),
    'truncated.invalid.mid': grooveBytes.slice(0, grooveBytes.length - 37),
    'smpte.invalid.mid': Uint8Array.from([...chunk('MThd', [0, 0, 0, 1, 0xe7, 0x28]), ...track([...header('Synthetic SMPTE'), ...noteEvents([[0, 60, 100, 40, 0]])])]), // -25 fps, 40 ticks per frame
  }
}

// Two synthetic pattern exports (8 blocks, kind 0) and one with a single corrupted checksum nibble.
async function syxFixtures() {
  const r = await build({ stdin: { contents: `export { zaqBlockFile } from './src/editors/bcontrol/bcr32/zaquencer'`, resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node' })
  const mod = { exports: {} }; new Function('module', 'exports', r.outputFiles[0].text)(mod, mod.exports)
  let seed = 0x5eed5e9
  const random = range(1024).map(() => (seed = Math.imul(seed, 1103515245) + 12345 >>> 0) >>> 16 & 255), ramp = range(1024).map(i => i * 7 & 255)
  const frames = (data, page) => range(8).flatMap(block => mod.exports.zaqBlockFile({ device: 127, kind: 0, bank: 0, page, block, data: data.slice(block * 128, block * 128 + 128) }))
  const bad = frames(random, 0); bad[3 * 273 + 270] ^= 1
  return { 'synthetic-pattern-random.syx': Uint8Array.from(frames(random, 0)), 'synthetic-pattern-ramp.syx': Uint8Array.from(frames(ramp, 1)), 'bad-checksum.invalid.syx': Uint8Array.from(bad) }
}

export async function fixtures() { return { ...midiFixtures(), ...await syxFixtures() } }
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const all = await fixtures()
  for (const [name, bytes] of Object.entries(all)) writeFileSync(new URL(name, here), bytes)
  console.log(`Wrote ${Object.keys(all).length} synthetic fixtures`)
}
