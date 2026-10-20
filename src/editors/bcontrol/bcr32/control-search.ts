import { displayControlId, type Bcr32Profile } from './profile'
import type { VisualLabels } from './presets'
import { buttonNames, encoderNames } from './panel-layout'
import { translate, type Language } from './i18n'

const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
// Query keywords include French aliases (encodeur, potard, bouton, touche, appui) on purpose: they keep working in every language.
export function controlSearchOptions(profile:Bcr32Profile,labels:VisualLabels,query='',language:Language='en') {
  const numbered=normalize(query).match(/\b(footswitch|footsw|encoder|encodeur|enc|potard|push|button|btn|bouton|touche)\s*(\d+)\b/)
  const terms=normalize(query).replace(numbered?.[0]??'','').trim().split(/\s+/).filter(Boolean)
  const kindFilter=numbered?(numbered[1].startsWith('foot')||['button','btn','bouton','touche'].includes(numbered[1])?'buttons':numbered[1]==='push'?'pushes':'encoders'):null
  const idFilter=numbered?Number(numbered[2])+(numbered[1].startsWith('foot')?73:0):null
  return (['encoders','pushes','buttons'] as const).flatMap(kind=>profile[kind].map((control,index)=>{
    const name=kind==='buttons'?buttonNames[index]:encoderNames[index]
    const title=`${kind==='encoders'?'Encoder':kind==='pushes'?'Push':'Button'} ${displayControlId(kind, control.id)} · ${labels[kind][index]||name}` // English catalog key; ControlSearch translates at render.
    const detail=`${control.type.toUpperCase()} ${control.parameter} · CH ${control.channel}`
    const search=normalize(`${title} ${language==='en'?'':translate(title,language)} ${name} ${detail} ${control.type}${control.parameter} ${kind} ${kind==='encoders'?'enc potard encodeur':kind==='pushes'?'push appui':'btn bouton touche'} ${control.id>=74&&kind==='buttons'?`footswitch footsw ${control.id-73}`:''}`)
    return {kind,id:control.id,key:`${kind}:${control.id}`,title,detail,search}
  })).filter(option=>(!numbered||(option.kind===kindFilter&&displayControlId(option.kind, option.id)===idFilter))&&terms.every(term=>option.search.includes(term)))
}
