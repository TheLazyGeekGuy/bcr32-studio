// Offline regression for the sequencer's Standard MIDI File codec (src/editors/bcontrol/bcr32/midi-file.ts). No MIDI, no hardware.
// Exact expectations on the SYNTHETIC fixtures of scripts/fixtures/sequencer, then every .mid and .syx found there.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { fixtures, LEAD } from './fixtures/sequencer/make-fixtures.mjs'
const root = fileURLToPath(new URL('..', import.meta.url)), dir = new URL('./fixtures/sequencer/', import.meta.url), source = 'src/editors/bcontrol/bcr32/midi-file.ts'
async function bundle(contents, metafile = false) {
  const r = await build({ stdin: { contents, resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node', metafile })
  const mod = { exports: {} }; new Function('module', 'exports', r.outputFiles[0].text)(mod, mod.exports)
  return { m: mod.exports, text: r.outputFiles[0].text, meta: r.metafile }
}
const { m } = await bundle(`export * from './${source}';export { splitSysex } from './src/editors/bcontrol/bcr32/firmware-codec';export { decodeZaqBlock, zaqBlockFile, createZaqAssembler, patternFile, blockIdentity } from './src/editors/bcontrol/bcr32/zaquencer'`)
const read = name => new Uint8Array(readFileSync(new URL(name, dir)))
const empty = n => Array(n).fill(null)

// 0. Committed fixtures are exactly what the generator writes (a stale file would test nothing it claims to).
const generated = await fixtures()
for (const [name, bytes] of Object.entries(generated)) assert.deepEqual(read(name), bytes, `${name} is stale: rerun make-fixtures.mjs`)

// 1. Exact expectations.
const groove = m.parseMidiFile(read('groove-4tracks-16th.mid'))
assert.equal(groove.format, 1); assert.equal(groove.ppq, 96); assert.equal(groove.tempoBpm, 120)
assert.deepEqual(groove.tracks.map(t => [t.index, t.name, t.channels, t.notes.length]), [[0, 'Synthetic lead', [0], 9], [1, 'Synthetic bass', [1], 12], [2, 'Synthetic snare', [9], 4], [3, 'Synthetic hats', [9], 32]])
assert.ok(groove.tracks[1].notes.every(n => n.duration === 20), 'velocity-0 note-ons end the bass notes')
assert.equal(m.suggestStepTicks(groove.tracks.flatMap(t => t.notes), 96), 24)
{ const steps = empty(32); for (const [s, note, velocity, lengthSteps] of LEAD) steps[s] = { note, velocity, delay: 0, lengthSteps }
  assert.equal(steps.filter(Boolean).length, 9)
  assert.deepEqual(m.trackToSteps(groove.tracks[0].notes, { stepTicks: 24 }), { steps, chordsDropped: 0, beyond: 0, delayClamped: 0 }) }
assert.deepEqual(m.trackToSteps(groove.tracks[0].notes, { stepTicks: 24 }).steps.slice(0, 5), [
  { note: 60, velocity: 100, delay: 0, lengthSteps: 2 }, null, { note: 62, velocity: 90, delay: 0, lengthSteps: 1 }, null, { note: 64, velocity: 110, delay: 0, lengthSteps: 4 }])

const long = m.parseMidiFile(read('long-20tracks-64steps.mid'))
assert.deepEqual(long.tracks.map(t => t.name), Array.from({ length: 20 }, (_, k) => `Synthetic ${String(k + 1).padStart(2, '0')}`))
assert.deepEqual(long.tracks.map(t => t.notes.length), Array.from({ length: 20 }, (_, k) => [64, 32, 22, 16][k % 4]))
assert.deepEqual(long.tracks.map(t => m.trackToSteps(t.notes, { stepTicks: 24 }).beyond), Array.from({ length: 20 }, (_, k) => [32, 16, 11, 8][k % 4]))
assert.deepEqual(long.tracks.map(t => m.trackToSteps(t.notes, { stepTicks: 24, steps: 64 }).beyond), empty(20).fill(0))
{ const second = m.trackToSteps(long.tracks[0].notes, { stepTicks: 24, startTick: 768 })
  assert.equal(second.beyond, 32, 'notes before the window are outside it too'); assert.ok(second.steps.every(s => s?.note === 48 && s.delay === 0)) }

const f0 = m.parseMidiFile(read('format0-3channels.mid'))
assert.equal(f0.format, 0)
assert.deepEqual(f0.tracks.map(t => [t.index, t.name, t.channels, t.notes.length]), [[0, 'Channel 1', [0], 8], [1, 'Channel 2', [1], 4], [2, 'Channel 10', [9], 8]])
assert.ok(f0.tracks.every(t => t.notes.every(n => n.channel === t.channels[0])))

{ const bytes = read('running-status.mid'), file = m.parseMidiFile(bytes)
  assert.equal(bytes.filter(b => b === 0x90).length, 1, 'witness: one status byte for 32 note events')
  assert.deepEqual(file.tracks[0].notes, Array.from({ length: 16 }, (_, s) => ({ tick: s * 24, duration: 20, note: 60 + s, velocity: 64 + s, channel: 0 })))
  assert.equal(file.tempoBpm, undefined) }

{ const notes = m.parseMidiFile(read('off-grid-swing.mid')).tracks[0].notes
  assert.equal(m.suggestStepTicks(notes, 96), 24, 'half the onsets off by 5 > 96/24: no grid holds 90 %, default 1/16')
  const r = m.trackToSteps(notes, { stepTicks: 24 })
  assert.deepEqual(r.steps.map(s => s.delay), Array.from({ length: 32 }, (_, s) => [0, 5, 0, -5][s % 4]))
  assert.deepEqual(r.steps.map(s => s.note), Array.from({ length: 32 }, (_, s) => 60 + s % 12)); assert.equal(r.delayClamped, 0) }

{ const notes = m.parseMidiFile(read('chords.mid')).tracks[0].notes, r = m.trackToSteps(notes, { stepTicks: 24 })
  assert.equal(notes.length, 14)
  assert.deepEqual(notes.filter(n => n.note === 50 && n.tick >= 480).map(n => [n.tick, n.duration]), [[480, 60], [504, 96]], 'same-pitch overlap paired FIFO')
  const steps = empty(32)
  steps[0] = { note: 55, velocity: 110, delay: 4, lengthSteps: 2 }; steps[4] = { note: 54, velocity: 110, delay: 2, lengthSteps: 2 }
  steps[8] = { note: 52, velocity: 110, delay: 0, lengthSteps: 2 }; steps[12] = { note: 61, velocity: 110, delay: 4, lengthSteps: 2 }
  steps[20] = { note: 50, velocity: 100, delay: 0, lengthSteps: 3 }; steps[21] = { note: 50, velocity: 100, delay: 0, lengthSteps: 4 }
  assert.deepEqual(r, { steps, chordsDropped: 8, beyond: 0, delayClamped: 0 }) }

{ const n = (tick, velocity = 100) => ({ tick, duration: 10, note: 60, velocity, channel: 0 })
  assert.deepEqual(m.trackToSteps([n(150), n(440)], { stepTicks: 300, steps: 2 }), { steps: [null, { note: 60, velocity: 100, delay: -127, lengthSteps: 1 }], chordsDropped: 1, beyond: 0, delayClamped: 1 })
  assert.deepEqual(m.trackToSteps([n(140, 50)], { stepTicks: 300, steps: 1 }).steps[0].delay, 127)
  assert.equal(m.trackToSteps([n(36), n(35)], { stepTicks: 24, steps: 2 }).beyond, 1, 'onset 36 rounds to step 2, past the last step')
  assert.equal(m.trackToSteps([n(36, 9), n(37, 9)], { stepTicks: 24, steps: 4 }).steps[2].delay, -12, 'equal velocities keep the first')
  assert.equal(m.suggestStepTicks([], 96), 24); assert.equal(m.suggestStepTicks([n(0), n(96), n(196)], 96), 96, '4 within ppq/24 of a quarter')
  assert.equal(m.suggestStepTicks([n(0), n(48)], 96), 48); assert.equal(m.suggestStepTicks([n(12)], 100), 25, 'ppq/8 between ticks is skipped')
  for (const bad of [{ stepTicks: 0 }, { stepTicks: 1.5 }, { stepTicks: 24, steps: 0 }, { stepTicks: 24, startTick: -1 }]) assert.throws(() => m.trackToSteps([], bad), /must be an integer/)
  for (const bad of [{ note: 128 }, { velocity: 0 }, { tick: -1 }, { duration: 0.5 }]) assert.throws(() => m.trackToSteps([{ ...n(0), ...bad }], { stepTicks: 24 }), /must be an integer/) }

// Refusals with clear messages.
assert.throws(() => m.parseMidiFile(read('truncated.invalid.mid')), /Truncated MIDI file/)
assert.throws(() => m.parseMidiFile(read('smpte.invalid.mid')), /SMPTE time division/)
const head = (format, count, ppq = 96) => [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, count >> 8, count & 255, ppq >> 8, ppq & 255]
const mtrk = body => [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, body.length, ...body]
assert.throws(() => m.parseMidiFile(new Uint8Array(4 * 1024 * 1024 + 1)), /larger than 4 MB/)
assert.throws(() => m.parseMidiFile(Uint8Array.from(head(1, 513))), /513 tracks; at most 512/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([...head(1, 2), ...mtrk([0, 0xff, 0x2f, 0])])), /2 tracks declared, 1 found/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([0x52, 0x49, 0x46, 0x46, ...head(0, 1).slice(4)])), /missing MThd/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([...head(1, 1), ...mtrk([0, 60, 100, 0, 0xff, 0x2f, 0])])), /no running status/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([...head(1, 1), ...mtrk([0, 0x90, 60])])), /truncated/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([...head(1, 1), ...mtrk([0, 0x90, 60, 0x90, 0, 0xff, 0x2f, 0])])), /status byte 144 where a data byte/)
assert.throws(() => m.parseMidiFile(Uint8Array.from([...head(1, 1, 0)])), /division of 0/)
assert.throws(() => m.parseMidiFile([0x4d]), /as bytes/)
{ // SysEx (F0 and F7 forms) and an unknown chunk are skipped; a note without note-off ends at the end of the track.
  const f = m.parseMidiFile(Uint8Array.from([...head(1, 1), 0x58, 0x58, 0x58, 0x58, 0, 0, 0, 2, 1, 2, ...mtrk([0, 0xf0, 3, 0x41, 0x10, 0xf7, 0, 0xf7, 1, 0xf8, 0, 0x90, 60, 100, 0, 0xc0, 5, 48, 0xff, 0x2f, 0])]))
  assert.deepEqual(f.tracks[0].notes, [{ tick: 0, duration: 48, note: 60, velocity: 100, channel: 0 }]); assert.equal(f.tracks[0].name, 'Track 1') }

