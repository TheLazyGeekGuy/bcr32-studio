import {parseParameterNumber} from './parameter-schema'

// B-Control Language (BCL): the text the BCR2000 / BCF2000 exchange in SysEx command 20 (one line per message), also
// saved as .bcr / .bcf / .txt files or as .syx files of those SysEx messages. Pure functions, no MIDI: text and files
// in, a profile out, and back. Syntax and limits from the third-party "B-Control MIDI Implementation" 1.2.9.
// Project standard CC/NRPN/Note/PB/AT/PC/GS-XG/MMC assignments; preserve ordered protocol statements independently.
// Custom output and semantics outside the live profile are retained, never executed or guessed.
export type BclIssue = { line: number; message: string }
export type BclElementKind = 'encoder' | 'button' | 'fader'
export type BclElement = { kind: BclElementKind; id: number; line: number; easypar: string[] | null; showvalue: boolean | null; mode: string[] | null; custom: boolean; defaultValue: number | null; statements?: string[];sourceLines?:string[] }
export type BclPreset = {
  slot: number | null // historical memory preset1–32, BCR32 memory preset1–64; null: no $store
  name: string; egroups: number; fkeys: boolean; lock: boolean; snapshot: boolean; request: boolean; init: boolean
  elements: BclElement[]
  statements?: string[]
}
export type BclDocument = { model: 'R' | 'F' | null; modelId?:'bcr32'|'bcr2000'|'bcf2000';presets: BclPreset[]; global: Record<string, string> | null; issues: BclIssue[];warnings?:BclIssue[] }
export type Unconverted = { control: string; reason: string }

const newPreset = (): BclPreset => ({ slot: null, name: '', egroups: 4, fkeys: true, lock: false, snapshot: false, request: false, init: false, elements: [], statements: [] })
// A comment starts at ';' except inside the quoted preset name.
function stripComment(line: string) {
  const quote = line.indexOf("'"), semicolon = line.indexOf(';')
  if (semicolon < 0) return line
  if (quote >= 0 && quote < semicolon) { const end = line.lastIndexOf("'"); const after = line.indexOf(';', end > quote ? end : quote); return after < 0 ? line : line.slice(0, after) }
  return line.slice(0, semicolon)
}

export function parseBcl(input: string | string[]): BclDocument {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/)
  const doc: BclDocument = { model: null, presets: [], global: null, issues: [] }
  let preset: BclPreset | null = null, element: BclElement | null = null, section: 'none' | 'global' | 'preset' | 'element' = 'none'
  const issue = (line: number, message: string) => doc.issues.push({ line, message })
  const current = () => preset ?? (preset = newPreset())
  lines.forEach((raw, index) => {
    const n = index + 1, line = stripComment(raw).trim()
    if (!line) {if(section==='element')element?.sourceLines?.push(raw);return}
    const words = line.split(/\s+/), head = words[0]
    if (head === '$rev') {
      const m=/^([RF])/.exec(words[1]==='BCR32'?'R':words[1]??''),id=words[1]==='BCR32'?'bcr32':m?.[1]==='R'?'bcr2000':'bcf2000'
      if(!m)issue(n,'Unknown model in $rev (expected R, F or BCR32)')
      else if(doc.modelId&&doc.modelId!==id)issue(n,'Mixed controller model revisions')
      else {doc.model=m[1] as 'R'|'F';doc.modelId=id}
      section='none';return
    }
    if (head === '$end') { if (preset) doc.presets.push(preset); preset = null; element = null; section = 'none'; return }
    if (head === '$global') { doc.global ??= {}; section = 'global'; element = null; return }
    if (head === '$preset') { if (preset) doc.presets.push(preset); preset = newPreset(); section = 'preset'; element = null; return }
    if (head === '$encoder' || head === '$button' || head === '$fader') {
      const id = parseParameterNumber(words[1] ?? ''), kind = head.slice(1) as BclElementKind, max = kind === 'encoder' ? doc.modelId==='bcr32'?32:56 : kind === 'button' ? doc.modelId==='bcr32'?50:64 : 9
      if(doc.modelId==='bcr32'&&kind==='fader'){issue(n,'BCF2000 fader selectors are not BCR32 controls');section='none';element=null;return}
      if (!Number.isInteger(id) || id < 1 || id > max) { issue(n, `${head} needs a number from 1 to ${max}`); section = 'none'; element = null; return }
      const list = current().elements, existing = list.findIndex(e => e.kind === kind && e.id === id)
      element = { kind, id, line: n, easypar: null, showvalue: null, mode: null, custom: false, defaultValue: null, statements: [],sourceLines:[] }
      if (existing >= 0) list[existing] = element; else list.push(element) // a selector resets its element
      section = 'element'; return
    }
    if (head === '$store') { const slot = parseParameterNumber(words[1] ?? ''),max=doc.modelId==='bcr32'?64:32; if (!Number.isInteger(slot) || slot < 1 || slot > max) issue(n, `$store needs a preset number from 1 to ${max}`); else current().slot = slot; return }
    if (head === '$recall') {const slot=parseParameterNumber(words[1] ?? '');if(!Number.isInteger(slot)||slot<1||slot>32)issue(n,'$recall needs a preset number from 1 to 32');return}
    if (head.startsWith('$')) { issue(n, `Unknown statement ${head}`); return }
    if (!head.startsWith('.')) { issue(n, 'Not a BCL statement'); return }
    if (section === 'global') { doc.global![head.slice(1)] = words.slice(1).join(' '); return }
    if (section === 'preset') {
      preset!.statements!.push(line)
      const p = current(), on = words[1] === 'on'
      if (head === '.name') { const m = /^\.name\s+'(.*)$/.exec(line); p.name = m ? m[1].replace(/'\s*$/, '').trimEnd() : ''; if (!m) issue(n, ".name needs a quoted name") }
      else if (head === '.egroups') { const g = parseParameterNumber(words[1] ?? ''); if ([1, 2, 3, 4].includes(g)) p.egroups = g; else issue(n, '.egroups needs 1 to 4') }
      else if (head === '.fkeys') p.fkeys = on
      else if (head === '.lock') p.lock = on
      else if (head === '.snapshot') p.snapshot = on
      else if (head === '.request') p.request = on
      else if (head === '.init') p.init = true
      else if (head !== '.tx') issue(n, `Unknown preset setting ${head}`)
      return
    }
    if (section === 'element' && element) {
      element.sourceLines!.push(raw)
      element.statements!.push(line)
      if (head === '.easypar') element.easypar = words.slice(1)
      else if (head === '.showvalue') element.showvalue = words[1] === 'on'
      else if (head === '.mode') element.mode = words.slice(1)
      else if (head === '.default') element.defaultValue = words[1] === 'off' ? null : parseParameterNumber(words[1] ?? '')
      else if (head === '.tx') element.custom = true
      else if (!['.resolution', '.minmax', '.motor', '.override', '.keyoverride', '.local'].includes(head)) {element.custom=true;(doc.warnings??=[]).push({line:n,message:`Unknown element setting ${head}; original control retained`})}
      return
    }
    issue(n, `${head} outside a section`)
  })
  if (preset) doc.presets.push(preset)
  return doc
}

