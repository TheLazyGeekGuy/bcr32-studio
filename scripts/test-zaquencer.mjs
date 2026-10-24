// Offline regression for the Zaquencer pattern codec (src/editors/bcontrol/bcr32/zaquencer.ts). No MIDI, no hardware.
// Expectations come from docs/ZAQUENCER-PATTERN.md and the `04 0B` container in docs/PROTOCOL.md. Every pattern below is
// SYNTHETIC (seeded pseudo-random bytes built here): no real BCR32 export has been captured for firmware 1.0.2.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const root = fileURLToPath(new URL('..', import.meta.url)), source = 'src/editors/bcontrol/bcr32/zaquencer.ts'
async function bundle(contents, metafile = false) {
  const r = await build({ stdin: { contents, resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node', metafile })
  const mod = { exports: {} }; new Function('module', 'exports', r.outputFiles[0].text)(mod, mod.exports)
  return { m: mod.exports, text: r.outputFiles[0].text, meta: r.metafile }
}
const { m: z } = await bundle(`export * from './${source}';export { isFirmwareRead, splitSysex } from './src/editors/bcontrol/bcr32/firmware-codec'`)

let seed = 0x5eed2026
const rnd = () => { seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const byte = () => Math.floor(rnd() * 256)
const synthetic = () => Array.from({ length: 1024 }, byte) // every bit, including the shared velocity bit 7, is exercised
const blocksOf = (data, o = {}) => Array.from({ length: 8 }, (_, i) => ({ device: 127, kind: 1, bank: 0, page: 0, ...o, block: i, data: data.slice(i * 128, (i + 1) * 128) }))

// Independent frame builder, written from the documented container, not from zaqBlockFile:
// F0 00 20 32 <dev> 64 04 0B <kind> <bank> <page> <block> | 256 nibbles, high first | 16-bit sum of bytes 0-267 as 4 nibbles | F7
const withSum = head => { const sum = head.slice(0, 268).reduce((n, v) => n + v, 0) & 0xffff; return [...head.slice(0, 268), sum >> 12 & 15, sum >> 8 & 15, sum >> 4 & 15, sum & 15, 0xf7] }
const referenceFrame = b => withSum([0xf0, 0x00, 0x20, 0x32, b.device, 0x64, 0x04, 0x0b, b.kind, b.bank, b.page, b.block, ...b.data.flatMap(v => [v >> 4, v & 15])])

// 1. Container, checksum and strict frame validation.
const data = synthetic(), blocks = blocksOf(data)
for (const b of blocks) {
  const frame = z.zaqBlockFile(b)
  assert.equal(frame.length, 273)
  assert.deepEqual(frame, referenceFrame(b), 'frame layout and checksum match the documented container')
  assert.deepEqual(z.decodeZaqBlock(frame), b)
}
const good = z.zaqBlockFile(blocks[3])
let refused = 0
const refuse = (frame, why) => { assert.equal(z.decodeZaqBlock(frame), null, why); refused++ }
for (const i of [268, 269, 270, 271]) for (const delta of [1, 2, 8]) { const bad = [...good]; bad[i] ^= delta; refuse(bad, `corrupted checksum nibble ${i}`) }
for (const i of [4, 8, 9, 10, 11, 12, 140, 267]) { const bad = [...good]; bad[i] ^= 1; refuse(bad, `payload byte ${i} changed without checksum update`) }
{ const bad = [...good]; bad[12] = 16; refuse(withSum(bad), 'nibble above 15, even with a matching checksum') }
refuse(good.slice(0, 272), 'short frame'); refuse([...good.slice(0, 272), 0, 0xf7], 'long frame'); refuse([0xf0, 0, 0x20, 0x32, 0x7f, 0x64, 4, 11, 0, 0xf7], 'header only')
for (const [i, v, why] of [[6, 5, 'other command'], [7, 12, 'controller dump 04 0C'], [8, 4, 'kind > 3'], [10, 16, 'page > 15'], [11, 8, 'block > 7'], [5, 0x65, 'model byte']]) {
  const f = referenceFrame(blocks[0]); f[i] = v; refuse(withSum(f), why)
}
assert.throws(() => z.zaqBlockFile({ ...blocks[0], data: blocks[0].data.slice(1) }), 'block data must be 128 bytes')
assert.throws(() => z.zaqBlockFile({ ...blocks[0], data: [...blocks[0].data.slice(1), 256] }))
assert.throws(() => z.zaqBlockFile({ ...blocks[0], block: 8 }))

// 2. Strict, chronological assembly.
function feed(assembler, list) { let out = null; for (const b of list) { const r = assembler.receive(b); if (r) { assert.equal(out, null, 'one pattern per complete run'); out = r } } return out }
{ const p = feed(z.createZaqAssembler(), blocks)
  assert.equal(p.identity, '127:1:0:0'); assert.deepEqual(p.data, data); assert.deepEqual(p.blocks.map(b => b.block), [0, 1, 2, 3, 4, 5, 6, 7]) }
const strict = [
  ['missing block', [0, 1, 2, 4, 5, 6, 7]], ['missing first block', [1, 2, 3, 4, 5, 6, 7]], ['missing last block', [0, 1, 2, 3, 4, 5, 6]],
  ['duplicated block', [0, 1, 2, 2, 3, 4, 5, 6, 7]], ['out of order', [0, 1, 3, 2, 4, 5, 6, 7]], ['reversed', [7, 6, 5, 4, 3, 2, 1, 0]],
  ['no resume after a gap', [0, 1, 2, 4, 3, 4, 5, 6, 7]],
]
for (const [why, order] of strict) assert.equal(feed(z.createZaqAssembler(), order.map(i => blocks[i])), null, why)
// Block 0 restarts only its own destination (as the code comment states); the second run is complete and wins.
{ const other = synthetic(), p = feed(z.createZaqAssembler(), [blocks[0], blocks[1], ...blocksOf(other)])
  assert.deepEqual(p.data, other, 'block 0 restarts the destination; no bytes from the abandoned run') }
// Two destinations interleaved stay separate; device, kind, bank and page are all part of the identity.
for (const o of [{ bank: 1 }, { page: 2 }, { device: 0 }, { kind: 2 }]) {
  const other = synthetic(), ob = blocksOf(other, o), a = z.createZaqAssembler(), got = []
  for (let i = 0; i < 8; i++) for (const b of [blocks[i], ob[i]]) { const r = a.receive(b); if (r) got.push(r) }
  assert.deepEqual(got.map(p => p.data), [data, other], `interleaved destinations kept apart (${Object.keys(o)[0]})`)
}
{ const a = z.createZaqAssembler(); for (const b of blocks.slice(0, 5)) a.receive(b); a.reset()
  assert.equal(feed(a, blocks.slice(5)), null, 'reset discards partial data') }
{ const p = feed(z.createZaqAssembler(), blocks); p.blocks[0].data[0] ^= 1; assert.equal(blocks[0].data[0], data[0], 'assembler copies block data') }

// 3. Byte-identical round trip: blocks -> frames -> decode -> assemble -> patternFile -> split -> decode -> assemble.
const frames = blocks.map(z.zaqBlockFile)
const pattern = feed(z.createZaqAssembler(), frames.map(z.decodeZaqBlock))
const file = z.patternFile(pattern)
assert.deepEqual(file, frames.flat(), 'unchanged pattern file is byte-identical to the frames it came from')
assert.deepEqual(file, blocks.flatMap(referenceFrame))
const reimported = feed(z.createZaqAssembler(), z.splitSysex(file).map(z.decodeZaqBlock))
assert.deepEqual(reimported.data, data); assert.deepEqual(z.patternFile(reimported), file, 'second generation is byte-identical')
for (const fill of [0, 255]) { const flat = Array(1024).fill(fill); assert.deepEqual(feed(z.createZaqAssembler(), blocksOf(flat).map(b => z.decodeZaqBlock(z.zaqBlockFile(b)))).data, flat) }

// 4. patchStep changes only the targeted bits. Oracle: the documented per-track layout (offsets relative to track*256).
const fieldBits = (step, key) => ({
  note: [[0x10 + step, 0xff]], velocity: [[0x30 + step, 0x7f]], delay: [[0x50 + step, 0xff]],
  gate: step < 24 ? [[0x70 + (step >> 1), step & 1 ? 0xf0 : 0x0f]] : [0, 1, 2, 3].map(i => [0x30 + 4 * (step - 24) + i, 0x80]),
  alpha: [[0x7c + step, 0xff]], beta: [[0x9c + step, 0xff]], voices: [[0xbc + 2 * step, 0xff], [0xbd + 2 * step, 0xff]],
  rest: [[0xfc + (step >> 3), 1 << (step & 7)]],
  mask: [[step >> 3, 1 << (step & 7)]], // inside the 00-0F track header: source is the code, see docs
})[key]
const ranges = { note: [0, 127], velocity: [0, 127], delay: [-127, 127], gate: [0, 15], alpha: [0, 255], beta: [0, 255], voices: [0, 65535] }
const fields = [...Object.keys(ranges), 'rest', 'mask']
const pick = key => key === 'rest' || key === 'mask' ? rnd() < 0.5 : ranges[key][0] + Math.floor(rnd() * (ranges[key][1] - ranges[key][0] + 1))
let checked = 0
for (let track = 0; track < 4; track++) for (let step = 0; step < 32; step++) for (const key of fields) for (let n = 0; n < 3; n++) {
  const before = synthetic(), frozen = [...before], value = pick(key)
  const after = z.patchStep(before, track, step, { [key]: value })
  assert.deepEqual(before, frozen, 'input is not mutated')
  const allowed = new Map(fieldBits(step, key).map(([o, mask]) => [track * 256 + o, mask]))
  for (let i = 0; i < 1024; i++) {
    const diff = before[i] ^ after[i]
    if (diff & ~(allowed.get(i) ?? 0)) assert.fail(`${key} t${track} s${step}: byte ${i} changed outside the field (xor ${diff})`)
  }
  assert.equal(z.readStep(after, track, step)[key], value, `${key} reads back`)
  for (let t = 0; t < 4; t++) for (let s = 0; s < 32; s++) {
    const a = z.readStep(before, t, s), b = z.readStep(after, t, s)
    for (const k of fields) if (!(t === track && s === step && k === key)) assert.equal(b[k], a[k], `${key} t${track} s${step} changed ${k} t${t} s${s}`)
  }
  checked++
}
// Exhaustive shared-bit check, as in the 83c9006 test: gates 0-15 on every step keep all velocities, and vice versa.
{ let edited = synthetic(); const original = [...edited]
  for (let track = 0; track < 4; track++) for (let step = 0; step < 32; step++) for (let gate = 0; gate < 16; gate++) {
    const velocities = Array.from({ length: 32 }, (_, s) => z.readStep(edited, track, s).velocity)
    edited = z.patchStep(edited, track, step, { gate }); assert.equal(z.readStep(edited, track, step).gate, gate)
    assert.deepEqual(Array.from({ length: 32 }, (_, s) => z.readStep(edited, track, s).velocity), velocities, 'gate edit keeps every velocity')
  }
  for (let track = 0; track < 4; track++) {
    const gates = Array.from({ length: 32 }, (_, s) => z.readStep(edited, track, s).gate)
    for (let step = 0; step < 32; step++) edited = z.patchStep(edited, track, step, { velocity: step * 37 & 127 })
    assert.deepEqual(Array.from({ length: 32 }, (_, s) => z.readStep(edited, track, s).gate), gates, 'velocity edits keep every gate')
  }
  for (let base = 0; base < 1024; base += 256) {
    assert.deepEqual(edited.slice(base, base + 0x30), original.slice(base, base + 0x30), 'header and notes untouched')
    assert.deepEqual(edited.slice(base + 0x50, base + 0x70), original.slice(base + 0x50, base + 0x70), 'delays untouched')
    assert.deepEqual(edited.slice(base + 0x7c, base + 0x100), original.slice(base + 0x7c, base + 0x100), 'alpha, beta, voices, rest untouched')
  }
}
// Concrete bit placement (step 24 -> bit 7 of velocity bytes 0..3, step 31 -> 28..31; even step in the low nibble).
{ const zero = Array(1024).fill(0)
  assert.deepEqual(z.patchStep(zero, 1, 24, { gate: 0b1011 }).slice(256 + 0x30, 256 + 0x34), [0x80, 0x80, 0, 0x80])
  assert.deepEqual(z.patchStep(zero, 2, 31, { gate: 0b0001 }).slice(512 + 0x4c, 512 + 0x50), [0x80, 0, 0, 0])
  assert.equal(z.patchStep(zero, 0, 5, { gate: 9 })[0x72], 0x90, 'odd step in high nibble')
  assert.equal(z.patchStep(zero, 0, 4, { gate: 9 })[0x72], 0x09, 'even step in low nibble')
  assert.deepEqual(z.patchStep(zero, 3, 9, { voices: 0xa55a }).slice(768 + 0xbc + 18, 768 + 0xbc + 20), [0x5a, 0xa5], 'little-endian voice word')
  assert.equal(z.patchStep(zero, 0, 3, { delay: -23 })[0x53], 233, 'two\'s complement delay')
  assert.deepEqual(z.patchStep(zero, 0, 17, { rest: true }).slice(0xfc, 0x100), [0, 0, 2, 0])
  assert.deepEqual(z.patchStep(zero, 0, 31, { mask: true }).slice(0, 4), [0, 0, 0, 0x80]) }
for (const bad of [{ velocity: 128 }, { note: -1 }, { gate: 16 }, { delay: 128 }, { voices: 65536 }, { alpha: 1.5 }, { rest: 1 }, { unknown: 0 }]) assert.throws(() => z.patchStep(data, 0, 0, bad), JSON.stringify(bad))
assert.throws(() => z.patchStep(data, 4, 0, { note: 1 })); assert.throws(() => z.patchStep(data, 0, 32, { note: 1 })); assert.throws(() => z.patchStep(data.slice(1), 0, 0, { note: 1 }))
{ const edited = z.patchStep(data, 2, 30, { note: 64, gate: 7 }), p = feed(z.createZaqAssembler(), z.splitSysex(z.patternFile(pattern, edited)).map(z.decodeZaqBlock))
  assert.deepEqual(p.data, edited, 'edited file re-imports with valid checksums'); assert.deepEqual(pattern.data, data, 'pattern object unchanged') }

// 5. Kind 3 (raw sequencer data, two blocks): a frame round-trips raw, but is never assembled or saved as a pattern.
{ const raw = Array.from({ length: 128 }, byte), k3 = { device: 127, kind: 3, bank: 0, page: 0, block: 1, data: raw }
  const f = z.zaqBlockFile(k3); assert.deepEqual(f, referenceFrame(k3)); assert.deepEqual(z.decodeZaqBlock(f), k3, 'kind 3 frame decodes raw')
  assert.equal(z.decodeZaqBlock(referenceFrame({ ...k3, block: 2 })), null, 'kind 3 has blocks 0-1 only'); assert.throws(() => z.zaqBlockFile({ ...k3, block: 2 }))
  const a = z.createZaqAssembler(), k3blocks = [0, 1].map(block => ({ ...k3, block }))
  for (let i = 0; i < 8; i++) {
    if (i === 4) for (const b of k3blocks) assert.equal(a.receive(b), null, 'kind 3 never yields a pattern')
    const r = a.receive(blocks[i]); if (i === 7) assert.deepEqual(r.data, data, 'kind 3 does not disturb a pattern in progress')
  }
  assert.throws(() => z.patternFile({ ...pattern, blocks: pattern.blocks.map(b => ({ ...b, kind: 3 })), identity: '127:3:0:0' }), 'patternFile refuses kind 3') }

// 6. patternFile is a file payload only, and nothing in this path can send MIDI.
assert.equal(file.length, 8 * 273); assert.ok(file.every(v => Number.isInteger(v) && v >= 0 && v <= 255)); assert.deepEqual(Array.from(Uint8Array.from(file)), file)
assert.equal(z.splitSysex(file).length, 8, '.syx with eight complete SysEx messages')
for (const f of z.splitSysex(file)) assert.equal(z.isFirmwareRead(f), false, 'the sender boundary refuses every pattern frame')
for (const bad of [{ ...pattern, blocks: pattern.blocks.slice(0, 7) }, { ...pattern, blocks: [...pattern.blocks].reverse() }, { ...pattern, identity: '127:1:1:0' }]) assert.throws(() => z.patternFile(bad), 'incomplete, reordered or mixed pattern refused')
assert.throws(() => z.patternFile(pattern, data.slice(0, 1023)))
{ const { meta, text } = await bundle(`export * from './${source}'`, true)
  assert.deepEqual(Object.keys(meta.inputs).filter(f => !f.startsWith('<stdin>')).sort(), ['src/editors/bcontrol/bcr32/firmware-codec.ts', source], 'codec imports nothing but the byte helpers')
  assert.doesNotMatch(text, /requestMIDIAccess|MIDIOutput|\.send\(|sendRead|navigator/, 'no MIDI API in the bundled codec') }
{ const tools = readFileSync(new URL('../src/editors/bcontrol/bcr32/FirmwareTools.tsx', import.meta.url), 'utf8')
  const uses = [...tools.matchAll(/patternFile\(/g)].map(x => tools.slice(Math.max(0, x.index - 30), x.index))
  assert.equal(uses.length, 1); assert.match(uses[0], /download\(new Uint8Array\($/, 'the only patternFile caller downloads a file')
  assert.deepEqual([...tools.matchAll(/\bsendRead\((.*?)\)/g)].map(x => x[1].split('(')[0]), ['bclQuery'], 'sendRead only carries BCL read requests') }

console.log(`PASS: Zaquencer codec on synthetic patterns: documented 04 0B container and checksum, ${refused} corrupt or invalid frames refused, strict block order and identity, byte-identical round trips, ${checked} single-field patches confined to their bits, 2048 gate edits keeping shared velocity bits, kind 3 kept out of patterns, file-only output that never reaches a MIDI sender`)
