import type {CatalogItem} from './catalog'
import {useState} from 'react'
import {editorDragType} from './catalog'
import {translate,useLanguage} from '../i18n'

export function EditorPalette({items,disabled,open,endDrag}:{items:readonly CatalogItem[];disabled:boolean;open:(id:string)=>void;endDrag:()=>void}){
  const language=useLanguage(),t=(text:string)=>translate(text,language)
  const [search,setSearch]=useState(''),[limit,setLimit]=useState(60)
  const filtered=items.filter(item=>`${item.presentation.manufacturer} ${item.presentation.model} ${item.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),visible=filtered.slice(0,limit)
  return <nav className="ew-catalog" aria-label={t('Controller catalog')}>
    <input type="search" aria-label={t('Search')} placeholder={t('Search')} value={search} onChange={event=>{setSearch(event.target.value);setLimit(60)}}/>
    {[...new Set(visible.map(item=>item.presentation.manufacturer))].sort((a,b)=>a.localeCompare(b)).map(manufacturer=><details key={manufacturer} open>
      <summary>{manufacturer}</summary>
      {visible.filter(item=>item.presentation.manufacturer===manufacturer).sort((a,b)=>a.presentation.model.localeCompare(b.presentation.model)).map(item=>{
        const p=item.presentation,fullName=`${p.manufacturer} ${p.model}`
        return <button type="button" className="ew-model" key={item.id} disabled={disabled} draggable={!disabled}
          aria-label={`${t('Open editor')} · ${fullName}`} title={`${fullName}${p.preview.kind==='schematic'?` · ${t('Schematic preview')}`:''} · ${t('Drag into the workspace or click to open')}`}
          onClick={()=>open(item.id)} onDragStart={event=>{event.dataTransfer.setData(editorDragType,item.id);event.dataTransfer.effectAllowed='copy'}} onDragEnd={endDrag}>
          <img src={p.preview.src} width={p.preview.width} height={p.preview.height} loading="lazy" decoding="async" alt="" draggable={false}/>
          <strong data-i18n-skip>{fullName}</strong><small>{t('Editor')}</small>
        </button>
      })}
    </details>)}
    {visible.length<filtered.length&&<button type="button" aria-label={t('Next')} onClick={()=>setLimit(value=>value+60)}>+60 · {visible.length}/{filtered.length}</button>}
  </nav>
}
