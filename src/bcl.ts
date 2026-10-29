import { createEncoder, valueLimit, type Bcr32Profile, type Encoder, type EncoderMode } from './profile'
import type { LedMode } from './led-modes'
import { statementValue } from './parameter-state'
import { parseParameterNumber } from './parameter-schema'

import {parseBcl,type BclElementKind,type BclElement,type BclPreset,type Unconverted} from './bcl-document'
export {parseBcl, bclFileLimits, bclLinesFromSyx, bclToSyx} from './bcl-document'
export type {BclIssue,BclElementKind,BclElement,BclPreset,BclDocument,Unconverted} from './bcl-document'

// ----- BCL element <-> editor assignment (Encoder) -----
const rotationModes: Record<string, EncoderMode> = { absolute: 'absolute', 'absolute/14': 'abs_14', 'relative-1': 'rel1', 'relative-2': 'rel2', 'relative-3': 'rel3', 'relative-1/14': 'r1_14', 'relative-2/14': 'r2_14', 'relative-3/14': 'r3_14', 'inc/dec': 'inc_dec' }
const ringModes: Record<string, LedMode> = { off: 'off', '1dot': '1dot_in', '1dot/off': '1dot_ex', '12dot': '2dot_in', '12dot/off': '2dot_ex', bar: 'bar', 'bar/off': 'bar_ex', spread: 'spread', pan: 'pan', qual: 'qual', cut: 'cut', damp: 'damp' }
const invert = <T extends string>(map: Record<string, T>) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<T, string>
const rotationNames = invert(rotationModes), ringNames = { ...invert(ringModes), dot: '1dot' } as Record<LedMode, string>
const int = (word: string | undefined, min: number, max: number) => { const v = word === undefined ? NaN : parseParameterNumber(word); return Number.isInteger(v) && v >= min && v <= max ? v : null }
const channel = (word?: string) => int(word, 1, 16)
export const gsParameters = ['cutoff', 'resonance', 'v-rate', 'v-depth', 'v-delay', 'eg-attack', 'eg-decay', 'eg-release', 'modulation', 'p-time', 'volume', 'panorama', 'rev-send', 'crs-send', 'dly-send']
const mmcNames = { play: 'Play', pause: 'Pause', stop: 'Stop', fwd: 'Forward', rew: 'Rewind', locate: 'Location', 'punch-in': 'In', 'punch-out': 'Out' } as const
const rateNames = { noloc: 'off', '24f': '24', '25f': '25', '30df': '30d', '30f': '30' } as const

