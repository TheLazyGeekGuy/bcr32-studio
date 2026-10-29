import {useEffect,useMemo,useRef,useState} from 'react'
import {translatedTree,useLanguage} from '../i18n'
import {catalogueInfo,catalogModels,catalogProgram,findCatalog,hexBytes,starterMap} from './catalog'
import {acceptsValue,valueDomain,decodeMap,maxMapBytes,parseMap,renderParameter,serializeMap,subsetMap,sysexMapSchema,withMapValue,type SysExMap} from '../sysex-map'

type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
type Download=(content:BlobPart,name:string,type?:string)=>void
const storageKey='sysex-map.catalog.v1'
export default function CatalogPicker({load,download,storage}:{load:(source:string,value:number,needsBcl:boolean)=>void;download?:Download;storage?:Storage}){
  const language=useLanguage()
  const [document,setDocument]=useState<SysExMap>(()=>{try{const saved=storage?.getItem(storageKey);return saved?parseMap(saved):starterMap}catch{return starterMap}})
  const [query,setQuery]=useState(''),[modelId,setModelId]=useState('microwave'),[commandId,setCommandId]=useState('cutoff')
  const [parameterQuery,setParameterQuery]=useState(''),[section,setSection]=useState('')
  const [fields,setFields]=useState<Record<string,number>>({}),[value,setValue]=useState<number|null>(null),[notice,setNotice]=useState('')
  const importGeneration=useRef(0)
  useEffect(()=>()=>{importGeneration.current++},[])
  const allModels=useMemo(()=>catalogModels(document),[document]),models=useMemo(()=>findCatalog(query,allModels),[query,allModels]),model=models.find(m=>m.id===modelId)??models[0]
  const sectionOf=(p:{extensions?:Record<string,unknown>})=>String((p.extensions?.['org.midistudio.catalogue'] as {section?:string}|undefined)?.section??'Common')
  const sections=[...new Set(model?.commands.map(c=>sectionOf(c.parameter))??[])]
  const commands=model?.commands.filter(c=>(!section||sectionOf(c.parameter)===section)&&parameterQuery.toLowerCase().split(/\s+/).every(q=>c.label.toLowerCase().includes(q)))??[]
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
    setDocument(next);setQuery('');setModelId(next.devices[0].id);setCommandId('');setSection('');setParameterQuery('');setFields({});setValue(null)
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
  return translatedTree(<section className="synth-sysex-catalog" aria-label="Synth SysEx catalogue">
    <h4>{document.devices.length} synths · {allModels.reduce((n,m)=>n+m.commands.length,0)} SysEx templates</h4>
    <div className="mock-actions"><label className="file">Import SXM<input type="file" aria-label="Import SysEx Map" accept=".json,.sxm.json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label><button onClick={()=>activate(starterMap)}>Built-in catalogue</button></div>
    <div className="mock-actions"><button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('all')}>Export SXM catalogue</button><button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('device')}>Export SXM synth</button><button disabled={!download||!model||!command||!!built?.error} onClick={()=>exportFile('parameter')}>Export SXM parameter</button><button disabled={!download} onClick={()=>download?.(JSON.stringify(sysexMapSchema,null,2)+'\n','sysex-map-1.0.schema.json','application/schema+json')}>Export SXM schema</button></div>
    {notice&&<p role="status">{notice}</p>}
    <label>Search synth or parameter<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setSection('');setParameterQuery('');setFields({});setValue(null)}}/></label>
    {!model?<p role="status">No matching synth.</p>:<>
      <label>Synth<select value={model.id} onChange={e=>{setModelId(e.target.value);setCommandId('');setSection('');setParameterQuery('');setFields({});setValue(null)}}>{models.map(m=><option key={m.id} value={m.id}>{m.manufacturer} {m.model}</option>)}</select></label>
      <label>Section<select value={section} onChange={e=>{setSection(e.target.value);setCommandId('');setValue(null)}}><option value="">All sections</option>{sections.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Search parameters<input type="search" value={parameterQuery} onChange={e=>{setParameterQuery(e.target.value);setCommandId('');setValue(null)}}/></label>
      {!command?<p role="status">No matching parameter. Change the section or search.</p>:<>
      <label>SysEx parameter<select value={command.id} onChange={e=>{setCommandId(e.target.value);setFields({});setValue(null)}}>{commands.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <p>{commands.length} matching / {model.commands.length} parameters. Reserved indices are excluded; raw values follow the cited table.</p>
      <div className="fields two">{command.fields.map(f=><label key={f.name}>{f.label}<input type="number" min={f.minimum} max={f.maximum} value={configured[f.name]===undefined?f.default:Number.isFinite(configured[f.name])?configured[f.name]:''} onChange={e=>setFields({...fields,[f.name]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}</div>
      <details><summary>Model notes</summary><p data-i18n-skip>{model.notes}</p></details>
      {(()=>{const info=catalogueInfo(model.device);return info.scope?<details><summary>Documented coverage and limits</summary><p>{info.scope}</p>{info.inventoryOnly.map((item,i)=><p key={i}>{item.name}: {item.reason}</p>)}{!!info.notCovered.length&&<p>Not covered by this table: {info.notCovered.join(', ')}.</p>}</details>:null})()}
      <p>Effect: {command.effect==='request'?'request / response not decoded here':command.effect} · Range {command.minimum}–{command.maximum} · Evidence: {command.parameter.evidence}; not verified by import.</p>
      <label>Catalogue preview value{domain?.allowed?<select value={previewValue} onChange={e=>setValue(Number(e.target.value))}>{domain.allowed.map(v=><option key={v} value={v}>{command.parameter.value.labels?.[v]??v}</option>)}</select>:<input type="number" min={command.minimum} max={command.maximum} step={domain?.step??1} value={previewValue} onChange={e=>setValue(Number(e.target.value))}/>}</label>
      <label>Catalogue SysEx preview<textarea rows={3} readOnly value={built?.hex??''}/></label>
      {command.checksum&&<p role="status">Checksum is calculated here for the preview. The BCL checksum token remains file-only; native hardware transfer and the simple SysEx editor are unavailable for this template.</p>}
      {built?.error&&<p role="alert">{built.error}</p>}{built?.adapterError&&<p role="status">{built.adapterError}</p>}
      {source&&<p><a href={source.url} target="_blank" rel="noreferrer">Manufacturer documentation</a> · {model.section}</p>}
      <button disabled={!built||!!built.error||!!built.adapterError} onClick={()=>{if(built&&!built.error&&!built.adapterError)load(built.source,previewValue,command.parameter.messages.some(m=>m.bytes.some(t=>typeof t!=='number'&&'checksum'in t)))}}>Load into current control draft</button>
      <p className="surface-help">Loading replaces this text draft only and is undoable. Nothing is applied or sent automatically. Channel and Device ID refer to the destination synth, not the BCR32. SXM is an open file-format draft, independent of BCL and MIDI transport.</p>
      </>}
    </>}
  </section>,language)
}
