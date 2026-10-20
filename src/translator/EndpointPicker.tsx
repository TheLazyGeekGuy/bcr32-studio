import {useEffect,useId,useRef,useState} from 'react'
import {translate,useLanguage} from '../i18n'
import {searchEndpoints,type EndpointOption} from './ports'
/** Search text never becomes a binding. Only an explicit suggestion commits an endpoint identity. */
export function EndpointPicker({label,options,value,multiple=false,disabled=false,onChange}:{label:string;options:EndpointOption[];value:string[];multiple?:boolean;disabled?:boolean;onChange:(ids:string[])=>void}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0),id=useId(),list=useRef<HTMLDivElement>(null),language=useLanguage(),t=(s:string)=>translate(s,language)
  const results=searchEndpoints(options,query,multiple?value:[]),index=Math.min(active,Math.max(0,results.length-1))
  const title=(key:string)=>{const option=options.find(o=>o.id===key);return (option?.name??key)+(option?.available===false?' · '+t('Filtered out'):!option?' · '+t('Offline'):'')}
  useEffect(()=>{if(open)list.current?.children[index]?.scrollIntoView({block:'nearest'})},[open,index])
  useEffect(()=>{setOpen(false);setQuery('')},[disabled])
  const choose=(option:EndpointOption)=>{if(disabled||multiple&&value.length>=32)return;onChange(multiple?[...value,option.id]:[option.id]);setQuery('');setOpen(false);setActive(0)}
  return <div className="mt-picker">
    <label>{label}<input role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open&&!disabled} aria-controls={id} aria-activedescendant={open&&!disabled&&results.length?`${id}-${index}`:undefined} autoComplete="off" disabled={disabled} placeholder={t('Search ports or parameters…')} value={open?query:multiple?'':value[0]?title(value[0]):''}
      onFocus={()=>{setQuery('');setActive(0);setOpen(true)}} onBlur={()=>{setOpen(false);setQuery('')}} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}}
      onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);setQuery('')}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(results.length-1,n+(e.key==='ArrowDown'?1:-1))))}else if(e.key==='Enter'){e.preventDefault();if(open&&results[index])choose(results[index])}}}/></label>
    {open&&!disabled&&<div className="mt-picker-results" role="listbox" aria-label={label} id={id} ref={list}>{results.map((option,i)=><button type="button" role="option" aria-selected={index===i} id={`${id}-${i}`} key={option.id} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)}><span>{option.name}</span><small>{option.detail}</small></button>)}{!results.length&&<p role="status">{t('No results')}</p>}</div>}
    {multiple&&!!value.length&&<div className="mt-picker-values">{value.map(key=><button type="button" disabled={disabled} key={key} title={key} aria-label={`${t('Remove endpoint')} · ${title(key)}`} onClick={()=>onChange(value.filter(v=>v!==key))}><span>{title(key)}</span><span aria-hidden="true">×</span></button>)}</div>}
    {!multiple&&!!value.length&&<button type="button" className="mt-picker-clear" disabled={disabled} aria-label={`${t('Remove endpoint')} · ${title(value[0])}`} onClick={()=>onChange([])}>×</button>}
  </div>
}