// One BCL element to an assignment for the given control, or the reason it cannot be converted.
export const assignmentBinding = (e: Encoder) => JSON.stringify([e.type, e.channel, e.parameter, e.minimum, e.maximum, e.mode, e.increment, e.display, e.ledMode, e.parameterOff, e.minimumOff, e.aftertouchAll, e.mmc, e.pc, e.gsParameter])
export function preserveElement(e: BclElement, encoder: Encoder, opaque = false): Encoder {
  if (e.statements === undefined) return encoder
  return { ...encoder, parameterState: { protocol: 'bcl', statements: [...(opaque&&e.sourceLines?e.sourceLines:e.statements ?? [])], binding: assignmentBinding(encoder), opaque } }
}
export function elementToEncoder(e: BclElement, base: Encoder, rotation: boolean): Encoder | string {
  if(e.custom)return 'custom output (.tx) is retained through the opaque BCL compatibility path'
  if (!e.easypar) return preserveElement(e, { ...createEncoder(base.id), mode: rotation ? 'absolute' : 'momentary', display: e.showvalue === true }, !!e.statements?.length)
  // .easypar turns .showvalue off on the hardware: only an explicit .showvalue on shows the value.
  const [type, ...a] = e.easypar, out: Encoder = { ...createEncoder(base.id), display: e.showvalue === true }
  if (rotation && e.mode?.[0] && !ringModes[e.mode[0]]) return 'unknown LED ring mode'
  if (rotation && e.mode?.[0] && ringModes[e.mode[0]]) out.ledMode = ringModes[e.mode[0]]
  if (type === 'MMC' && !rotation) {
    const device = a[0] === 'all' ? 'all' : int(a[0], 0, 126), command = mmcNames[a[1] as keyof typeof mmcNames], frameRate = rateNames[a[3] as keyof typeof rateNames]
    const location = /^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/.exec(a[2] ?? '')?.slice(1).map(Number)
    if (device === null || !command || !frameRate || frameRate !== 'off' && (!location || location[0] > 23 || location[1] > 59 || location[2] > 59 || location[3] >= (frameRate === '24' ? 24 : frameRate === '25' ? 25 : 30))) return 'invalid MMC statement'
    Object.assign(out, { type: 'mmc', mode: 'momentary', mmc: { deviceId: device, command, frameRate, locate: location ?? [0,0,0,0] } })
    return preserveElement(e, out, e.custom)
  }
  const ch = channel(a[0]); if (ch === null) return 'invalid channel'
  out.channel = ch
  if (!rotation && ['CC','NRPN','AT','GS/XG'].includes(type) && a[3] === 'off') out.minimumOff = true
  if (type === 'PC') {
    const msb = a[1] === 'off' ? 'off' : int(a[1], 0, 127), lsb = a[2] === 'off' ? 'off' : int(a[2], 0, 127), program = rotation || a[3] === 'off' ? 'off' : int(a[3], 0, 127)
    if (msb === null || lsb === null || program === null) return 'invalid program change statement'
    Object.assign(out, { type: 'pc', mode: rotation ? 'absolute' : 'momentary', pc: { bankMsb: msb, bankLsb: lsb, program, continuous: rotation }, parameter: 0, minimum: rotation ? 0 : program === 'off' ? 0 : program, maximum: rotation ? 127 : program === 'off' ? 0 : program })
  } else if (type === 'GS/XG') {
    const parameter = gsParameters.indexOf(a[1]), v1 = int(a[2], 0, 127), v2 = a[3] === 'off' ? 0 : int(a[3], 0, 127)
    if (parameter < 0 || v1 === null || v2 === null || rotation && v1 > v2 || !rotation && !['toggleoff', 'toggleon'].includes(a[4])) return 'invalid GS/XG statement'
    Object.assign(out, { type: 'gs', gsParameter: a[1], parameter, minimum: Math.min(v1,v2), maximum: Math.max(v1,v2), mode: rotation ? 'absolute' : a[4] === 'toggleon' ? 'toggle' : 'momentary' })
    if (!rotation && v1 < v2) return 'on value below off value is not converted'
  } else if (type === 'CC' || type === 'NRPN') {
    const p = int(a[1], 0, type === 'NRPN' ? 16383 : 127), v1 = int(a[2], 0, 16383), v2 = a[3] === 'off' ? 0 : int(a[3], 0, 16383)
    if (p === null || v1 === null || v2 === null) return 'invalid number'
    out.type = type === 'CC' ? 'cc' : 'nrpn'; out.parameter = p
    if (rotation) {
      const mode = rotationModes[a[4]]
      if (!mode || (type === 'CC' && mode === 'inc_dec')) return `mode ${a[4] ?? '(none)'} is not converted`
      if (v1 > v2) return 'reversed range (minimum above maximum) is not converted'
      out.mode = mode; out.minimum = v1; out.maximum = v2
    } else {
      // Keys: "On" sends Value1, "Off" Value2; the editor's key sends its maximum on press, its minimum on release.
      if (a[4] === 'increment') { const step = int(a[5], -127, 127); if (!step) return 'invalid increment'; out.mode = 'inc_dec'; out.increment = step; out.minimum = Math.min(v1, v2); out.maximum = Math.max(v1, v2) }
      else if (a[4] === 'toggleoff' || a[4] === 'toggleon') { if (v1 < v2) return 'on value below off value is not converted'; out.mode = a[4] === 'toggleon' ? 'toggle' : 'momentary'; out.maximum = v1; out.minimum = v2 }
      else return `mode ${a[4] ?? '(none)'} is not converted`
    }
  } else if (type === 'NOTE' && !rotation) {
    const note = int(a[1], 0, 127), velocity = int(a[2], 0, 127)
    if (note === null || velocity === null || !['toggleoff', 'toggleon'].includes(a[3])) return 'invalid note statement'
    Object.assign(out, { type: 'note', parameter: note, minimum: 0, maximum: Math.max(1, velocity), mode: a[3] === 'toggleon' ? 'toggle' : 'momentary' })
  } else if (type === 'PB' && rotation) {
    const range = int(a[1], 0, 127); if (range === null) return 'invalid range'
    Object.assign(out, { type: 'pb', parameter: 0, minimum: 64 - (range >> 1), maximum: Math.min(127, 64 + (range >> 1)), mode: 'absolute' })
  } else if (type === 'AT') {
    const all = a[1] === 'all', note = all ? 0 : int(a[1], 0, 127), v1 = int(a[2], 0, 127), v2 = a[3] === 'off' ? 0 : int(a[3], 0, 127)
    if (note === null || v1 === null || v2 === null) return 'invalid aftertouch statement'
    Object.assign(out, { type: 'at', parameter: note, aftertouchAll: all })
    if (rotation) { if (v1 > v2) return 'reversed range is not converted'; Object.assign(out, { minimum: v1, maximum: v2, mode: 'absolute' }) }
    else if (a[4] === 'toggleoff' || a[4] === 'toggleon') { if (v1 < v2) return 'on value below off value is not converted'; Object.assign(out, { maximum: v1, minimum: v2, mode: a[4] === 'toggleon' ? 'toggle' : 'momentary' }) }
    else if (a[4] === 'increment') { const step = int(a[5], -127, 127); if (!step) return 'invalid increment'; Object.assign(out, { minimum: Math.min(v1, v2), maximum: Math.max(v1, v2), mode: 'inc_dec', increment: step }) }
    else return `mode ${a[4] ?? '(none)'} is not converted`
  } else return `${type ?? 'empty'} output is not converted yet`
  if (out.maximum > valueLimit(out)) return 'range exceeds the live mode; BCL retained without interpretation'
  return preserveElement(e, out, e.custom || !!e.statements?.some(l => /^\.(minmax|local)\b/.test(l)) || !rotation && !!e.mode)
}