// Writer: exact layout and validation.
{ const bytes = m.stepsToMidiFile({ stepTicks: 24, tempoBpm: 90, tracks: [{ name: 'Lead é', channel: 3, steps: [{ note: 60, velocity: 100, lengthSteps: 2 }, { note: 60, velocity: 80, lengthSteps: 1 }] }] })
  const f = m.parseMidiFile(bytes)
  assert.deepEqual([f.format, f.ppq, f.tracks.map(t => t.name)], [1, 96, ['Tempo', 'Lead é']]); assert.ok(Math.abs(f.tempoBpm - 90) < 1e-3)
  assert.deepEqual(f.tracks[1].notes, [{ tick: 0, duration: 48, note: 60, velocity: 100, channel: 3 }, { tick: 24, duration: 24, note: 60, velocity: 80, channel: 3 }])
  assert.deepEqual(Array.from(bytes.slice(0, 14)), head(1, 2)) }
const one = { name: 'T', channel: 0, steps: [{ note: 60, velocity: 100, lengthSteps: 1 }] }
for (const [bad, why] of [[{ stepTicks: 0 }, /stepTicks/], [{ ppq: 0x8000 }, /ppq/], [{ tempoBpm: 0 }, /tempoBpm/], [{ tempoBpm: NaN }, /tempoBpm/], [{ tracks: [] }, /1 to 511 tracks/],
  [{ tracks: Array(512).fill(one) }, /1 to 511 tracks/], [{ tracks: [{ ...one, channel: 16 }] }, /channel/], [{ tracks: [{ ...one, name: 7 }] }, /name/],
  [{ tracks: [{ ...one, steps: [{ note: 128, velocity: 1, lengthSteps: 1 }] }] }, /step 1 note/], [{ tracks: [{ ...one, steps: [null, { note: 1, velocity: 0, lengthSteps: 1 }] }] }, /step 2 velocity/],
  [{ tracks: [{ ...one, steps: [{ note: 1, velocity: 1, lengthSteps: 0 }] }] }, /lengthSteps/], [{ tracks: [{ ...one, steps: [7] }] }, /must be a step or null/],
  [{ stepTicks: 0x08000000, tracks: [{ ...one, steps: [{ note: 1, velocity: 1, lengthSteps: 2 }] }] }, /past the largest MIDI tick/]])
  assert.throws(() => m.stepsToMidiFile({ stepTicks: 24, tracks: [one], ...bad }), why, JSON.stringify(bad))
