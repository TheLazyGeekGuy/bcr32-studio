import {useEffect,useMemo,useRef,useState} from 'react'
import {translatedTree,useLanguage} from '../i18n'
import {Icon} from '../Icon'
import {catalogueContext,catalogueInfo,catalogModels,catalogProgram,findCatalog,hexBytes,refreshBuiltinCatalogue,starterMap} from './catalog'
import {acceptsValue,valueDomain,decodeMap,maxMapBytes,parseMap,renderParameter,serializeMap,subsetMap,sysexMapSchema,withMapValue,type SysExMap} from '../sysex-map'

type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
type Download=(content:BlobPart,name:string,type?:string)=>void
const storageKey='sysex-map.catalog.v1'
const catalogOrder=new Intl.Collator('en',{numeric:true,sensitivity:'base'})
export default function CatalogPicker({load,download,storage,close}:{close?:()=>void;load:(source:string,value:number,needsBcl:boolean)=>void;download?:Download;storage?:Storage}){
  const language=useLanguage(),dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const d=dialog.current;if(!d)return;const opener=d.ownerDocument.activeElement;d.showModal();d.querySelector<HTMLInputElement>('input[type=search]')?.focus();return()=>{d.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus()}},[])
  const [document,setDocument]=useState<SysExMap>(()=>{try{const saved=storage?.getItem(storageKey);return saved?refreshBuiltinCatalogue(parseMap(saved)):starterMap}catch{return starterMap}})
  const [query,setQuery]=useState(''),[modelId,setModelId]=useState('microwave'),[commandId,setCommandId]=useState('cutoff')
  const [fields,setFields]=useState<Record<string,number>>({}),[value,setValue]=useState<number|null>(null),[notice,setNotice]=useState('')
  const importGeneration=useRef(0)
  useEffect(()=>()=>{importGeneration.current++},[])
  const allModels=useMemo(()=>catalogModels(document).sort((a,b)=>catalogOrder.compare(a.manufacturer,b.manufacturer)||catalogOrder.compare(a.model,b.model)||a.id.localeCompare(b.id)),[document]),models=useMemo(()=>findCatalog(query,allModels),[query,allModels]),model=models.find(m=>m.id===modelId)??models[0]
  const sectionOf=(p:{extensions?:Record<string,unknown>})=>String((p.extensions?.['org.midistudio.catalogue'] as {section?:string}|undefined)?.section??'Common')
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const groupQuery=model?.commands.some(c=>sectionOf(c.parameter).toLowerCase()===query.toLowerCase().trim())
  const commands=model?.commands.filter(c=>groupQuery?sectionOf(c.parameter).toLowerCase()===query.toLowerCase().trim():terms.every(q=>`${model.manufacturer} ${model.model} ${c.label} ${sectionOf(c.parameter)}`.toLowerCase().includes(q)))??[]
  const groups=[...new Set(commands.map(c=>sectionOf(c.parameter)))]
  const command=commands.find(c=>c.id===commandId)??commands[0]
  const saved=document.values?.find(v=>v.device===model?.id&&v.parameter===command?.id)
  const configured={...(saved?.fields??{}),...fields}
  const initial=command?(command.parameter.value.default??(acceptsValue(command.parameter,64)?64:command.minimum)):0
  const previewValue=command?Math.max(command.minimum,Math.min(command.maximum,value??saved?.value??initial)):0
  const domain=command?valueDomain(command.parameter):undefined
  const built=useMemo(()=>{
    if(!model||!command)return null
    try{const hex=renderParameter(command.parameter,previewValue,configured).map(hexBytes).join('\n');let source='',adapterError=''
      try{source=catalogProgram(model,command,configured)}catch(e){adapterError=e instanceof Error?e.message:String(e)}
      return {source,hex,adapterError,error:''}
    }catch(e){return {source:'',hex:'',adapterError:'',error:e instanceof Error?e.message:String(e)}}
  },[model,command,fields,saved,previewValue])
  const source=model?document.sources[model.source]:null
  const activate=(next:SysExMap)=>{
    importGeneration.current++
    setDocument(next);setQuery('');setModelId(next.devices[0].id);setCommandId('');setFields({});setValue(null)
    try{storage?.setItem(storageKey,serializeMap(next));setNotice('SXM catalogue loaded locally. No MIDI sent.')}catch{setNotice('SXM loaded in this view; local storage unavailable. Export the file to keep it.')}
  }
  const importFile=async(file?:File)=>{if(!file)return;const generation=++importGeneration.current;try{if(file.size>maxMapBytes)throw Error('SXM file exceeds 2 MiB');const next=decodeMap(new Uint8Array(await file.arrayBuffer()));if(importGeneration.current===generation)activate(next)}catch(e){if(importGeneration.current===generation)setNotice('Import refused; existing catalogue retained. '+(e instanceof Error?e.message:String(e)))}}
  const exportFile=(scope:'all'|'device'|'parameter')=>{
    if(!download||!model||!command)return
    try{const valued=withMapValue(document,{device:model.id,parameter:command.id,value:previewValue,fields:configured,origin:value===null&&!Object.keys(fields).length&&saved?saved.origin:'user'})
      const selected=scope==='all'?valued:subsetMap(valued,model.id,scope==='parameter'?command.id:undefined)
      download(serializeMap(selected),scope==='all'?'synth-catalogue.sxm.json':`${model.id}${scope==='parameter'?'-'+command.id:''}.sxm.json`,'application/json');setNotice('SXM exported with this preview value; no hardware state is inferred.')
    }catch(e){setNotice('Export refused: '+(e instanceof Error?e.message:String(e)))}
  }
  return translatedTree(<dialog ref={dialog} className="sysex-catalog-dialog" aria-label="Synth SysEx catalogue" onCancel={e=>{if(close){e.preventDefault();close()}}}>
    <section className="synth-sysex-catalog" aria-label="Synth SysEx catalogue">
      <header className="catalog-header"><div><h3><Icon name="book"/>Catalogue</h3><p>{document.devices.length} synths · {allModels.reduce((n,m)=>n+m.commands.length,0)} SysEx templates</p></div><div className="catalog-header-actions">
        <details className="catalog-files"><summary aria-label="Catalogue files" title="Catalogue files"><Icon name="folder"/></summary><div className="catalog-file-menu">
          <label className="file"><Icon name="import"/>Import SXM<input type="file" aria-label="Import SysEx Map" accept=".json,.sxm.json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label>
          <button onClick={()=>activate(starterMap)}><Icon name="book"/>Built-in catalogue</button>
          <button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('all')}><Icon name="export"/>Export SXM catalogue</button>
          <button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('device')}><Icon name="export"/>Export SXM synth</button>
          <button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('parameter')}><Icon name="export"/>Export SXM parameter</button>
          <button disabled={!download} onClick={()=>download?.(JSON.stringify(sysexMapSchema,null,2)+'\n','sysex-map-1.0.schema.json','application/schema+json')}><Icon name="export"/>Export SXM schema</button>
        </div></details>
        <button className="catalog-close" aria-label="Close catalogue" title="Close catalogue" onClick={()=>{dialog.current?.close();close?.()}}><Icon name="close"/></button>
      </div></header>
      {notice&&<p className="catalog-notice" role="status">{notice}</p>}
      <div className="catalog-search"><label>Search synth or parameter<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setFields({});setValue(null)}}/></label></div>
      <div className="catalog-body">
        <div className="catalog-browser">
          {!model?<p role="status">No matching synth.</p>:<>
            <label>Synth<select value={model.id} onChange={e=>{setModelId(e.target.value);setCommandId('');setFields({});setValue(null)}}>{models.map(m=><option key={m.id} value={m.id}>{m.manufacturer} {m.model}</option>)}</select></label>
            <label className="catalog-parameter-list">SysEx parameter<select size={10} aria-label="SysEx parameter" value={command?.id??''} onChange={e=>{setCommandId(e.target.value);setFields({});setValue(null)}}>{groups.map(group=><optgroup key={group} label={group}>{commands.filter(c=>sectionOf(c.parameter)===group).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}</select></label>
            <p className="catalog-result-count">{commands.length} matching / {model.commands.length}</p>
          </>}
        </div>
        <div className="catalog-definition">
          {!command||!model?<p role="status">No matching parameter. Change the search.</p>:<>
            <h4 data-i18n-skip>{command.label}</h4>
            {catalogueContext(command.parameter)&&<p className="catalog-limit" title="Select the intended object on the instrument first. This definition does not select an object automatically.">Requires a selected object: <span data-i18n-skip>{catalogueContext(command.parameter)}</span></p>}
            <div className="fields two">{command.fields.map(f=><label key={f.name}>{f.label}<input type="number" min={f.minimum} max={f.maximum} value={configured[f.name]===undefined?f.default:Number.isFinite(configured[f.name])?configured[f.name]:''} onChange={e=>setFields({...fields,[f.name]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}</div>
            <label>Catalogue preview value{domain?.allowed?<select value={previewValue} onChange={e=>setValue(Number(e.target.value))}>{domain.allowed.map(v=><option key={v} value={v}>{command.parameter.value.labels?.[v]??v}</option>)}</select>:<input type="number" min={command.minimum} max={command.maximum} step={domain?.step??1} value={previewValue} onChange={e=>setValue(Number(e.target.value))}/>}</label>
            <label>Catalogue SysEx preview<textarea rows={3} readOnly value={built?.hex??''}/></label>
            {built?.error&&<p className="catalog-error" role="alert">{built.error}</p>}{built?.adapterError&&<p className="catalog-limit" role="status" title={built.adapterError}>File-only definition</p>}
            {command.checksum&&<p className="catalog-limit" role="status" title="Checksum is calculated here for the preview. The BCL checksum token remains file-only; native hardware transfer and the simple SysEx editor are unavailable for this template.">Checksum template · file-only</p>}
            <details className="catalog-reference"><summary>Reference and compatibility</summary>
              <p>{model.notes}</p>{(()=>{const info=catalogueInfo(model.device);return <><p>{info.scope}</p>{info.inventoryOnly.map((item,i)=><p key={i}>{item.name}: {item.reason}</p>)}{!!info.notCovered.length&&<p>Not covered by this table: {info.notCovered.join(', ')}.</p>}</>})()}
              <p>Effect: {command.effect==='request'?'request / response not decoded here':command.effect} · Range {command.minimum}–{command.maximum} · Evidence: {command.parameter.evidence}; not verified by import.</p>
              {source&&<p><a href={source.url} target="_blank" rel="noreferrer">Manufacturer documentation</a> · {model.section}</p>}
            </details>
          </>}
        </div>
      </div>
      <footer className="catalog-footer"><p>Loads this control’s local draft. No MIDI sent.</p><button className="catalog-load" disabled={!built||!!built.error||!!built.adapterError} onClick={()=>{if(built&&!built.error&&!built.adapterError&&command)load(built.source,previewValue,command.parameter.messages.some(m=>m.bytes.some(t=>typeof t!=='number'&&'checksum'in t)))}}><Icon name="import"/>{command?.checksum?'Load file-only draft':'Load into current control draft'}</button></footer>
    </section>
  </dialog>,language)
}
