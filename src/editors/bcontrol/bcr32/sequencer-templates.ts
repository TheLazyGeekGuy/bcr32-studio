import { patchStep, type ZaqStep } from './zaquencer'
import { stepDefaults } from './sequencer-shared'

// Built-in pattern templates and a random pattern generator for the sequencer view. They only fill notes, velocities,
// mute and skip flags of a pattern the editor already holds; the track header and every other byte stay untouched.
type Lane = (Partial<ZaqStep> | null)[] // 32 entries: null = muted step
export const scales: Record<string, number[]> = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], 'minor pentatonic': [0, 3, 5, 7, 10], 'major pentatonic': [0, 2, 4, 7, 9], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
const hits = (steps: number[], note: number, velocity = 110, accents: number[] = []): Lane => Array.from({ length: 32 }, (_, s) => steps.includes(s) ? { note, velocity: accents.includes(s) ? 127 : velocity } : null)
const every = (n: number, offset = 0) => Array.from({ length: 32 }, (_, s) => s).filter(s => s % n === offset)
// Acid line in A minor over two bars, accents on the off-beats (the classic TB-303 feel; slides are not encoded).
const acid: Lane = [45, null, 57, 45, null, 48, 45, 57, null, 52, 45, null, 55, 57, 45, null].flatMap(n => [n]).concat([45, null, 57, 45, 60, null, 45, 57, null, 52, 45, 55, null, 57, 43, null]).map((note, s) => note === null ? null : { note, velocity: s % 4 === 2 || s % 8 === 7 ? 127 : 92 })
export const templates: { id: string; name: string; tracks: (Lane | undefined)[] }[] = [
  { id: 'acid-303', name: 'Acid bass (303 style) on T1', tracks: [acid] },
  { id: 'four-on-the-floor', name: 'Four on the floor (kick, snare, hats)', tracks: [hits(every(4), 36, 120), hits(every(8, 4), 38, 112), hits(every(2), 42, 84, every(4, 2)), hits(every(4, 2), 46, 96)] },
  { id: 'breakbeat', name: 'Breakbeat (kick, snare, hats)', tracks: [hits([0, 10, 16, 26, 27], 36, 118), hits([4, 12, 20, 25, 28], 38, 110, [4, 12, 20, 28]), hits(every(2), 42, 80, every(4)), undefined] },
  { id: 'techno-16th', name: 'Techno: kick and 16th hats', tracks: [hits(every(4), 36, 124), undefined, hits(Array.from({ length: 32 }, (_, s) => s), 42, 70, every(4, 2)), hits(every(8, 6), 39, 100)] },
]
export function applyTemplate(data: readonly number[], id: string) {
  const template = templates.find(t => t.id === id); if (!template) throw Error('Unknown template')
  let next = [...data]
  template.tracks.forEach((lane, track) => { if (!lane) return; lane.forEach((step, s) => { next = patchStep(next, track, s, step ? { gate: stepDefaults.gate, ...step, mask: false, rest: false } : { rest: true, mask: false }) }) })
  return next
}
// Random pattern: notes from a scale (root and octave span), density = share of playing steps, velocities in a range.
// random() is injectable so tests are reproducible.
export function randomPattern(data: readonly number[], { tracks, scale, root, octaves = 1, density = .5, velocity = [70, 120], random = Math.random }: { tracks: number[]; scale: string; root: number; octaves?: number; density?: number; velocity?: [number, number]; random?: () => number }) {
  const degrees = scales[scale]; if (!degrees) throw Error('Unknown scale')
  if (!Number.isInteger(root) || root < 0 || root > 115) throw Error('Root 0–115')
  let next = [...data]
  for (const track of tracks) for (let s = 0; s < 32; s++) {
    if (random() >= density) { next = patchStep(next, track, s, { rest: true, mask: false }); continue }
    const degree = Math.floor(random() * degrees.length * octaves), note = Math.min(127, root + 12 * Math.floor(degree / degrees.length) + degrees[degree % degrees.length])
    next = patchStep(next, track, s, { note, velocity: Math.round(velocity[0] + random() * (velocity[1] - velocity[0])), gate: stepDefaults.gate, rest: false, mask: false })
  }
  return next
}
