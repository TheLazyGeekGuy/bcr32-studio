import {parseBcl} from '../../../bcl-document'
import {elementToEncoder} from '../../../bcl'
import {createEncoder,type Encoder} from './profile'
import {standardProgramBody} from './standard-program'
import {parseCustomAssignment,type CustomAssignment} from '../../../bcl-tx'
import {programSelector,type ProgramTarget} from './custom-program'
import type {PresetReadResult} from './controller-presets'

export const supportsCustomProgram = (firmware:string|null) => firmware==='1.0.2'||firmware==='1.0.3'
const clean=(body:string)=>body.split(/\r?\n/).map(l=>l.split(';')[0].trim().replace(/\s+/g,' ')).filter(Boolean)

/** A STORE must not silently omit a custom program currently shown in the UI. */
export function assertWorkingPrograms(text:string,expected:readonly {target:ProgramTarget;program:CustomAssignment}[]){
  for(const {target,program} of expected){
    const actual=parseCustomAssignment(controlFromWorking(text,target))
    const shape=(p:CustomAssignment)=>JSON.stringify({range:p.range,messages:p.messages.map(m=>m.tokens.map(t=>t.kind==='byte'?['byte',t.value]:t.kind==='value'?['value',t.low,t.high]:['unsupported',t.raw]))})
    if(program.conversionStatus!=='exact'||actual.conversionStatus!=='exact'||shape(actual)!==shape(program))throw Error(`${programSelector(target)}: displayed SysEx/BCL differs from hardware; STORE stopped before writing. Apply the program and wait for independent read-back, or reread the hardware.`)
  }
}

/** A selected-control fragment, never a preset/global/store job. Unknown instructions stay file-only. */
export function programFragment(lines:readonly string[]) {
  if(lines[0]!=='$rev BCR32'||lines.at(-1)!=='$end'||lines.length<4||lines.length>260)throw Error('A single BCR32 control fragment is required')
  if(!/^\$(?:encoder (?:[1-9]|[12]\d|3[0-2])|button (?:[1-9]|[1-4]\d|50))$/.test(lines[1]))throw Error('Invalid BCR32 control selector')
  const body=lines.slice(2,-1).join('\n'),statements=clean(body)
  if(!statements.length||statements.some(l=>!/^\.(?:tx|minmax|default|showvalue|easypar|mode|resolution)\b/.test(l)))throw Error('Unsupported hardware control instruction')
  const hasTx=statements.some(l=>l.startsWith('.tx '))
  if(hasTx){if(parseCustomAssignment(body).conversionStatus!=='exact')throw Error('Only fully understood SysEx programs may be sent')}
  else {
    const d=parseBcl(lines.join('\n')),e=d.presets[0]?.elements[0]
    if(d.issues.length||d.warnings?.length||!e||e.custom)throw Error('Original standard control cannot be restored by the qualified path')
    const a=e.easypar??['OFF'],n=(s:string|undefined,max:number,min=0)=>s!==undefined&&/^\d+$/.test(s)&&Number(s)>=min&&Number(s)<=max
    if(a[0]==='OFF'){if(a.length!==1)throw Error('Invalid OFF restoration')}
    else if(['CC','NRPN'].includes(a[0])){
      if(a.length<6||a.length>7||!n(a[1],16,1)||!n(a[2],a[0]==='CC'?127:16383)||!n(a[3],16383)||!n(a[4],16383)||!['absolute','absolute/14','relative-1','relative-2','relative-3','relative-1/14','relative-2/14','relative-3/14','inc/dec','toggleon','toggleoff','increment'].includes(a[5])||(a[5]==='increment'?!/^-?\d+$/.test(a[6]??'')||Math.abs(Number(a[6]))>127||Number(a[6])===0:a.length!==6))throw Error('Invalid standard control program')
    }else if(typeof elementToEncoder(e,createEncoder(e.id),lines[1].startsWith('$encoder '))==='string')throw Error('Unqualified standard BCL assignment')
    for(const l of statements){
      if(l.startsWith('.easypar '))continue
      if(/^\.showvalue (on|off)$/.test(l)||/^\.mode (off|1dot|1dot\/off|12dot|12dot\/off|bar|bar\/off|spread|pan|qual|cut|damp)$/.test(l)||lines[1].startsWith('$button ')&&l==='.mode down')continue
      const w=l.split(' ')
      if(w[0]==='.default'&&w.length===2&&(w[1]==='off'||n(w[1],16383)))continue
      if(w[0]==='.minmax'&&w.length===3&&n(w[1],16383)&&n(w[2],16383)&&Number(w[1])<=Number(w[2]))continue
      throw Error('Original control has an unqualified restoration instruction')
    }
  }
  return {selector:lines[1],body,hasTx}
}

