import { useEffect, useId, useRef, useState } from 'react'
import type { Bcr32Profile } from './profile'
import type { VisualLabels } from './presets'
import type { Selection } from './FrontPanel'
import { controlSearchOptions } from './control-search'
import { translate, useLanguage } from './i18n'

export function ControlSearch({profile,labels,selection,select}:{profile:Bcr32Profile;labels:VisualLabels;selection:Selection;select:(s:Selection)=>void}) {
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0)
  const language=useLanguage(),t=(text:string)=>translate(text,language)
  const listId=useId(),list=useRef<HTMLDivElement>(null)
  const options=controlSearchOptions(profile,labels,query,language)
  const current=controlSearchOptions(profile,labels,'',language).find(o=>o.key===`${selection.kind}:${selection.id}`)!
  const index=Math.min(active,Math.max(0,options.length-1))
  useEffect(()=>{if(open)list.current?.children[index]?.scrollIntoView({block:'nearest'})},[index,open])
  const choose=(option:typeof current)=>{select({kind:option.kind,id:option.id});setOpen(false);setQuery('');setActive(0)}
  return <div className="control-search">
    <label>{t('Control')}<input type="text" role="combobox" aria-label={t('Control search')} aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&options.length?`${listId}-${index}`:undefined} autoComplete="off" placeholder={t('Search name, number, CC…')} value={open?query:t(current.title)}
      onFocus={()=>{setQuery('');setActive(0);setOpen(true)}} onBlur={()=>{setOpen(false);setQuery('')}}
      onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}}
      onKeyDown={e=>{
        if(e.key==='Escape'&&open){e.stopPropagation();e.preventDefault();setOpen(false);setQuery('')}
        else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(options.length-1,n+(e.key==='ArrowDown'?1:-1))))}
        else if(e.key==='Enter'&&open){e.preventDefault();if(options[index])choose(options[index])}
      }} /></label>
    {open&&<div className="control-search-results" id={listId} role="listbox" aria-label={t('Control results')} ref={list}>
      {options.map((option,i)=><button key={option.key} id={`${listId}-${i}`} type="button" role="option" aria-selected={i===index} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)}><span>{t(option.title)}</span><small>{option.detail}</small></button>)}
      {!options.length&&<p role="status">{t('No results')}</p>}
    </div>}
  </div>
}
