import type {Bcr32Profile} from './profile'
import type {VisualLabels} from './presets'
import type {Selection} from './FrontPanel'
import {controlSearchOptions} from './control-search'
import {useLanguage} from './i18n'
import {currentDevice} from './devices'
import type {DeviceDefinition} from './device-definition'
import {EditorControlSearch} from './EditorControlSearch'

/** Legacy profile/alias adapter; shared search UI has no device dependency. */
export function ControlSearch({profile,labels,selection,select,device=currentDevice}:{profile:Bcr32Profile;labels:VisualLabels;selection:Selection;select:(s:Selection)=>void;device?:DeviceDefinition}){
  const language=useLanguage()
  return <EditorControlSearch selectedKey={`${selection.kind}:${selection.id}`} translateTitles
    getOptions={query=>controlSearchOptions(profile,labels,query,language,device)} select={key=>{
      const option=controlSearchOptions(profile,labels,'',language,device).find(o=>o.key===key);if(option)select({kind:option.kind,id:option.id})
    }}/>
}