export function controlFromWorking(text:string,target:ProgramTarget) {
  const lines=text.split('\n'),selector=programSelector(target)
  if(!selector||lines[0]!=='$rev BCR32'||lines[1]!=='$preset'||lines.at(-1)!=='$end'||lines.some(l=>/^\s*\$(?:global|store|recall)/.test(l)))throw Error('Complete current BCR32 preset required')
  const doc=parseBcl(text)
  if(doc.issues.length||doc.presets.length!==1||lines.filter(l=>l.trim()===selector).length!==1)throw Error('Current preset has an ambiguous or missing control')
  const e=doc.presets[0].elements.find(e=>`$${e.kind} ${e.id}`===selector)
  if(!e)throw Error('Selected control is absent from the current preset')
  return (e.sourceLines??[]).join('\n')
}
export function fragmentForBody(target:ProgramTarget,body:string) {
  const lines=['$rev BCR32',programSelector(target)??'',...body.split(/\r?\n/),'$end'];programFragment(lines);return lines
}
function restOfPreset(text:string,target:ProgramTarget) {
  controlFromWorking(text,target)
  const selector=programSelector(target),lines=text.split('\n'),at=lines.findIndex(l=>l.trim()===selector)
  let end=at+1;while(end<lines.length&&!lines[end].trim().startsWith('$'))end++
  // Preserve quoted preset names and unrelated comments; a semicolon inside a name is data.
  return [...lines.slice(0,at),...lines.slice(end)].map(l=>l.trim()).filter(Boolean).join('\n')
}
function sameProgram(actual:string,expected:CustomAssignment) {
  const a=clean(actual),wanted=clean(expected.sourceBcl)
  const tx=(lines:string[])=>lines.filter(l=>l.startsWith('.tx ')).map(l=>parseCustomAssignment(l).messages[0].tokens.map(t=>t.kind==='byte'?`b${t.value}`:t.raw).join(' '))
  if(JSON.stringify(tx(a))!==JSON.stringify(tx(wanted)))return false
  for(const key of ['.minmax','.default','.showvalue','.mode']){const value=wanted.filter(l=>l.startsWith(key+' ')).at(-1);if(value&&a.filter(l=>l.startsWith(key+' ')).at(-1)!==value)return false}
  return true
}
export type ProgramBackup={version:1;at:string;firmware:string;device:number;target:ProgramTarget;working:string;body:string;proposed:string}
export type ProgramTools={writeStandard:(target:ProgramTarget,control:Encoder)=>Promise<void>;readWorking:()=>Promise<string>;read:(target:ProgramTarget)=>Promise<string>;write:(target:ProgramTarget,program:CustomAssignment)=>Promise<void>;restore:(target:ProgramTarget)=>Promise<void>;backup:()=>ProgramBackup|null;canRestore:(target:ProgramTarget)=>boolean}

