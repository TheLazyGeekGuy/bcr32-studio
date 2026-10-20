export interface TranslationRule {
  id:string;name:string;enabled:boolean;sources:string[];incoming:string;rules:string[]
  outputs:{target:string;message:string}[];stop:boolean;unsupported?:string[];original?:string
}
export interface PortScope {inputs:string[]|null;outputs:string[]|null}
export interface TranslationProject {format:'studio-midi-translator';version:1|2;name:string;rules:TranslationRule[];ports?:PortScope}
export const translatorManifest=Object.freeze({id:'midi-translator',version:'0.1.0',sdkVersion:1,kind:'host-tool',name:'MIDI Translator'})
export const emptyProject=():TranslationProject=>({format:'studio-midi-translator',version:1,name:'MIDI Translator',rules:[]})
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)
export function validateProject(value:unknown):TranslationProject {
  const p=value as TranslationProject
  if(!p||p.format!=='studio-midi-translator'||![1,2].includes(p.version)||!text(p.name,80)||!Array.isArray(p.rules)||p.rules.length>512)throw Error('Invalid translator project')
  if(p.ports!==undefined){const valid=(v:unknown)=>v===null||Array.isArray(v)&&v.length<=32&&new Set(v).size===v.length&&v.every(s=>text(s,300)&&s.startsWith('port:')&&s.length>5);if(p.version!==2||!p.ports||!valid(p.ports.inputs)||!valid(p.ports.outputs))throw Error('Invalid translator port filters')}
  const ids=new Set<string>()
  for(const r of p.rules){if(!r||!text(r.id,100)||!r.id||ids.has(r.id)||!text(r.name,120)||typeof r.enabled!=='boolean'||typeof r.stop!=='boolean'||!Array.isArray(r.sources)||r.sources.length>32||r.sources.some(s=>!text(s,300))||!text(r.incoming,32768)||!Array.isArray(r.rules)||r.rules.length>256||r.rules.some(s=>!text(s,1024))||!Array.isArray(r.outputs)||r.outputs.length>32||r.outputs.some(o=>!o||!text(o.target,300)||!text(o.message,32768))||r.unsupported!==undefined&&(!Array.isArray(r.unsupported)||r.unsupported.length>128||r.unsupported.some(s=>!text(s,512)))||r.original!==undefined&&!text(r.original,131072))throw Error('Invalid translator rule');ids.add(r.id);if(r.enabled&&r.unsupported?.length)throw Error('Unsupported translator must remain disabled')}
  const copy=JSON.parse(JSON.stringify(p)) as TranslationProject
  if(JSON.stringify(copy).length>2000000)throw Error('Translator project too large')
  return copy
}
export const demoRule=():TranslationRule=>({id:crypto.randomUUID(),name:'CC → SysEx · simulation',enabled:true,sources:[],incoming:'B0 10 {value}',rules:[],outputs:[{target:'',message:'F0 7D 01 {value} F7'}],stop:false})