// ring: whether the element has an LED ring (.mode); a BCF2000 fader has none.
export function encoderToElement(e: Encoder, rotation: boolean, ring = rotation): string[] | string {
  if(e.customAssignment)return e.customAssignment.sourceBcl.split(/\r\n|\r|\n/)
  if(e.type==='sysex'||e.type==='bcl')return 'Custom program missing; refusing an OFF conversion'
  if (e.parameterState?.protocol === 'bcl' && e.parameterState.binding === assignmentBinding(e)) return e.parameterState.opaque?[...e.parameterState.statements]:e.parameterState.statements.map(l => '  ' + l)
  if (e.parameterState?.protocol === 'bcl' && e.parameterState.opaque) return 'Preserved BCL output must be edited through its protocol fields or text'
  if (e.type === 'off') return []
  const mode = rotation ? rotationNames[e.mode] : e.mode === 'toggle' ? 'toggleon' : e.mode === 'inc_dec' ? 'increment' : 'toggleoff'
  let easypar: string
  switch (e.type) {
    case 'pc': {
      const p = e.pc ?? { bankMsb: 'off', bankLsb: 'off', program: e.maximum }
      if (rotation && (e.minimum !== 0 || e.maximum !== 127)) return 'PC range override requires BCL .minmax'
      easypar = `PC ${e.channel} ${p.bankMsb} ${p.bankLsb}${rotation ? '' : ` ${p.program}`}`; break
    }
    case 'gs': {
      const parameter = e.gsParameter ?? gsParameters[e.parameter]
      if (!parameter || !gsParameters.includes(parameter)) return 'Unknown B-Control GS/XG parameter'
      easypar = rotation ? `GS/XG ${e.channel} ${parameter} ${e.minimum} ${e.maximum}` : `GS/XG ${e.channel} ${parameter} ${e.maximum} ${e.minimum} ${mode}`; break
    }
    case 'mmc': {
      if (rotation || !e.mmc) return 'MMC requires a button and MMC settings'
      const m = e.mmc, command = Object.entries(mmcNames).find(([,v]) => v === m.command)?.[0], rate = Object.entries(rateNames).find(([,v]) => v === m.frameRate)?.[0]
      const [h,mi,s,f] = m.locate
      if (!command || !rate || m.frameRate !== 'off' && (h > 23 || mi > 59 || s > 59 || f >= (m.frameRate === '24' ? 24 : m.frameRate === '25' ? 25 : 30))) return 'Invalid MMC location'
      easypar = `MMC ${m.deviceId} ${command} ${m.locate.slice(0,3).map(v => String(v).padStart(2,'0')).join(':')}.${String(f).padStart(2,'0')} ${rate}`; break
    }
    case 'cc': case 'nrpn':
      if (e.parameterOff) return 'Parameter Off has no BCL equivalent'
      if (rotation && (!mode || (e.type === 'cc' && e.mode === 'inc_dec'))) return `mode ${e.mode} has no BCL equivalent`
      easypar = rotation ? `${e.type.toUpperCase()} ${e.channel} ${e.parameter} ${e.minimum} ${e.maximum} ${mode}`
        : `${e.type.toUpperCase()} ${e.channel} ${e.parameter} ${mode === 'increment' ? `${e.minimum} ${e.maximum} increment ${e.increment ?? 1}` : `${e.maximum} ${e.minimum} ${mode}`}`
      break
    case 'note': if (rotation) return 'Note on an encoder has no BCL equivalent'; easypar = `NOTE ${e.channel} ${e.parameter} ${e.maximum} ${mode === 'toggleon' ? 'toggleon' : 'toggleoff'}`; break
    case 'pb': { if (!rotation) return 'Pitch bend on a key has no BCL equivalent'; const range = e.maximum - e.minimum; if (e.minimum !== 64 - (range >> 1)) return 'Pitch bend range not centred on 64'; easypar = `PB ${e.channel} ${range}`; break }
    case 'at': { const scope = e.aftertouchAll ? 'all' : e.parameter; easypar = rotation ? `AT ${e.channel} ${scope} ${e.minimum} ${e.maximum}` : mode === 'increment' ? `AT ${e.channel} ${scope} ${e.minimum} ${e.maximum} increment ${e.increment ?? 1}` : `AT ${e.channel} ${scope} ${e.maximum} ${e.minimum} ${mode}`; break }
    default: return 'Output is not converted to BCL yet'
  }
  const lines = [`  .easypar ${easypar}`, `  .showvalue ${e.display === false ? 'off' : 'on'}`]
  if (ring) lines.push(`  .mode ${ringNames[e.ledMode ?? '1dot_in'] ?? '1dot'}`)
  if (e.parameterState?.protocol === 'bcl') {
    lines.push(...e.parameterState.statements.filter(l => !/^\.(easypar|showvalue)\b/.test(l) && !(ring && /^\.mode\b/.test(l))).map(l => '  ' + l))
  }
  return lines
}

