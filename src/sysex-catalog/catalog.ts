// Compatibility view for existing catalogue consumers. SXM is the sole shipped definition source.
import data from './starter.sxm.json'
import {validateMap,renderParameter,type SysExMap,type SxmDevice,type SxmParameter} from '../sysex-map'
import {parameterBcl} from './bcl-adapter'
export type CatalogField={name:string;label:string;index:number;base:number;minimum:number;maximum:number;default:number}
export type CatalogCommand={id:string;label:string;prefix:number[];minimum:number;maximum:number;fields:CatalogField[];valueTokens:string[];effect:string;checksum?:{method:string;start:number};parameter:SxmParameter}
export type CatalogModel={id:string;manufacturer:string;model:string;source:string;section:string;notes:string;commands:CatalogCommand[];device:SxmDevice}
export const starterMap=validateMap(data)
export function catalogModels(doc:SysExMap):CatalogModel[]{
 return doc.devices.map(device=>({id:device.id,manufacturer:device.manufacturer,model:device.name,source:device.documentation.sources[0]??'',section:device.documentation.section,notes:device.notes,device,commands:device.parameters.map(p=>{
  const bytes=p.messages[0].bytes,end=bytes.findIndex(t=>typeof t!=='number'&&('value'in t||'checksum'in t)),prefix=bytes.slice(0,end<0?-1:end).map(t=>typeof t==='number'?t:'field'in t?p.fields[t.field].default+t.add:0)
  const checksum=bytes.find(t=>typeof t!=='number'&&'checksum'in t)
  return {id:p.id,label:p.name,minimum:p.value.minimum,maximum:p.value.maximum,prefix,fields:Object.entries(p.fields).map(([name,f])=>({name,label:f.name,index:bytes.findIndex(t=>typeof t!=='number'&&'field'in t&&t.field===name),base:(bytes.find(t=>typeof t!=='number'&&'field'in t&&t.field===name) as {add:number}|undefined)?.add??0,minimum:f.minimum,maximum:f.maximum,default:f.default})),valueTokens:bytes.flatMap(t=>typeof t!=='number'&&'value'in t?[bytes.filter(x=>typeof x!=='number'&&'value'in x).length===1&&t.value.shift===0&&t.value.bits===7?'val':`val${t.value.shift}.${t.value.shift+t.value.bits-1}`]:[]),effect:p.effect,...(checksum&&typeof checksum!=='number'&&'checksum'in checksum?{checksum:{method:checksum.checksum.algorithm,start:checksum.checksum.from}}:{}),parameter:p}
 })}))
}
export const synthCatalog:readonly CatalogModel[]=catalogModels(starterMap)
export const catalogSources=starterMap.sources
export const hexBytes=(bytes:readonly number[])=>bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')
export function findCatalog(query:string,models:readonly CatalogModel[]=synthCatalog):readonly CatalogModel[]{
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
 return models.filter(m=>terms.every(t=>`${m.manufacturer} ${m.model} ${m.commands.map(c=>c.label).join(' ')}`.toLowerCase().includes(t)))
}
export function previewCatalog(command:CatalogCommand,fields:Readonly<Record<string,number>>,value:number):number[]{
 const messages=renderParameter(command.parameter,value,fields)
 if(messages.length!==1)throw Error('This compatibility helper returns a single frame; use renderParameter for multiple messages')
 return messages[0]
}
export const catalogProgram=(model:CatalogModel,command:CatalogCommand,fields:Readonly<Record<string,number>>)=>parameterBcl(model.device,command.parameter,fields)
