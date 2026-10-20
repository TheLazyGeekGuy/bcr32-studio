import { buttonIds, type Bcr32Profile, type Encoder } from './profile'
import { buttonNames, buttonPosition, encoderNames, encoderPosition } from './panel-layout'
import type { VisualLabels } from './presets'

// Cubase MIDI Remote export: turns the editor profile into a driver script for the Steinberg MIDI Remote API
// (midiremote_api_v1, Cubase 12 and later, which replaces the deprecated Generic Remote). The script describes the BCR-32
// surface and the exact MIDI each assigned control sends; it maps no Cubase function: functions are assigned in Cubase
// with the Mapping Assistant (MIDI Learn on the Cubase side). Pure: no DOM, no MIDI, nothing sent.
// Method names checked against the official reference (steinbergmedia.github.io/midiremote_api_doc, API 1.3):
// makeDeviceDriver, mPorts.makeMidiInput/makeMidiOutput, makeDetectionUnit().detectPortPair().expectInputNameContains,
// mSurface.makePushEncoder (mEncoderValue, mPushValue), makeButton (setTypePush, setTypeToggle), mSurfaceValue.mMidiBinding
// (setInputPort, setOutputPort, bindToControlChange, bindToControlChange14Bit, bindToControlChange14BitNRPN, bindToNote,
// bindToPitchBend, bindToChannelPressure), setValueRange, setTypeAbsolute, setTypeRelativeBinaryOffset,
// setTypeRelativeSignedBit, setTypeRelativeTwosComplement, mMapping.makePage.

export const cubaseVendor = 'Behringer', cubaseDevice = 'BCR32'
export const cubaseFileName = `${cubaseVendor}_${cubaseDevice}.js`
export const cubaseFolder = `Driver Scripts/Local/${cubaseVendor}/${cubaseDevice}`
// Port names seen for the device; Cubase keeps the first detection unit that matches (case-sensitive).
export const cubasePortNames = ['BCR32', 'BCR-32', 'BCR 32']

type Kind = 'encoders' | 'pushes' | 'buttons'
export type CubaseBinding = { control: string; kind: Kind; id: number; midi: string; verify?: string }
export type CubaseSkip = { control: string; reason: string }
export type CubaseExport = { fileName: string; folder: string; source: string; bound: CubaseBinding[]; skipped: CubaseSkip[] }
type Plan = { calls: string[]; midi: string; output: boolean; toggle?: boolean; verify?: string } | { skip: string } | null

const unit = 80 // panel coordinate units (1717 x 1440 front panel) per Cubase surface unit
const round = (n: number) => Math.round(n * 100) / 100
const kindName = (kind: Kind) => kind === 'encoders' ? 'Encoder' : kind === 'pushes' ? 'Push' : 'Button'
// Comment text: one line, no characters that could close or break a comment.
const safe = (text: string) => text.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\*\//g, '* /').trim()