// .syx file: every SysEx message of command 20 carries one BCL line after its two index bytes.
export const bclFileLimits={bytes:16*1024*1024,lines:100000,lineBytes:600} as const
export function bclLinesFromSyx(bytes: ArrayLike<number>): { lines: string[]; model: number | null; issues: BclIssue[] } {
  if(!Number.isSafeInteger(bytes.length)||bytes.length<0||bytes.length>bclFileLimits.bytes)throw Error('BCL file size limit exceeded')
  const lines: string[] = [], issues: BclIssue[] = []
  let model: number | null = null, start = -1, expected = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0xf0) {if(start>=0)issues.push({line:lines.length+1,message:'Nested or incomplete SysEx frame'});start = i}
    else if (bytes[i] === 0xf7 && start >= 0) {
      const at=start;start=-1
      if (i-at+1 < 10 || bytes[at+1] !== 0x00 || bytes[at+2] !== 0x20 || bytes[at+3] !== 0x32 || ![0x14, 0x15, 0x64,0x7f].includes(bytes[at+5]) || bytes[at+6] !== 0x20) continue
      if(i-at-9>bclFileLimits.lineBytes||lines.length>=bclFileLimits.lines)throw Error('BCL line budget exceeded')
      const index = bytes[at+7] << 7 | bytes[at+8]
      if (index === 0) expected = 0
      if (index !== expected) issues.push({ line: lines.length + 1, message: `Message index ${index} where ${expected} was expected` })
      expected = index + 1
      if(bytes[at+5]!==0x7f&&model!==null&&model!==bytes[at+5])issues.push({line:lines.length+1,message:'Mixed controller models'})
      if (bytes[at+5] !== 0x7f) model = bytes[at+5]
      let line='';for(let p=at+1;p<i;p++)if(!Number.isInteger(bytes[p])||bytes[p]<0||bytes[p]>127)throw Error('Malformed BCL SysEx data')
      for(let p=at+9;p<i;p++){const c=bytes[p];if(c!==9&&(c<32||c>126))throw Error('BCL text contains non-ASCII data');line+=String.fromCharCode(c)}
      lines.push(line)
    }
  }
  if(start>=0)issues.push({line:lines.length+1,message:'Unterminated SysEx frame'})
  return { lines, model, issues }
}

// BCL lines as the SysEx messages a .syx file holds (and a transfer would send): F0 00 20 32 <device> <model> 20 <index> <text> F7.
export function bclToSyx(lines: string[], model: number, deviceId = 0x7f): number[] {
  if(![0x14,0x15,0x64,0x7f].includes(model)||!Number.isInteger(deviceId)||deviceId<0||deviceId>127||!lines.length||lines.length>16384||lines.some(l=>l.length>bclFileLimits.lineBytes||/[^\x20-\x7e\t]/.test(l)))throw Error('Invalid BCL file envelope')
  return lines.flatMap((line, index) => [0xf0, 0x00, 0x20, 0x32, deviceId, model, 0x20, (index >> 7) & 0x7f, index & 0x7f, ...Array.from(line, c => c.charCodeAt(0) & 0x7f), 0xf7])
}