assert.equal(m.parseMidiFile(m.stepsToMidiFile({ stepTicks: 24, tracks: Array(511).fill(one) })).tracks.length, 512)

// 2. Every .mid and .syx in the folder.
const names = readdirSync(dir).filter(n => /\.(mid|syx)$/i.test(n)).sort()
assert.ok(Object.keys(generated).every(n => names.includes(n)))
const strip = steps => steps.map(s => s && { note: s.note, velocity: s.velocity, lengthSteps: s.lengthSteps })
let roundTrips = 0, refused = 0, patterns = 0
for (const name of names) {
  const bytes = read(name), invalid = name.toLowerCase().includes('.invalid.')
  if (/\.mid$/i.test(name)) {
    if (invalid) { assert.throws(() => m.parseMidiFile(bytes), Error, `${name} must be refused`); refused++; continue }
    const file = m.parseMidiFile(bytes), musical = file.tracks.filter(t => t.notes.length).slice(0, 4)
    const stepTicks = m.suggestStepTicks(musical.flatMap(t => t.notes), file.ppq), first = musical.map(t => m.trackToSteps(t.notes, { stepTicks }))
    if (!musical.length) continue
    const again = m.parseMidiFile(m.stepsToMidiFile({ ppq: file.ppq, stepTicks, tempoBpm: file.tempoBpm, tracks: musical.map((t, i) => ({ name: t.name, channel: t.channels[0], steps: first[i].steps })) }))
    assert.equal(again.tracks.length, musical.length + 1, name)
    musical.forEach((t, i) => {
      assert.equal(again.tracks[i + 1].name, t.name)
      assert.deepEqual(strip(m.trackToSteps(again.tracks[i + 1].notes, { stepTicks }).steps), strip(first[i].steps), `${name}: track ${i + 1} steps survive the round trip`)
      roundTrips++
    })
  } else {
    let problem = null, found = 0
    try {
      const assembler = m.createZaqAssembler(), runs = new Map()
      for (const frame of m.splitSysex(bytes)) {
        const block = m.decodeZaqBlock(frame)
        if (!block) throw Error('frame does not decode')
        if (block.kind === 3) { assert.deepEqual(m.zaqBlockFile(block), frame, `${name}: raw kind 3 frame re-encodes`); continue }
        const key = m.blockIdentity(block), run = block.block === 0 ? [] : runs.get(key) ?? []
        run.push(frame); runs.set(key, run)
        const pattern = assembler.receive(block)
        if (pattern) { assert.deepEqual(m.patternFile(pattern), run.flat(), `${name}: pattern ${found + 1} re-encodes byte-identically`); runs.delete(key); found++ }
      }
      if (runs.size) throw Error('incomplete pattern')
      if (!found) throw Error('no complete pattern')
    } catch (e) { if (e instanceof assert.AssertionError) throw e; problem = e }
    if (invalid) { assert.ok(problem, `${name} must be refused`); refused++ } else { assert.equal(problem, null, `${name}: ${problem?.message}`); patterns += found }
  }
}
assert.ok(roundTrips >= 14 && refused >= 3 && patterns >= 2, 'the folder walk reached the generated fixtures')

// 3. Pure module: no imports, no MIDI API.
{ const { meta, text } = await bundle(`export * from './${source}'`, true)
  assert.deepEqual(Object.keys(meta.inputs).filter(f => !f.startsWith('<stdin>')), [source])
  assert.doesNotMatch(text, /requestMIDIAccess|MIDIOutput|\.send\(|navigator|document\./) }

console.log(`PASS: MIDI file codec on ${names.length} synthetic fixtures: exact tracks, notes, grid, steps, chords, swing delays and format 0 split; ${roundTrips} track round trips file -> steps -> file -> steps; ${patterns} Zaquencer patterns re-encoded byte-identically; ${refused} invalid files refused; writer and parser limits enforced`)
