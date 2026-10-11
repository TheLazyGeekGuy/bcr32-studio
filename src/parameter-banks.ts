import type { ParameterName } from './parameter-names'
export const gsNames = ['Cutoff', 'Resonance', 'Rate', 'Depth', 'Delay', 'Attack', 'Decay', 'Release', 'Modulation', 'Portamento', 'Volume', 'Pan', 'Reverb', 'CRS', 'VAR']
// Manual order only: these local indices are NOT verified BCR32 wire identifiers.
export const gsEntries: ParameterName[] = gsNames.map((name, parameter) => ({ type: 'gs', parameter, name }))
const partParameters = [[8, 'Vibrato Rate'], [9, 'Vibrato Depth'], [10, 'Vibrato Delay'], [32, 'TVF Cutoff'], [33, 'TVF Resonance'], [99, 'TVF/TVA Attack'], [100, 'TVF/TVA Decay'], [102, 'TVF/TVA Release']] as const
const nrpnEntries: ParameterName[] = partParameters.map(([lsb, name]) => ({ type: 'nrpn', parameter: 128 + lsb, name: `Roland M-GS64 · ${name}` }))
const drumFamilies = [[0x18, 'Pitch Coarse'], [0x1a, 'TVA Level'], [0x1c, 'Pan'], [0x1d, 'Reverb Send'], [0x1e, 'Chorus Send'], [0x1f, 'Delay Send']] as const
const drumEntries: ParameterName[] = drumFamilies.flatMap(([msb, name]) => Array.from({ length: 128 }, (_, note) => ({ type: 'nrpn', parameter: msb * 128 + note, name: `Roland M-GS64 · Drum ${note} · ${name}` })))
export const parameterBanks = [
  { id: 'bcr32-gs', name: 'BCR32 · GS (15)', source: 'BCR32 manual · p.33', url: '', entries: gsEntries, localIndices: true },
  { id: 'mgs64-part', name: 'Roland M-GS64 · NRPN (8)', source: 'M-GS64 MIDI implementation · p.37', url: 'https://cdn.roland.com/assets/media/pdf/M-GS64_OM.pdf', entries: nrpnEntries, localIndices: false },
  { id: 'mgs64-drums', name: 'Roland M-GS64 · Drum NRPN (768)', source: 'M-GS64 MIDI implementation · p.37', url: 'https://cdn.roland.com/assets/media/pdf/M-GS64_OM.pdf', entries: drumEntries, localIndices: false },
] as const
