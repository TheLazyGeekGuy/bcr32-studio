import type {MidiAccess} from '../web-midi'
import type {PortScope} from './model'
export interface EndpointOption {id:string;name:string;detail?:string;available?:boolean;portId?:string;suggested?:boolean}
export function resolvePort(access:MidiAccess,direction:'input'|'output',alias:string){
  if(!alias.startsWith('port:'))return undefined
  const key=alias.slice(5),matches=[...(direction==='input'?access.inputs:access.outputs).values()].filter(p=>p.state==='connected'&&(p.id===key||p.name===key))
  return matches.length===1?matches[0].id:undefined
}
export function portAllowed(access:MidiAccess,direction:'input'|'output',id:string,scope?:PortScope){
  const aliases=scope?.[direction==='input'?'inputs':'outputs']
  return aliases==null||aliases.some(alias=>resolvePort(access,direction,alias)===id)
}
export function portOptions(access:MidiAccess,direction:'input'|'output',scope?:PortScope,selected:string[]=[]):EndpointOption[]{
  const options:EndpointOption[]=[...(direction==='input'?access.inputs:access.outputs).values()].filter(p=>p.state==='connected').map(p=>{
    const name=p.name||p.id,alias='port:'+name,unique=resolvePort(access,direction,alias)===p.id
    return {id:unique?alias:'port:'+p.id,name:unique?name:`${name} · ${p.id}`,detail:p.id,portId:p.id,available:portAllowed(access,direction,p.id,scope)}
  })
  for(const id of new Set(selected)){if(options.some(o=>o.id===id))continue;const physical=resolvePort(access,direction,id),canonical=options.find(o=>o.portId===physical);if(canonical)options.push({...canonical,id,suggested:false})}
  return options
}
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
export function searchEndpoints(options:EndpointOption[],query:string,selected:string[]=[]) {
  const terms=fold(query).trim().split(/\s+/).filter(Boolean)
  const physical=new Set(options.filter(o=>selected.includes(o.id)&&o.portId).map(o=>o.portId))
  return options.filter(o=>o.available!==false&&o.suggested!==false&&!selected.includes(o.id)&&(!o.portId||!physical.has(o.portId))&&terms.every(term=>fold(`${o.name} ${o.id} ${o.detail??''}`).includes(term)))
}
