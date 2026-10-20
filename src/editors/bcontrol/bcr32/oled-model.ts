import type { Encoder, Bcr32Profile } from './profile'
import type { Selection } from './FrontPanel'
import { matchesCC } from './controller-midi'

export const modeText: Record<Encoder['mode'], string> = { absolute: 'ABS', abs_14: 'ABS_14', rel1: 'REL1', rel2: 'REL2', rel3: 'REL3', r1_14: 'R1_14', r2_14: 'R2_14', r3_14: 'R3_14', inc_dec: 'INC/DEC', toggle: 'TOG ON', momentary: 'TOG OFF' }
export function controlForChanges(preferred: Selection, changes: { control: Selection }[]): Selection | null {
  const controls = [...new Map(changes.map(change => [`${change.control.kind}:${change.control.id}`, change.control])).values()]
  const match = controls.find(c => c.kind === preferred.kind && c.id === preferred.id)
  return match ?? (controls.length === 1 ? controls[0] : null)
}
export function controlForCC(profile: Bcr32Profile, preferred: Selection, data: number[]): Selection | null {
  if (data.length !== 3 || !data.every(n => Number.isInteger(n) && n >= 0 && n <= 255) || (data[0] & 0xf0) !== 0xb0 || data[1] > 127 || data[2] > 127) return null
  const matches = profile.encoders.filter(e => matchesCC(e, data))
  if (preferred.kind === 'encoders' && matches.some(e => e.id === preferred.id)) return preferred
  // A shared CC cannot identify a physical encoder. Keep the previous display.
  return matches.length === 1 ? { kind: 'encoders', id: matches[0].id } : null
}