/** Injected transaction: capture before mutation, independent GETs, no STORE and no automatic retry/rollback. */
export async function sendControlProgram({target,program,read,transfer,setOff,backup,check}:{
  target:ProgramTarget;program:CustomAssignment;read:()=>Promise<PresetReadResult>;transfer:(lines:readonly string[])=>Promise<void>
  setOff:()=>Promise<void>;backup:(working:string,body:string,proposed:string)=>void;check:()=>void
}) {
  const p=parseCustomAssignment(program.sourceBcl),lines=fragmentForBody(target,p.sourceBcl)
  if(!programFragment(lines).hasTx)throw Error('A custom SysEx program is required')
  if(target.kind!=='encoders'&&clean(p.sourceBcl).some(l=>l.startsWith('.default ')))throw Error('BCR32 push/button custom programs do not export .default; remove that encoder-only directive before sending')
  const complete=async()=>{check();const r=await read();check();if(r.status!=='complete')throw Error('Complete independent working-preset read required');return r.text}
  const before=await complete(),body=controlFromWorking(before,target)
  fragmentForBody(target,body) // Verify restoration feasibility before changing Type.
  backup(before,body,p.sourceBcl);check()
  if(await complete()!==before)throw Error('Hardware changed during preparation; nothing written')
  await setOff();check()
  await transfer(lines);check()
  const after=await complete()
  if(restOfPreset(before,target)!==restOfPreset(after,target)||!sameProgram(controlFromWorking(after,target),p))throw Error('Custom program read-back differs; backup retained and hardware may be partially changed')
  return {before,after}
}
export async function restoreControlProgram({target,body,read,transfer,check,setOff}:{target:ProgramTarget;setOff?:()=>Promise<void>;body:string;read:()=>Promise<PresetReadResult>;transfer:(lines:readonly string[])=>Promise<void>;check:()=>void}) {
  const lines=fragmentForBody(target,body)
  check();const before=await read();check();if(before.status!=='complete')throw Error('Complete current preset required before restoring')
  controlFromWorking(before.text,target);if(!clean(body).some(l=>l.startsWith('.easypar '))){if(!setOff)throw Error('Type OFF preparation required for this restoration');await setOff();check()}await transfer(lines);check()
  const after=await read();check()
  if(after.status!=='complete'||restOfPreset(before.text,target)!==restOfPreset(after.text,target)||JSON.stringify(clean(controlFromWorking(after.text,target)))!==JSON.stringify(clean(body)))throw Error('Restoration is not confirmed; backup retained')
}

/** Standard edits use the same addressed BCL transaction as custom programs; no indexed setter gate is broadened. */
export async function sendStandardProgram({target,control,read,transfer,setOff,backup,check}:{
 target:ProgramTarget;control:Encoder;read:()=>Promise<PresetReadResult>;transfer:(lines:readonly string[])=>Promise<void>;
 setOff:()=>Promise<void>;backup:(working:string,body:string,proposed:string)=>void;check:()=>void
}){
 const proposed=standardProgramBody(target,control),lines=fragmentForBody(target,proposed)
 const complete=async()=>{check();const r=await read();check();if(r.status!=='complete')throw Error('Complete working-preset read required');return r.text}
 const before=await complete(),body=controlFromWorking(before,target)
 fragmentForBody(target,body);backup(before,body,proposed)
 if(await complete()!==before)throw Error('Hardware changed during preparation; nothing written')
 // OFF alone must leave dormant standard settings untouched. A native .tx needs its program cleared too.
 await setOff();check()
 if(control.type!=='off'||clean(body).some(l=>l.startsWith('.tx ')))await transfer(lines)
 const after=await complete(),actual=clean(controlFromWorking(after,target)),wanted=clean(proposed)
 if(restOfPreset(before,target)!==restOfPreset(after,target))throw Error('Unrelated hardware controls changed; backup retained')
 if(control.type==='off'){
  if(actual.some(l=>l.startsWith('.tx ')||l.startsWith('.easypar ')&&l!=='.easypar OFF'))throw Error('OFF is not confirmed; backup retained')
 }else for(const line of wanted){if(!actual.includes(line))throw Error('Standard assignment read-back differs; backup retained')}
 return {before,after}
}