// ----- Preset <-> profile (BCR2000: encoders 1–56, pushes = buttons 1–32, buttons 33–64) -----
// Faders (BCF2000) are kept as encoders `faders.first`.. of the profile; without `faders` they are not converted.
export type FaderMap = { first: number; count: number; physicalCount?: number }
export function presetToProfile(preset: BclPreset, base: Bcr32Profile, faders?: FaderMap): { profile: Bcr32Profile; unconverted: Unconverted[] } {
  const unconverted: Unconverted[] = []
  // Keys the preset gives a hardware role, so a definition there is not active: function keys while .fkeys on and
  // .lock off, preset keys while .lock off, group keys used as group selectors (57–58 from 2 groups, 59 from 3, 60 at 4).
  const groupKey = (id: number) => id >= 57 && id <= 60 && preset.egroups >= Math.max(2, id - 56)
  const inactive = (id: number) => (id >= 53 && id <= 56 && preset.fkeys && !preset.lock) || ((id === 63 || id === 64) && !preset.lock) || groupKey(id)
  const convert = (list: Encoder[], kind: BclElementKind, filter: (id: number) => boolean, rotation: boolean, label: string) => list.map(control => {
    const isFader = kind === 'encoder' && !!faders && control.id >= faders.first && control.id < faders.first + faders.count
    const el = isFader ? preset.elements.find(e => e.kind === 'fader' && e.id === control.id - faders!.first + 1) : preset.elements.find(e => e.kind === kind && e.id === control.id && filter(e.id))
    if (!el) return { ...createEncoder(control.id), mode: rotation ? 'absolute' : 'momentary' } as Encoder
    if (kind === 'button' && inactive(el.id) && el.easypar) { unconverted.push({ control: `${label} ${el.id}`, reason: 'preserved but inactive with this preset’s .fkeys/.lock/.egroups' }); return preserveElement(el, { ...createEncoder(control.id), mode: 'momentary' }, true) }
    const result = elementToEncoder(el, control, rotation)
    if (typeof result === 'string') { unconverted.push({ control: `${isFader ? 'Fader' : label} ${el.id}`, reason: result + '; BCL preserved' }); return preserveElement(el, { ...createEncoder(control.id), mode: rotation ? 'absolute' : 'momentary' }, true) }
    return result
  })
  for (const e of preset.elements) if (e.kind === 'fader' && (!faders || e.id > faders.count)) unconverted.push({ control: `Fader ${e.id}`, reason: faders ? 'no such fader on this model' : 'faders exist on the BCF2000 only' })
  if (faders) for (const e of preset.elements) if (e.kind === 'encoder' && e.id >= faders.first && e.easypar) unconverted.push({ control: `Encoder ${e.id}`, reason: 'no such encoder on this model' })
  const profile: Bcr32Profile = { ...base, encoders: convert(base.encoders, 'encoder', () => true, true, 'Encoder'), pushes: convert(base.pushes, 'button', id => id <= 32, false, 'Push'), buttons: convert(base.buttons, 'button', id => id > 32, false, 'Button'), parameters: { ...base.parameters, preset: { protocol: 'bcl', statements: [...(preset.statements ?? [])] }, extraElements: preset.elements.filter(e => e.kind === 'fader' ? !faders || e.id > faders.count : e.kind === 'encoder' ? e.id > base.encoders.length || !!faders && e.id >= faders.first : ![...base.pushes, ...base.buttons].some(b => b.id === e.id)).map(e => ({ selector: `$${e.kind} ${e.id}`, state: { protocol: 'bcl', statements: [...(e.statements ?? [])], opaque: true } })) } }
  return { profile, unconverted }
}

