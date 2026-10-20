import type { ParameterState } from './parameter-state'
import { setStatement, statementValue } from './parameter-state'
export type ParameterScope = 'encoder' | 'button' | 'fader' | 'preset' | 'global'
export interface ParameterField {
  id: string; label: string; scopes: string[]; kind: string; choices?: string[]
  min?: number; max?: number; count?: number; minCount?: number; off?: boolean; extra?: string[]
  requires?: string[]
}
export interface ParameterSchema { id: string; version: number; fields: ParameterField[] }
export const parseParameterNumber = (word: string) => /^-?\d+$/.test(word) ? Number(word) : /^\$[\da-f]+$/i.test(word) ? parseInt(word.slice(1), 16) : NaN
export function validateParameter(field: ParameterField, value: string): string | null {
  if (/[\r\n\x00]/.test(value) && field.kind !== 'lines' || value.length > 4096) return 'Invalid parameter text'
  if (!value || field.off && value === 'off' || field.extra?.includes(value)) return null
  if (field.kind === 'choice') return field.choices?.includes(value) ? null : 'Choose a listed value'
  if (field.kind === 'numbers') {
    const words = value.trim().split(/\s+/), maxCount = field.count ?? 1, minCount = field.minCount ?? maxCount
    if (words.length < minCount || words.length > maxCount) return `${minCount}–${maxCount} value(s) required`
    if (words.some(w => !Number.isInteger(parseParameterNumber(w)) || parseParameterNumber(w) < (field.min ?? 0) || parseParameterNumber(w) > (field.max ?? 16383))) return `Range: ${field.min ?? 0}–${field.max ?? 16383}`
  }
  if (field.kind === 'lines' && value.split('\n').some(l => l.length > 1024 || /[^\x20-\x7e]/.test(l))) return 'Printable ASCII lines, at most 1024 characters'
  return null
}
export const fieldValue = (state: ParameterState | undefined, field: ParameterField) => field.kind === 'lines' ? state?.statements.filter(l => l.startsWith('.' + field.id + ' ')).map(l => l.slice(field.id.length + 2)).join('\n') ?? '' : statementValue(state, field.id) ?? ''
export function changeParameter(state: ParameterState | undefined, protocol: string, field: ParameterField, value: string): ParameterState {
  const error = validateParameter(field, value); if (error) throw new Error(error)
  if (field.kind === 'lines') {
    // A multi-line custom output replaces the whole ordered group at its original position.
    const original = state?.statements ?? [], first = original.findIndex(l => l.startsWith('.' + field.id + ' ')), lines = original.filter(l => !l.startsWith('.' + field.id + ' '))
    lines.splice(first < 0 ? lines.length : first, 0, ...value.split('\n').filter(Boolean).map(l => '.' + field.id + ' ' + l))
    return { ...state, protocol, statements: lines }
  }
  return setStatement(state, protocol, field.id, value === '' && field.kind !== 'flag' ? null : value)
}