function plan(e: Encoder, rotation: boolean): Plan {
  const ch = e.channel - 1, p = e.parameter, range = (lo: number, hi: number) => e.minimum !== lo || e.maximum !== hi ? [`setValueRange(${e.minimum}, ${e.maximum})`] : []
  const cc = (bits: 7 | 14, type: string, verify?: string): Plan => bits === 14 && p > 31
    ? { skip: `CC ${p} as 14-bit: the MSB must be CC 0–31` }
    : { calls: [`${bits === 14 ? 'bindToControlChange14Bit' : 'bindToControlChange'}(${ch}, ${p})`, type], midi: `CC ${p}${bits === 14 ? `/${p + 32} (14-bit)` : ''} · channel ${e.channel}`, output: false, verify }
  switch (e.type) {
    case 'off': return null
    case 'cc':
      if (e.parameterOff) return { skip: 'Parameter Off: the control sends no MIDI message' }
      switch (e.mode) {
        case 'absolute': return { calls: [`bindToControlChange(${ch}, ${p})`, ...range(0, 127)], midi: `CC ${p} · channel ${e.channel}`, output: true }
        case 'abs_14': return p > 31 ? { skip: `CC ${p} as 14-bit: the MSB must be CC 0–31` } : { calls: [`bindToControlChange14Bit(${ch}, ${p})`, ...range(0, 16383)], midi: `CC ${p}/${p + 32} (14-bit) · channel ${e.channel}`, output: true }
        // REL2 = 64 + delta (65 = +1, 63 = -1): Cubase's binary offset.
        case 'rel2': return cc(7, 'setTypeRelativeBinaryOffset()')
        // REL1 sends the minimum for -1 and the maximum for +1: only the pairs that are a standard encoding can be bound.
        case 'rel1':
          if (e.minimum === 127 && e.maximum === 1) return cc(7, 'setTypeRelativeTwosComplement()')
          if (e.minimum === 63 && e.maximum === 65) return cc(7, 'setTypeRelativeBinaryOffset()')
          if (e.minimum === 65 && e.maximum === 1) return cc(7, 'setTypeRelativeSignedBit()', 'REL1 as signed bit: check the rotation direction in Cubase')
          return { skip: `REL1 ${e.minimum}/${e.maximum}: not a relative encoding Cubase recognises (127/1, 63/65 or 65/1)` }
        // REL3 (65 = +1, 1 = -1) and the 14-bit relative modes: closest Cubase type, direction to check on the hardware.
        case 'rel3': return cc(7, 'setTypeRelativeSignedBit()', 'REL3: check the rotation direction in Cubase')
        case 'r1_14': return cc(14, 'setTypeRelativeTwosComplement()', 'R1-14: check the rotation direction in Cubase')
        case 'r2_14': return cc(14, 'setTypeRelativeBinaryOffset()')
        case 'r3_14': return cc(14, 'setTypeRelativeSignedBit()', 'R3-14: check the rotation direction in Cubase')
        // Button INC/DEC on a CC sends successive absolute values: an absolute binding follows them.
        case 'toggle': case 'momentary': case 'inc_dec': if (rotation && e.mode === 'inc_dec') return { skip: 'Rotary INC/DEC: NRPN increment/decrement, cannot be represented' }
          return { calls: [`bindToControlChange(${ch}, ${p})`, ...range(0, 127)], midi: `CC ${p} · channel ${e.channel}`, output: true, toggle: e.mode === 'toggle' }
        default: return { skip: `CC in ${String(e.mode).toUpperCase()} mode: cannot be represented by a MIDI Remote binding` }
      }
    case 'nrpn':
      if (e.mode === 'absolute' || e.mode === 'abs_14' || !rotation && (e.mode === 'toggle' || e.mode === 'momentary'))
        return { calls: [`bindToControlChange14BitNRPN(${ch}, ${p})`, ...range(0, 16383)], midi: `NRPN ${p} · channel ${e.channel}`, output: true, toggle: e.mode === 'toggle', verify: 'NRPN: Cubase expects a 14-bit value (CC 6 then CC 38); check the full travel' }
      return { skip: `NRPN in ${e.mode.toUpperCase()} mode: Cubase binds absolute NRPN only` }
    case 'note': return { calls: [`bindToNote(${ch}, ${p})`], midi: `note ${p} · channel ${e.channel}`, output: true, toggle: e.mode === 'toggle' }
    case 'pb': return { calls: [`bindToPitchBend(${ch})`], midi: `pitch bend · channel ${e.channel}`, output: true }
    case 'at': return e.aftertouchAll !== true
      ? { skip: `polyphonic aftertouch (note ${p}): Cubase binds channel pressure only (Aftertouch All)` }
      : { calls: [`bindToChannelPressure(${ch})`], midi: `channel pressure · channel ${e.channel}`, output: true }
    case 'pc': return { skip: 'Program Change: no MIDI Remote binding' }
    case 'gs': return { skip: 'GS/XG: no MIDI Remote binding' }
    case 'mmc': return { skip: 'MMC: no MIDI Remote binding' }
  }
  return null
}

