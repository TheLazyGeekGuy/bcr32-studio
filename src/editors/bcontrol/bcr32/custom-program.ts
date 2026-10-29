import {parseCustomAssignment,type CustomAssignment} from '../../../bcl-tx'
import {parseBcl,bclLinesFromSyx} from '../../../bcl-document'
import {controllerTargets} from './controller-read'
import type {Encoder} from './profile'
export type ProgramTarget={kind:'encoders'|'pushes'|'buttons';id:number}
export function programSelector(target:ProgramTarget){
  const wire=controllerTargets.find(t=>t.kind===target.kind&&t.id===target.id)
  return wire?target.kind==='encoders'?`$encoder ${target.id}`:`$button ${wire.index+1}`:null
}
export function withCustomProgram(control:Encoder,program:CustomAssignment):Encoder{
  const checked=parseCustomAssignment(program.sourceBcl)
  return {...control,type:checked.kind==='custom-sysex'?'sysex':'bcl',fallbackType:control.fallbackType??(control.type==='sysex'||control.type==='bcl'?'off':control.type),customAssignment:checked}
}
export function withoutCustomProgram(control:Encoder):Encoder{
  const {customAssignment:_program,fallbackType,...rest}=control
  return {...rest,type:fallbackType??(rest.type==='sysex'||rest.type==='bcl'?'off':rest.type)}
}
export function controlProgramFile(target:ProgramTarget,program:CustomAssignment){
  const selector=programSelector(target);if(!selector)throw Error('No qualified programmable BCL selector for this physical control')
  // A targeted fragment, not $preset/.init and not STORE. File construction grants no output permission.
  return `$rev BCR32\n${selector}\n${program.sourceBcl}\n$end`
}
export function importControlProgram(bytes:Uint8Array,target:ProgramTarget){
  if(bytes.length>1024*1024)throw Error('Control file exceeds 1 MiB')
  const framed=bytes[0]===240,decoded=framed?bclLinesFromSyx(bytes):null
  if(decoded&&(decoded.issues.length||decoded.model!==100))throw Error('A BCR32 model-64 BCL file with valid line sequence is required')
  const text=decoded?decoded.lines.join('\n'):new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  if(!text.trimStart().startsWith('$'))return {program:parseCustomAssignment(text),original:text}
  if(!/^\s*\$rev BCR32\s*(?:;[^\r\n]*)?(?:\r?\n|$)/.test(text))throw Error('Historical BCR2000/BCF2000 selectors are not implicitly BCR32 selectors')
  const doc=parseBcl(text),selector=programSelector(target)
  if(doc.presets.length!==1||doc.issues.length)throw Error('Import requires one valid BCR32 preset/fragment; other file data is not applied')
  const match=doc.presets[0].elements.find(e=>`$${e.kind} ${e.id}`===selector)
  if(!match)throw Error(`File does not contain the selected control ${selector}`)
  return {program:parseCustomAssignment((match.sourceLines??match.statements??[]).join('\n')),original:text}
}
