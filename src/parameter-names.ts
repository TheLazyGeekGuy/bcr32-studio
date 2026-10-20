import type { EncoderType } from './profile'
export type ParameterName = { type: EncoderType; parameter: number; name: string }
export const parameterNamesKey = 'bcr32-studio.parameter-names.v2'
const legacyNamesKey = 'bcr32-studio.parameter-names.v1'
// Factory labels stored by the original French-only v1 table: kept verbatim (French) so the one-time migration below still
// recognises them and replaces them with the English names; any other stored name is the user's and stays untouched.
const legacyCcNames: Record<number, string> = { 0: 'Banque MSB', 2: 'Souffle', 5: 'Portamento : durée', 10: 'Panoramique', 32: 'Banque LSB', 67: 'Pédale douce', 71: 'Timbre / résonance', 91: 'Effet 1 / réverbération', 93: 'Effet 3 / chorus' }
const ccNames: Record<number, string> = { 0: 'Bank Select MSB', 1: 'Modulation', 2: 'Breath', 5: 'Portamento Time', 6: 'Data Entry MSB', 7: 'Volume', 10: 'Pan', 11: 'Expression', 32: 'Bank Select LSB', 38: 'Data Entry LSB', 64: 'Sustain', 65: 'Portamento', 66: 'Sostenuto', 67: 'Soft Pedal', 71: 'Timbre / Resonance', 72: 'Release', 73: 'Attack', 74: 'Cutoff / Brightness', 75: 'Decay', 91: 'Effect 1 / Reverb', 93: 'Effect 3 / Chorus', 96: 'Data Increment', 97: 'Data Decrement', 98: 'NRPN LSB', 99: 'NRPN MSB', 100: 'RPN LSB', 101: 'RPN MSB', 120: 'All Sound Off', 121: 'Reset Controllers', 123: 'All Notes Off' }
export const defaultNames: ParameterName[] = Object.entries(ccNames).map(([parameter, name]) => ({ type: 'cc', parameter: Number(parameter), name }))
export const nameKey = (e: Pick<ParameterName, 'type' | 'parameter'>) => `${e.type}:${e.parameter}`
export function parseNames(value: unknown): ParameterName[] {
  const v = value as { format?: string; version?: number; entries?: unknown[] }
  if (!v || v.format !== 'bcr32-parameter-names' || v.version !== 1 || !Array.isArray(v.entries) || v.entries.length > 4096) throw Error('Incompatible table (up to 4096 entries).')
  const seen = new Set<string>()
  return v.entries.map(raw => {
    const e = raw as ParameterName
    if (!e || !['cc', 'nrpn', 'gs', 'pb', 'at'].includes(e.type) || !Number.isInteger(e.parameter) || e.parameter < 0 || e.parameter > (e.type === 'nrpn' ? 16383 : 127) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80 || /[\u0000-\u001f\u007f]/.test(e.name)) throw Error('Invalid parameter entry.')
    if (seen.has(nameKey(e))) throw Error('Duplicate parameter.')
    seen.add(nameKey(e)); return { type: e.type, parameter: e.parameter, name: e.name.trim() }
  })
}
export const namesFile = (entries: ParameterName[]) => ({ format: 'bcr32-parameter-names', version: 1, entries })
export function loadNames(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = undefined): ParameterName[] {
  try {
    const store = storage ?? window.localStorage
    const current = store.getItem(parameterNamesKey)
    if (current) return parseNames(JSON.parse(current))
    const old = store.getItem(legacyNamesKey)
    if (old) {
      // One-time migration of exact old factory labels; other user names remain verbatim.
      const migrated = parseNames(JSON.parse(old)).map(e => e.type === 'cc' && e.name === legacyCcNames[e.parameter] ? { ...e, name: ccNames[e.parameter] } : e)
      try { store.setItem(parameterNamesKey, JSON.stringify(namesFile(migrated))) } catch { /* In-memory migration still works. */ }
      return migrated
    }
  } catch { /* Invalid or unavailable storage uses the factory table. */ }
  return defaultNames.map(e => ({ ...e }))
}
export function mergeNames(base: ParameterName[], incoming: ParameterName[]): ParameterName[] {
  const map = new Map(base.map(e => [nameKey(e), e]))
  for (const e of incoming) map.set(nameKey(e), e)
  const result = [...map.values()]
  if (result.length > 4096) throw Error('Table full (up to 4096 entries).')
  return result.sort((a, b) => a.type.localeCompare(b.type) || a.parameter - b.parameter)
}

