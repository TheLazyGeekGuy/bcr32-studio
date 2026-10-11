import { parseProfile, valueLimit, buttonIds, type Bcr32Profile } from './profile'
import { validLedMode, type LedMode } from './led-modes'

export const presetStorageKey = 'bcr32-studio.presets.v1'
export const draftStorageKey = 'bcr32-studio.draft.v1'
export const groups = ['encoders', 'pushes', 'buttons'] as const
export type ControlGroup = typeof groups[number]
export type VisualLabels = Record<ControlGroup, string[]>
export type PresetValues = Record<ControlGroup, (number | null)[]>
export interface ControllerState {
  profile: Bcr32Profile
  labels: VisualLabels
  values: PresetValues
  ringMode: LedMode
}
export interface ControllerPreset extends ControllerState {
  format: 'bcr32-controller-preset'
  version: 1
  id: string
  name: string
  updatedAt: string
}
export const controlIndex = (kind: ControlGroup, id: number) => kind === 'buttons' ? buttonIds.indexOf(id) : id - 1
export const emptyLabels = (): VisualLabels => ({ encoders: Array(32).fill(''), pushes: Array(32).fill(''), buttons: Array(buttonIds.length).fill('') })
export const emptyValues = (): PresetValues => ({ encoders: Array(32).fill(null), pushes: Array(32).fill(null), buttons: Array(buttonIds.length).fill(null) })
export const cleanLabel = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 48)

export function parseControllerState(value: unknown): ControllerState {
  if (!value || typeof value !== 'object') throw new Error('Invalid state')
  const s = value as ControllerState
  const profile = parseProfile(s.profile)
  if (!validLedMode(s.ringMode)) throw new Error('Invalid LED ring mode')
  const labels = emptyLabels(), values = emptyValues()
  for (const kind of groups) {
    const count = kind === 'buttons' && s.profile.buttons?.length === 20 ? 20 : profile[kind].length
    if (!Array.isArray(s.labels?.[kind]) || s.labels[kind].length !== count ||
      !s.labels[kind].every(v => typeof v === 'string' && v.length <= 48 && cleanLabel(v) === v)) throw new Error('Invalid labels')
    if (!Array.isArray(s.values?.[kind]) || s.values[kind].length !== count ||
      !s.values[kind].every((v, i) => v === null || (Number.isInteger(v) && v >= 0 && v <= valueLimit(profile[kind][i])))) throw new Error('Invalid values')
    labels[kind] = [...s.labels[kind], ...Array(profile[kind].length - count).fill('')]
    values[kind] = [...s.values[kind], ...Array(profile[kind].length - count).fill(null)]
  }
  return JSON.parse(JSON.stringify({ profile, labels, values, ringMode: s.ringMode })) as ControllerState
}
export function parsePreset(value: unknown): ControllerPreset {
  const p = value as ControllerPreset
  if (!p || p.format !== 'bcr32-controller-preset' || p.version !== 1 ||
    typeof p.id !== 'string' || !p.id.length || p.id.length > 100 ||
    typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || /[\u0000-\u001f\u007f]/.test(p.name) ||
    typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))) throw new Error('Invalid preset')
  return { ...parseControllerState(p), format: p.format, version: 1, id: p.id, name: p.name, updatedAt: p.updatedAt }
}
export function makePreset(state: ControllerState, name: string, id: string = crypto.randomUUID(), updatedAt = new Date().toISOString()): ControllerPreset {
  return parsePreset({ ...state, format: 'bcr32-controller-preset', version: 1, id, name: name.trim(), updatedAt })
}
export function parseLibrary(value: unknown): ControllerPreset[] {
  const bank = value as { format: string; version: number; presets: unknown[] }
  if (!bank || bank.format !== 'bcr32-preset-library' || bank.version !== 1 || !Array.isArray(bank.presets) || bank.presets.length > 500) throw new Error('Invalid library')
  const result = bank.presets.map(parsePreset)
  if (new Set(result.map(p => p.id)).size !== result.length) throw new Error('Duplicate identifiers')
  return result
}
export const libraryFile = (presets: ControllerPreset[]) => ({ format: 'bcr32-preset-library', version: 1, presets })
export const sameState = (a: ControllerState, b: ControllerState) => JSON.stringify(parseControllerState(a)) === JSON.stringify(parseControllerState(b))
