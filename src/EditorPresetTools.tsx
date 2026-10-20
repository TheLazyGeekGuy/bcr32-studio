import {useId,useState,type ReactNode} from 'react'
import {translate,useLanguage} from './i18n'
export interface EditorPresetToolsProps {
 items:readonly {key:string;name:string}[];selectedKey:string;name:string;locked:boolean
 onName:(name:string)=>void;onSelect:(key:string)=>void;onSave:(asNew:boolean)=>void;onDelete?:()=>void
 onError?:(error:unknown)=>void;nameLimit?:number;children?:ReactNode
}
/** Borrowed data/actions only: no bank, session subscription, storage or transport of its own. */
export function EditorPresetTools({items,selectedKey,name,locked,onName,onSelect,onSave,onDelete,onError,nameLimit=80,children}:EditorPresetToolsProps){
 const language=useLanguage(),t=(text:string)=>translate(text,language),id=useId(),selected=items.some(p=>p.key===selectedKey)
 const [error,setError]=useState('')
 const run=(fn:()=>void)=>{if(locked)return;try{fn();setError('')}catch(e){if(onError)onError(e);else setError(String(e))}}
 return <div className="editor-preset-tools" role="group" aria-label={t('Preset management')}>
  <select aria-label={t('Load preset')} disabled={locked} value={selected?selectedKey:''} onChange={e=>{const key=e.target.value;if(items.some(p=>p.key===key))run(()=>onSelect(key))}}>
   <option value="">{t('Draft · choose a preset')}</option>{items.map(p=><option key={p.key} value={p.key} data-i18n-skip>{p.name}</option>)}
  </select>
  <label htmlFor={id}>{t('Preset name')}<input id={id} maxLength={nameLimit} disabled={locked} value={name} onChange={e=>run(()=>onName(e.target.value.replace(/[\u0000-\u001f\u007f]/g,' ')))}/></label>
  {children}
  <div className="preset-actions"><button className="primary" disabled={locked||!name.trim()} onClick={()=>run(()=>onSave(false))}>{t(selected?'Save / rename':'Create preset')}</button><button disabled={locked||!name.trim()} onClick={()=>run(()=>onSave(true))}>{t('Save as new')}</button>{onDelete&&<button disabled={locked||!selected} onClick={()=>run(onDelete)}>{t('Delete preset')}</button>}</div>
  {error&&<p role="alert">{error}</p>}
 </div>
}