export function cubaseMidiRemoteScript(profile: Bcr32Profile, labels: VisualLabels, meta: { studioVersion: string; date: string }): CubaseExport {
  const bound: CubaseBinding[] = [], skipped: CubaseSkip[] = [], lines: string[] = []
  const name = (kind: Kind, id: number, index: number) => {
    const custom = labels[kind][index]?.trim(), printed = kind === 'buttons' ? buttonNames[index] : encoderNames[index]
    return `${kindName(kind)} ${id}${custom || printed ? ` (${safe(custom || printed)})` : ''}`
  }
  // One binding statement per assigned control; returns whether the element needs setTypeToggle (buttons only).
  const bind = (kind: Kind, e: Encoder, index: number, target: string, rotation: boolean) => {
    const control = name(kind, e.id, index), result = plan(e, rotation)
    if (!result) return false
    if ('skip' in result) { skipped.push({ control, reason: result.skip }); lines.push(`// ${control}: not bound (${safe(result.skip)})`); return false }
    bound.push({ control, kind, id: e.id, midi: result.midi, ...(result.verify ? { verify: result.verify } : {}) })
    lines.push(`// ${control}: ${result.midi}${result.verify ? ` (${safe(result.verify)})` : ''}`)
    lines.push(`${target}.mMidiBinding.setInputPort(midiInput)${result.output ? '.setOutputPort(midiOutput)' : ''}.${result.calls.join('.')}`)
    return !!result.toggle
  }

  lines.push('', '// 2. SURFACE: BCR-32 front panel (32 push encoders, buttons), exact MIDI bindings from the profile')
  profile.encoders.forEach((rotation, index) => {
    const { x, y } = encoderPosition(rotation.id), v = `encoder${rotation.id}`
    lines.push(`var ${v} = surface.makePushEncoder(${round((x - 70) / unit)}, ${round((y - 70) / unit)}, ${round(140 / unit)}, ${round(140 / unit)})`)
    bind('encoders', rotation, index, `${v}.mEncoderValue`, true)
    const push = profile.pushes[index]
    if (push) bind('pushes', push, index, `${v}.mPushValue`, false)
  })
  profile.buttons.forEach((button, index) => {
    const order = buttonIds.indexOf(button.id), v = `button${button.id}`
    const at = order >= 0 && order < 20 ? buttonPosition(order)
      : order >= 20 && order < 24 ? { x: (order - 20) % 2 ? 1583 : 1422, y: order < 22 ? 1085 : 1207, width: 96 }
        : { x: 37 + (order - 24) * 161.4, y: 1340, width: 140 } // footswitches: below the panel
    lines.push(`var ${v} = surface.makeButton(${round(at.x / unit)}, ${round(at.y / unit)}, ${round(at.width / unit)}, ${round(55 / unit)})`)
    if (bind('buttons', button, order >= 0 ? order : index, `${v}.mSurfaceValue`, false)) lines.push(`${v}.setTypeToggle()`)
  })

  const header = [
    `// ${cubaseFileName} — MIDI Remote script (Cubase 12 and later) generated by MIDI Studio ${safe(meta.studioVersion)} on ${safe(meta.date)}.`,
    '// Installation: copy this file to',
    `//   macOS:   ~/Documents/Steinberg/Cubase/MIDI Remote/${cubaseFolder}/${cubaseFileName}`,
    `//   Windows: %USERPROFILE%\\Documents\\Steinberg\\Cubase\\MIDI Remote\\${cubaseFolder.replace(/\//g, '\\')}\\${cubaseFileName}`,
    '// then, in Cubase, MIDI Remote > Reload Scripts. The BCR-32 is detected by the name of its MIDI port.',
    '// This script describes the surface and its MIDI messages; it assigns no Cubase function: use the Cubase Mapping',
    '// Assistant to map encoders and buttons to the parameters you want.',
    `// Bindings: ${bound.length}. Not bound: ${skipped.length}.${bound.some(b => b.verify) ? ' To check: see the comments that say "check".' : ''}`,
    '',
    '// 1. DRIVER, PORTS AND DETECTION',
    "var midiremote_api = require('midiremote_api_v1')",
    `var deviceDriver = midiremote_api.makeDeviceDriver('${cubaseVendor}', '${cubaseDevice}', 'MIDI Studio')`,
    "var midiInput = deviceDriver.mPorts.makeMidiInput('BCR32 In')",
    "var midiOutput = deviceDriver.mPorts.makeMidiOutput('BCR32 Out')",
    ...cubasePortNames.map(port => `deviceDriver.makeDetectionUnit().detectPortPair(midiInput, midiOutput).expectInputNameContains('${port}').expectOutputNameContains('${port}')`),
    'var surface = deviceDriver.mSurface',
  ]
  const footer = ['', '// 3. MAPPING: one empty page; functions are mapped in Cubase with the Mapping Assistant.', "var page = deviceDriver.mMapping.makePage('MIDI Studio')", '']
  return { fileName: cubaseFileName, folder: cubaseFolder, source: [...header, ...lines, ...footer].join('\n'), bound, skipped }
}
