import { is14Bit, modesFor, parameterLimit, typesFor, valueLimit, type Bcr32Profile, type Encoder } from './profile'
import { encoderPosition, buttonPosition } from './panel-layout'
export type ControlSelection = { kind: 'encoders' | 'pushes' | 'buttons'; id: number }
export type SelectionGesture = { toggle?: boolean; range?: boolean }
export type ControlChange = Omit<Partial<Encoder>, 'mmc'> & { mmc?: Partial<NonNullable<Encoder['mmc']>> }
export const selectionKey = (s: ControlSelection) => `${s.kind}:${s.id}`
export type SelectionRectangle={x1:number;y1:number;x2:number;y2:number}
export function controlsInRectangle(profile:Bcr32Profile,kind:ControlSelection['kind'],rect:SelectionRectangle):ControlSelection[] {
  const inside=(x:number,y:number)=>x>=Math.min(rect.x1,rect.x2)&&x<=Math.max(rect.x1,rect.x2)&&y>=Math.min(rect.y1,rect.y2)&&y<=Math.max(rect.y1,rect.y2)
  const rotaryKind=kind==='pushes'?'pushes':'encoders'
  const rotations=profile[rotaryKind].filter(e=>{const p=encoderPosition(e.id);return inside(p.x,p.y)}).map<ControlSelection>(e=>({kind:rotaryKind,id:e.id}))
  const buttons=profile.buttons.filter((b,index)=>{
    if(b.id>=74)return false
    const p=b.id>=65?{x:b.id%2?1422:1583,y:b.id<67?1085:1207,width:96}:buttonPosition(index)
    return inside(p.x+p.width/2,p.y+27.5)
  }).map(b=>({kind:'buttons' as const,id:b.id}))
  return [...rotations,...buttons]
}
export function selectControls(current: ControlSelection[], next: ControlSelection, anchor: ControlSelection, gesture: SelectionGesture, profile: Bcr32Profile): ControlSelection[] {
  if (gesture.range && anchor.kind === next.kind) {
    const ids = profile[next.kind].map(e=>e.id), a=ids.indexOf(anchor.id), b=ids.indexOf(next.id)
    if (a<0 || b<0) return [next]
    const range = ids.slice(Math.min(a,b), Math.max(a,b)+1).map(id=>({kind:next.kind,id}))
    return gesture.toggle ? [...new Map([...current,...range].map(s=>[selectionKey(s),s])).values()] : range
  }
  if (!gesture.toggle) return [next]
  const remaining=current.filter(s=>selectionKey(s)!==selectionKey(next))
  return remaining.length===current.length ? [...current,next] : remaining.length ? remaining : [next]
}
export function selectedControls(profile: Bcr32Profile, selections: ControlSelection[]) {
  return selections.map(s=>({selection:s,control:profile[s.kind].find(e=>e.id===s.id)!})).filter(x=>!!x.control)
}
export function applySelectionChange(profile: Bcr32Profile, selections: ControlSelection[], change: ControlChange): Bcr32Profile {
  if (selections.length>1 && ('parameter' in change || 'parameterOff' in change || 'bankOff' in change || 'aftertouchAll' in change || change.mmc && 'command' in change.mmc)) throw Error('The parameter cannot be edited in a multiple selection.')
  const targets=new Map(selectedControls(profile,selections).map(x=>[selectionKey(x.selection),x]))
  const next={...profile}
  for(const kind of ['encoders','pushes','buttons'] as const) next[kind]=profile[kind].map(e=>{
    if(!targets.has(selectionKey({kind,id:e.id})) || 'ledMode' in change && kind!=='encoders') return e
    const {mmc,...flatChange}=change
    const n:Encoder={...e,...flatChange}
    if(mmc)n.mmc={...(e.mmc??{deviceId:'all',command:'Play',locate:[0,0,0,0],frameRate:'off'}),...mmc}
    n.id=e.id
    if(change.type && !typesFor(kind==='encoders').includes(change.type)) throw Error('Type is incompatible with part of the selection.')
    if(change.type && !modesFor(n.type,kind==='encoders').includes(n.mode)) n.mode=modesFor(n.type,kind==='encoders')[0]
    if(change.mode && !modesFor(n.type,kind==='encoders').includes(change.mode)) throw Error('Mode is incompatible with part of the selection.')
    if(selections.length>1 && change.type && e.parameter>parameterLimit(n)) throw Error('Existing parameters are incompatible with this type. Edit individually.')
    if(selections.length>1 && (change.mode || change.type) && is14Bit(n) && n.type==='cc' && n.parameter>31) throw Error('14-bit CC requires parameters 0–31. Edit individually.')
    if(is14Bit(n)&&!is14Bit(e)&&e.minimum===0&&e.maximum===127) n.maximum=16383
    for(const key of ['channel','minimum','maximum'] as const) n[key]=Math.max(key==='channel'?1:0,Math.min(key==='channel'?16:valueLimit(n),Math.round(n[key])||0))
    if('parameter' in change || selections.length===1 && change.type) n.parameter=Math.max(0,Math.min(kind==='encoders'?parameterLimit(n):127,Math.round(n.parameter)||0))
    if(change.increment!==undefined)n.increment=Math.max(-127,Math.min(127,Math.round(change.increment)||0))
    if(n.minimum>n.maximum){if('minimum' in change)n.maximum=n.minimum;else n.minimum=n.maximum}
    if ('buttonValues' in change) {
      if (kind === 'encoders' || !Array.isArray(change.buttonValues) || change.buttonValues.length !== 2 || !change.buttonValues.every(Number.isFinite)) throw Error('Invalid button values')
      n.buttonValues = change.buttonValues.map(v => Math.max(0, Math.min(valueLimit(n), Math.round(v)))) as [number, number]
      n.minimum = Math.min(...n.buttonValues); n.maximum = Math.max(...n.buttonValues)
    } else if ('minimum' in change || 'maximum' in change) delete n.buttonValues
    return n
  })
  return next
}
export function sharedField<T>(values: T[]): T | '' { return values.length && values.every(v=>v===values[0]) ? values[0] : '' }
