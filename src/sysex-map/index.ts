/** Dependency-free SXM reader, serializer and local renderer. No MIDI permission or I/O. */
import schema from './schema.json'
import type {SysExMap,SxmDevice,SxmParameter,SxmValue} from './types.js'
export type * from './types.js'
function freeze(x:unknown):void{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}}
freeze(schema)
export const sysexMapSchema=schema
export const maxMapBytes=2*1024*1024
function fail(path:string,message:string):never{throw Error(`SXM ${path}: ${message}`)}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const forbidden=new Set(['__proto__','prototype','constructor'])
function jsonTree(v:unknown,depth=0,budget={nodes:0}):void{
 if(depth>32||++budget.nodes>300000)fail('$','JSON depth/node budget exceeded')
 if(v===null||typeof v==='boolean'||typeof v==='string')return
 if(typeof v==='number'&&Number.isFinite(v))return
 if(Array.isArray(v)){v.forEach(x=>jsonTree(x,depth+1,budget));return}
 if(object(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)){
  for(const [k,x] of Object.entries(v)){if(forbidden.has(k))fail('$','prototype-control key forbidden');jsonTree(x,depth+1,budget)}return
 }
 fail('$','plain finite JSON data required')
}
// Interpret only the bounded structural keywords used by our published schema. Cross-field rules follow below.
type Rule={ [key:string]:unknown }
function structure(v:unknown,r:Rule,path:string):void{
 if(r.$ref){structure(v,(schema.$defs as Record<string,Rule>)[String(r.$ref).split('/').at(-1)!],path);return}
 if(r.oneOf){let matches=0;for(const option of r.oneOf as Rule[])try{structure(v,option,path);matches++}catch{/* alternate */}if(matches!==1)fail(path,'unknown or ambiguous token');return}
 if('const'in r&&v!==r.const)fail(path,`expected ${String(r.const)}`)
 if(r.enum&&!(r.enum as unknown[]).includes(v))fail(path,'unknown value')
 const types=Array.isArray(r.type)?r.type:r.type?[r.type]:[]
 if(types.length&&!types.some(t=>t==='null'?v===null:t==='integer'?Number.isSafeInteger(v):t==='object'?object(v):t==='array'?Array.isArray(v):typeof v===t))fail(path,'invalid type')
 if(typeof v==='number'&&(r.minimum!==undefined&&v<Number(r.minimum)||r.maximum!==undefined&&v>Number(r.maximum)))fail(path,'number outside allowed range')
 if(typeof v==='string'&&(r.maxLength!==undefined&&[...v].length>Number(r.maxLength)||r.pattern&&!new RegExp(String(r.pattern)).test(v)))fail(path,'invalid or excessive text')
 if(Array.isArray(v)){
  if(r.minItems!==undefined&&v.length<Number(r.minItems)||r.maxItems!==undefined&&v.length>Number(r.maxItems))fail(path,'array size outside limit')
  if(r.items)v.forEach((x,i)=>structure(x,r.items as Rule,`${path}[${i}]`))
 }
 if(object(v)){
  const keys=Object.keys(v),properties=(r.properties??{}) as Record<string,Rule>
  if(r.maxProperties!==undefined&&keys.length>Number(r.maxProperties))fail(path,'too many properties')
  for(const k of (r.required??[]) as string[])if(!Object.hasOwn(v,k))fail(path,`missing ${k}`)
  for(const k of keys){
   if(r.propertyNames)structure(k,r.propertyNames as Rule,path)
   if(Object.hasOwn(properties,k))structure(v[k],properties[k],`${path}.${k}`)
   else if(r.additionalProperties===false)fail(path,`unknown property ${k}`)
   else if(object(r.additionalProperties))structure(v[k],r.additionalProperties as Rule,`${path}.${k}`)
  }
 }
}
const unique=(ids:string[],path:string)=>{if(new Set(ids).size!==ids.length)fail(path,'duplicate ID')}
const bounded=(v:number,lo:number,hi:number,path:string)=>{if(!Number.isSafeInteger(v)||v<lo||v>hi)fail(path,`integer ${lo}..${hi} required`)}
export function resolveParameter(doc:SysExMap,deviceId:string,parameterId:string):{device:SxmDevice;parameter:SxmParameter}{
 const device=doc.devices.find(d=>d.id===deviceId),parameter=device?.parameters.find(p=>p.id===parameterId)
 if(!device||!parameter)fail('$','device/parameter reference not found')
 return {device,parameter}
}
function fieldValues(p:SxmParameter,values:Readonly<Record<string,number>>):Record<string,number>{
 if(Object.keys(values).some(k=>!Object.hasOwn(p.fields,k)))fail(p.id,'unknown destination field')
 return Object.fromEntries(Object.entries(p.fields).map(([id,f])=>{const v=values[id]??f.default;bounded(v,f.minimum,f.maximum,id);return [id,v]}))
}
export function renderParameter(p:SxmParameter,value:number,fields:Readonly<Record<string,number>>={}):number[][]{
 bounded(value,p.value.minimum,p.value.maximum,p.id);const resolved=fieldValues(p,fields)
 return p.messages.map(message=>{
  const bytes:number[]=[]
  for(const token of message.bytes){
   let byte:number
   if(typeof token==='number')byte=token
   else if('field'in token){if(!Object.hasOwn(resolved,token.field))fail(p.id,'unknown field token');byte=resolved[token.field]+token.add}
   else if('value'in token){const t=token.value,mod=2**t.bits;byte=((Math.floor((value+t.add)/2**t.shift)%mod)+mod)%mod}
   else{const c=token.checksum;if(c.from<0||c.to<c.from||c.to>=bytes.length)fail(p.id,'checksum must cover preceding bytes');const span=bytes.slice(c.from,c.to+1),sum=span.reduce((a,b)=>a+b,0)
    byte=c.algorithm==='sum7'?sum%128:c.algorithm==='complement7'?(((-sum)%128)+128)%128:c.algorithm==='xor7'?span.reduce((a,b)=>a^b,0)&127:fail(p.id,'unknown checksum')}
   if(bytes.length!==0&&bytes.length!==message.bytes.length-1)bounded(byte,0,127,p.id)
   bytes.push(byte)
  }
  if(bytes[0]!==240||bytes.at(-1)!==247)fail(p.id,'F0 / F7 framing required')
  return bytes
 })
}
export function validateMap(value:unknown):SysExMap{
 jsonTree(value);const serialized=JSON.stringify(value);if(new TextEncoder().encode(serialized).length>maxMapBytes)fail('$','file exceeds 2 MiB')
 structure(value,schema,'$');const d=value as SysExMap
 if(d.requiredExtensions?.length)fail('$','required extension unsupported')
 unique(d.devices.map(x=>x.id),'devices');let total=0
 for(const device of d.devices){
  if((total+=device.parameters.length)>8192)fail('$','too many parameters')
  unique(device.parameters.map(p=>p.id),device.id);unique(device.documentation.sources,device.id)
  for(const source of device.documentation.sources)if(!Object.hasOwn(d.sources,source))fail(device.id,'missing source reference')
  for(const p of device.parameters){
   if(p.value.minimum>p.value.maximum)fail(p.id,'reversed value range')
   if(p.value.default!==undefined)bounded(p.value.default,p.value.minimum,p.value.maximum,p.id)
   for(const [k] of Object.entries(p.value.labels??{}))if(!/^-?(0|[1-9]\d*)$/.test(k)||k==='-0'||Number(k)<p.value.minimum||Number(k)>p.value.maximum)fail(p.id,'invalid value label key')
   if(p.evidence==='manufacturer-documented'&&!device.documentation.sources.length)fail(p.id,'manufacturer evidence needs a source')
   for(const f of Object.values(p.fields))bounded(f.default,f.minimum,f.maximum,p.id)
   for(const message of p.messages){
    if(message.bytes[0]!==240||message.bytes.at(-1)!==247)fail(p.id,'literal F0/F7 framing required')
    message.bytes.forEach((t,i)=>{
     if(typeof t==='number'){if(i>0&&i<message.bytes.length-1)bounded(t,0,127,p.id)}
     else if('field'in t){const f=p.fields[t.field];if(!f)fail(p.id,'missing field');bounded(f.minimum+t.add,0,127,p.id);bounded(f.maximum+t.add,0,127,p.id)}
     else if('checksum'in t){const c=t.checksum;if(c.from>c.to||c.to>=i)fail(p.id,'invalid checksum bounds')}
    })
   }
   renderParameter(p,p.value.minimum);renderParameter(p,p.value.maximum)
  }
 }
 for(const [id,s] of Object.entries(d.sources)){let url:URL;try{url=new URL(s.url)}catch{fail(id,'invalid source URL')}if(url!.username||url!.password)fail(id,'source credentials forbidden')}
 unique((d.values??[]).map(v=>v.device+'/'+v.parameter),'values')
 for(const v of d.values??[]){const {parameter}=resolveParameter(d,v.device,v.parameter);renderParameter(parameter,v.value,v.fields)}
 // Detach and freeze: two hosts cannot mutate a shared imported definition or extension.
 const copy=JSON.parse(serialized) as SysExMap
 freeze(copy);return copy
}
// Scan before JSON.parse so duplicate object keys and excessive nesting cannot be silently normalized away.
function jsonKeys(text:string){
 let i=0,nodes=0
 const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++}
 const string=()=>{const start=i++;for(;i<text.length;i++){if(text[i]==='\\'){i++;continue}if(text[i]==='"'){i++;return JSON.parse(text.slice(start,i)) as string}}return fail('$','unterminated string')}
 const visit=(depth:number):void=>{
  if(depth>32||++nodes>300000)fail('$','JSON depth/node budget exceeded');ws();const c=text[i]
  if(c==='{'){i++;ws();const keys=new Set<string>();if(text[i]==='}'){i++;return}while(i<text.length){if(text[i]!=='"')fail('$','object key expected');const key=string();if(keys.has(key))fail('$','duplicate object key');keys.add(key);ws();if(text[i++]!==':')fail('$','colon expected');visit(depth+1);ws();const next=text[i++];if(next==='}')return;if(next!==',')fail('$','comma expected');ws()}fail('$','unterminated object')}
  else if(c==='['){i++;ws();if(text[i]===']'){i++;return}while(i<text.length){visit(depth+1);ws();const next=text[i++];if(next===']')return;if(next!==',')fail('$','comma expected')}fail('$','unterminated array')}
  else if(c==='"')string()
  else{const start=i;while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;if(start===i)fail('$','value expected')}
 }
 visit(0);ws();if(i!==text.length)fail('$','trailing content')
}
export function parseMap(text:string):SysExMap{
 if(typeof text!=='string'||new TextEncoder().encode(text).length>maxMapBytes)fail('$','file exceeds 2 MiB')
 const source=text.replace(/^\uFEFF/,'');jsonKeys(source);return validateMap(JSON.parse(source))
}
export function decodeMap(bytes:Uint8Array):SysExMap{
 if(bytes.byteLength>maxMapBytes)fail('$','file exceeds 2 MiB')
 return parseMap(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export function serializeMap(doc:SysExMap):string{
 const valid=validateMap(doc)
 const sorted=(x:unknown):unknown=>Array.isArray(x)?x.map(sorted):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x
 return JSON.stringify(sorted(valid),null,2)+'\n'
}
export function subsetMap(doc:SysExMap,deviceId:string,parameterId?:string):SysExMap{
 const device=doc.devices.find(d=>d.id===deviceId);if(!device)fail('$','device not found')
 const parameters=parameterId?device.parameters.filter(p=>p.id===parameterId):device.parameters;if(!parameters.length)fail('$','parameter not found')
 const ids=new Set(parameters.map(p=>p.id))
 return validateMap({...doc,name:`${device.manufacturer} ${device.name}${parameterId?' / '+parameters[0].name:''}`.slice(0,200),devices:[{...device,parameters}],sources:Object.fromEntries(device.documentation.sources.map(id=>[id,doc.sources[id]])),...(doc.values?{values:doc.values.filter(v=>v.device===deviceId&&ids.has(v.parameter))}:{})})
}
export function withMapValue(doc:SysExMap,saved:SxmValue):SysExMap{
 return validateMap({...doc,values:[...(doc.values??[]).filter(v=>v.device!==saved.device||v.parameter!==saved.parameter),saved]})
}