// Preset settings follow from the keys used: a programmed function key needs .fkeys off, a programmed preset key
// .lock on, a programmed group key fewer encoder groups.
export function presetSettings(profile: Bcr32Profile) {
  const used = (id: number) => (profile.buttons.find(b => b.id === id)?.type ?? 'off') !== 'off'
  const state = profile.parameters?.preset, explicitGroups = Number(statementValue(state, 'egroups'))
  return { fkeys: statementValue(state, 'fkeys') === undefined ? ![53, 54, 55, 56].some(used) : statementValue(state, 'fkeys') === 'on', lock: statementValue(state, 'lock') === undefined ? used(63) || used(64) : statementValue(state, 'lock') === 'on', egroups: [1,2,3,4].includes(explicitGroups) ? explicitGroups : used(57) || used(58) ? 1 : used(59) ? 2 : used(60) ? 3 : 4 }
}
export const bclName = (name: string) => name.replace(/[^\x20-\x7e]/g, ' ').replace(/'/g, ' ').slice(0, 24)
export function presetParameterState(profile: Bcr32Profile) {
  const settings = presetSettings(profile)
  return profile.parameters?.preset ?? { protocol: 'bcl', statements: ['.snapshot off', '.request off', `.egroups ${settings.egroups}`, `.fkeys ${settings.fkeys ? 'on' : 'off'}`, `.lock ${settings.lock ? 'on' : 'off'}`, '.init'] }
}

export function profileToBcl(profile: Bcr32Profile, name: string, model: 'R' | 'F' = 'R', slot: number | null = null, faders?: FaderMap): { lines: string[]; unconverted: Unconverted[] } {
  const unconverted: Unconverted[] = [], settings = presetSettings(profile)
  const original = profile.parameters?.preset?.statements
  const lines = [`$rev ${model}1`, ...(profile.parameters?.global ? ['$global', ...profile.parameters.global.statements.map(l => '  ' + l)] : []), '$preset', ...(original?.length ? [...original.filter(l => !/^\.name\b/.test(l)), `.name '${bclName(name).padEnd(24)}'`].map(l => '  ' + l) : [`  .name '${bclName(name).padEnd(24)}'`, '  .snapshot off', '  .request off', `  .egroups ${settings.egroups}`, `  .fkeys ${settings.fkeys ? 'on' : 'off'}`, `  .lock ${settings.lock ? 'on' : 'off'}`, '  .init'])]
  const emit = (list: Encoder[], selector: string, rotation: boolean, label: string) => list.forEach(e => {
    const fader = rotation && !!faders && e.id >= faders.first && e.id < faders.first + faders.count
    const body = encoderToElement(e, rotation, rotation && !fader)
    if (typeof body === 'string') {
      unconverted.push({ control: `${label} ${e.id}`, reason: body })
      if (e.parameterState?.protocol === 'bcl' && e.parameterState.statements.length) lines.push(fader ? `$fader ${e.id - faders!.first + 1}` : `${selector} ${e.id}`, ...e.parameterState.statements.map(l => '  ' + l))
      return
    }
    if (!body.length) return
    if (rotation && e.id <= 32 && Math.ceil(e.id / 8) > settings.egroups) unconverted.push({ control: `${label} ${e.id}`, reason: `kept, but unreachable with .egroups ${settings.egroups}` })
    lines.push(fader ? `$fader ${e.id - faders!.first + 1}` : `${selector} ${e.id}`, ...body)
  })
  emit(profile.encoders, '$encoder', true, 'Encoder')
  emit(profile.pushes, '$button', false, 'Push')
  emit(profile.buttons, '$button', false, 'Button')
  for (const extra of profile.parameters?.extraElements ?? []) {
    const faderId = /^\$fader (\d+)$/.exec(extra.selector)?.[1]
    const mapped = faderId && faders && profile.encoders.find(e => e.id === faders.first + Number(faderId) - 1)
    if (mapped && (mapped.type !== 'off' || mapped.parameterState)) continue
    lines.push(extra.selector, ...extra.state.statements.map(l => '  ' + l))
  }
  if (slot !== null) lines.push(`$store ${slot}`)
  lines.push('$end')
  return { lines, unconverted }
}
