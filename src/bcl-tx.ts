// Pure local BCL/SysEx definitions. No device, browser, sender or firmware permission is imported here.
export type TxToken = {kind:'byte';value:number;raw:string}|{kind:'value';low:number;high:number;raw:string}|{kind:'unsupported';family:'checksum'|'relative'|'condition'|'repeat'|'unknown';raw:string}
export type TxTemplate = {tokens:TxToken[];originalText:string;conversionStatus:'exact'|'partial'|'unsupported'}
export type CustomAssignment = {
  kind:'custom-sysex'|'opaque-bcl';sourceBcl:string;messages:TxTemplate[];range:[number,number];defaultValue:number|null
  conversionStatus:'exact'|'partial'|'unsupported';diagnostics:string[];hardwareValidated:false
}
const budget={source:65536,lines:256,tokens:256,line:600}
const number=(s:string)=>/^\$[\da-f]+$/i.test(s)?parseInt(s.slice(1),16):/^\d+$/.test(s)?Number(s):NaN
const valueToken=(raw:string):TxToken|null=>{
  if(raw==='val')return {kind:'value',low:0,high:6,raw}
  const m=/^val(\d+)\.(\d+)$/.exec(raw)
  if(!m)return null
  const low=Number(m[1]),high=Number(m[2]);if(low>high||high>13||high-low>6)throw Error('Value slices require 0 ≤ low ≤ high ≤ 13 and at most seven bits')
  if(!['val0.6','val0.3','val4.7','val8.11','val12.13','val7.13','val1.7'].includes(raw))return null // Do not invent native placeholders absent from the vendor's list.
  return {kind:'value',low,high,raw}
}
export function parseTx(line:string):TxTemplate{
  if(line.length>budget.line)throw Error('BCL line exceeds 600 characters')
  const text=line.split(';')[0].trim();if(!/^\.tx\s+/i.test(text))throw Error('Expected a .tx statement')
  const words=text.slice(3).trim().split(/\s+/);if(words.length>budget.tokens)throw Error('Too many .tx tokens')
  const tokens=words.map<TxToken>(raw=>{
    const dynamic=valueToken(raw);if(dynamic)return dynamic
    if(/^\$[\da-f]{1,2}$/i.test(raw)||/^\d+$/.test(raw)){const value=number(raw);if(value>255)throw Error('Byte outside 0–255');return {kind:'byte',value,raw}}
    if(raw.startsWith('$'))throw Error('Hex byte must be $00–$FF')
    const family=/^cks-[123]$/.test(raw)?'checksum':/^rel/.test(raw)?'relative':/^if[pn]$/.test(raw)?'condition':raw==='ntimes'?'repeat':'unknown'
    return {kind:'unsupported',family,raw}
  })
  const simple=tokens.every(t=>t.kind!=='unsupported')
  if(simple&&!(tokens[0]?.kind==='byte'&&tokens[0].value===240))return {tokens,originalText:line,conversionStatus:'unsupported'} // Valid BCL may emit non-SysEx MIDI; retain it, never invent SysEx.
  if(simple){
    if(tokens.length<3||tokens[0].kind!=='byte'||tokens[0].value!==240||tokens.at(-1)?.kind!=='byte'||(tokens.at(-1) as {value:number}).value!==247)throw Error('A simple SysEx must start with F0, contain a manufacturer ID, and end with F7')
    if(tokens.slice(1,-1).some(t=>t.kind==='byte'&&t.value>127))throw Error('SysEx payload bytes must be 7-bit')
  }
  return {tokens,originalText:line,conversionStatus:simple?'exact':tokens.some(t=>t.kind==='byte')?'partial':'unsupported'}
}
export function sysexToTx(text:string):TxTemplate{
  if(text.length>budget.line)throw Error('SysEx input too long')
  const words=text.trim().split(/\s+/);if(!text.trim())throw Error('Enter a SysEx message')
  const line='.tx '+words.map(w=>{
    const variable=/^\{([^{}]+)\}$/.exec(w);if(variable)return variable[1]
    if(!/^[\da-f]{2}$/i.test(w))throw Error(`Expected a two-digit hex byte or {val}: ${w}`)
    return '$'+w.toUpperCase()
  }).join(' ')
  const result=parseTx(line);if(result.conversionStatus!=='exact')throw Error('The simple SysEx editor requires F0…F7 and supported value tokens');return result
}
export const txToSysex=(template:TxTemplate)=>template.tokens.map(t=>t.kind==='byte'?t.value.toString(16).toUpperCase().padStart(2,'0'):`{${t.raw}}`).join(' ')
export function evaluateTx(template:TxTemplate,value:number):number[]{
  if(template.conversionStatus!=='exact')throw Error('Unsupported tokens: simulation unavailable; original BCL retained')
  if(!Number.isInteger(value)||value<0||value>16383)throw Error('Value must be an integer from 0 to 16383')
  const bytes=template.tokens.map(t=>{
    if(t.kind==='byte')return t.value
    if(t.kind!=='value')throw Error('Unsupported token')
    if(t.raw==='val'&&value>127)throw Error('val requires a 7-bit value; use explicit slices for 14-bit values')
    return value>>>t.low&((1<<(t.high-t.low+1))-1)
  })
  return bytes
}
function parseAssignment(sourceBcl:string,knownRingModes:boolean):CustomAssignment{
  if(typeof sourceBcl!=='string'||sourceBcl.length>budget.source||/[^\x09\x0a\x0d\x20-\x7e]/.test(sourceBcl))throw Error('BCL requires bounded ASCII text')
  const lines=sourceBcl.split(/\r\n|\r|\n/);if(lines.length>budget.lines)throw Error('Too many control lines')
  if(!lines.some(l=>l.split(';')[0].trim()))throw Error('The control body contains no instruction')
  const messages:TxTemplate[]=[],diagnostics:string[]=[];let range:[number,number]=[0,127],defaultValue:number|null=null
  for(const raw of lines){
    if(raw.length>budget.line)throw Error('BCL line exceeds 600 characters')
    const line=raw.split(';')[0].trim();if(!line)continue
    if(!line.startsWith('.'))throw Error('Only one control body here; selectors, STORE and other $ commands are not allowed')
    if(/^\.tx\b/.test(line)){const tx=parseTx(raw);messages.push(tx);if(tx.conversionStatus!=='exact')diagnostics.push('Advanced or unknown .tx tokens retained without evaluation');continue}
    if(/^\.minmax\b/.test(line)){
      const w=line.split(/\s+/);const lo=number(w[1]??''),hi=number(w[2]??'');if(w.length!==3||!Number.isInteger(lo)||!Number.isInteger(hi)||lo<0||hi>16383||lo>hi)throw Error('Invalid .minmax (0–16383, minimum ≤ maximum)');range=[lo,hi];continue
    }
    if(/^\.default\b/.test(line)){const w=line.split(/\s+/);defaultValue=w[1]==='off'?null:number(w[1]??'');if(w.length!==2||defaultValue!==null&&!Number.isInteger(defaultValue))throw Error('Invalid .default');continue}
    if(/^\.showvalue (on|off)$/.test(line))continue
    // Known B-Control ring directives are source-preserved and do not alter the simulated MIDI payload.
    // BCR32 1.0.3 includes .mode in a custom control's independent export (physical fixture).
    if(knownRingModes&&/^\.mode (off|1dot|1dot\/off|12dot|12dot\/off|bar|bar\/off|spread|pan|qual|cut|damp)$/.test(line))continue
    diagnostics.push(`Statement preserved without simplified editing: ${line.split(/\s+/)[0]}`)
  }
  if(defaultValue!==null&&(defaultValue<range[0]||defaultValue>range[1]))throw Error('Default value outside .minmax')
  for(const tx of messages)if(tx.conversionStatus==='exact'){evaluateTx(tx,range[0]);evaluateTx(tx,range[1])}
  if(messages.length&&lines.some(l=>/^\s*\.easypar\b/.test(l)))diagnostics.push('ControlTribe 1.12.4 rejects .easypar and .tx on the same control')
  const exact=messages.length>0&&messages.every(m=>m.conversionStatus==='exact')&&!diagnostics.length
  return {kind:exact?'custom-sysex':'opaque-bcl',sourceBcl,messages,range,defaultValue,conversionStatus:exact?'exact':messages.length?'partial':'unsupported',diagnostics,hardwareValidated:false}
}
export const parseCustomAssignment=(sourceBcl:string):CustomAssignment=>parseAssignment(sourceBcl,true)
export function evaluateAssignment(program:CustomAssignment,value:number){
  if(value<program.range[0]||value>program.range[1])throw Error('Preview value outside .minmax')
  if(program.conversionStatus!=='exact')throw Error('Opaque BCL cannot be simulated safely')
  return program.messages.map(tx=>evaluateTx(tx,value))
}
export function validCustomAssignment(value:unknown):value is CustomAssignment{
  try{if(!value||typeof value!=='object')return false;const v=value as CustomAssignment
    // Alpha1 drafts classified known .mode lines as opaque. Retain those exact old descriptors;
    // an explicit local apply regenerates the new classification without discarding source.
    return [true,false].some(known=>{const p=parseAssignment(v.sourceBcl,known);return Object.keys(p).every(k=>JSON.stringify(p[k as keyof CustomAssignment])===JSON.stringify(v[k as keyof CustomAssignment]))})
  }catch{return false}
}
