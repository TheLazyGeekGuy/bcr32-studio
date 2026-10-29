// Pure, offline template catalogue. No MIDI, browser, storage or editor dependency.
import data from './catalog.json'

export type CatalogField={name:string;label:string;index:number;base:number;minimum:number;maximum:number;default:number}
export type CatalogCommand={id:string;label:string;prefix:number[];minimum:number;maximum:number;fields:CatalogField[];valueTokens:string[];effect:string;checksum?:{method:string;start:number}}
export type CatalogModel={id:string;manufacturer:string;model:string;source:string;section:string;notes:string;commands:CatalogCommand[]}
export const synthCatalog:readonly CatalogModel[]=data.models
export const catalogSources:Readonly<Record<string,{url:string;title:string;sha256:string|null;retrieved:string}>>=data.sources
export const hexBytes=(bytes:readonly number[])=>bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')

export function findCatalog(query:string):readonly CatalogModel[]{
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return synthCatalog.filter(m=>terms.every(t=>`${m.manufacturer} ${m.model} ${m.commands.map(c=>c.label).join(' ')}`.toLowerCase().includes(t)))
}
function addressed(command:CatalogCommand,values:Readonly<Record<string,number>>){
  const bytes=[...command.prefix]
  for(const f of command.fields){
    const v=values[f.name]??f.default
    if(!Number.isInteger(v)||v<f.minimum||v>f.maximum)throw Error(`${f.label} must be ${f.minimum}–${f.maximum}`)
    bytes[f.index]=f.base+v
  }
  if(bytes[0]!==240||bytes.slice(1).some(b=>!Number.isInteger(b)||b<0||b>127))throw Error('Invalid catalogue prefix')
  return bytes
}
function valueBytes(command:CatalogCommand,value:number){
  if(!Number.isInteger(value)||value<command.minimum||value>command.maximum)throw Error(`Value must be ${command.minimum}–${command.maximum}`)
  return command.valueTokens.map(t=>{
    if(t==='val')return value
    if(t==='val7.13')return value>>>7&127
    if(t==='val0.6')return value&127
    throw Error('Unsupported catalogue value encoding')
  })
}
export function previewCatalog(command:CatalogCommand,fields:Readonly<Record<string,number>>,value:number):number[]{
  const bytes=[...addressed(command,fields),...valueBytes(command,value)]
  if(command.checksum){
    if(command.checksum.method!=='sum7')throw Error('Unsupported catalogue checksum')
    bytes.push(bytes.slice(command.checksum.start).reduce((sum,b)=>sum+b,0)&127)
  }
  return [...bytes,247]
}
export function catalogProgram(model:CatalogModel,command:CatalogCommand,fields:Readonly<Record<string,number>>):string{
  const prefix=addressed(command,fields).map(b=>'$'+b.toString(16).toUpperCase().padStart(2,'0'))
  const checksum=command.checksum?['cks-2',String(command.checksum.start)]:[]
  return [`; ${model.manufacturer} ${model.model} / ${command.label}`,`.minmax ${command.minimum} ${command.maximum}`,'.tx '+[...prefix,...command.valueTokens,...checksum,'$F7'].join(' '),'.showvalue on'].join('\n')
}
