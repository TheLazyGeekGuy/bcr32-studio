import {useMemo,useState} from 'react'
import {catalogProgram,catalogSources,findCatalog,hexBytes,previewCatalog,synthCatalog} from './catalog'

export default function CatalogPicker({load}:{load:(source:string,value:number,needsBcl:boolean)=>void}){
  const [query,setQuery]=useState(''),[modelId,setModelId]=useState('microwave'),[commandId,setCommandId]=useState('cutoff')
  const [fields,setFields]=useState<Record<string,number>>({}),[value,setValue]=useState(64)
  const models=useMemo(()=>findCatalog(query),[query]),model=models.find(m=>m.id===modelId)??models[0]
  const command=model?.commands.find(c=>c.id===commandId)??model?.commands[0]
  const previewValue=command?Math.max(command.minimum,Math.min(command.maximum,value)):0
  const built=useMemo(()=>{if(!model||!command)return null;try{return {source:catalogProgram(model,command,fields),hex:hexBytes(previewCatalog(command,fields,previewValue)),error:''}}catch(e){return {source:'',hex:'',error:e instanceof Error?e.message:String(e)}}},[model,command,fields,previewValue])
  const source=model?catalogSources[model.source]:null
  return <section className="synth-sysex-catalog" aria-label="Synth SysEx catalogue">
    <h4>20 synths · {synthCatalog.reduce((n,m)=>n+m.commands.length,0)} SysEx templates</h4>
    <label>Search synth or parameter<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setFields({})}}/></label>
    {!model||!command?<p role="status">No matching synth.</p>:<>
      <label>Synth<select value={model.id} onChange={e=>{setModelId(e.target.value);setCommandId('');setFields({})}}>{models.map(m=><option key={m.id} value={m.id}>{m.manufacturer} {m.model}</option>)}</select></label>
      <label>SysEx parameter<select value={command.id} onChange={e=>{setCommandId(e.target.value);setFields({})}}>{model.commands.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <div className="fields two">{command.fields.map(f=><label key={f.name}>{f.label}<input type="number" min={f.minimum} max={f.maximum} value={fields[f.name]===undefined?f.default:Number.isFinite(fields[f.name])?fields[f.name]:''} onChange={e=>setFields({...fields,[f.name]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}</div>
      <p>{model.notes}</p>
      <p>Effect: {command.effect==='request'?'request / response not decoded here':'current sound edit buffer'} · Range {command.minimum}–{command.maximum} · Manufacturer documented; not tested on this synth.</p>
      <label>Catalogue preview value<input type="number" min={command.minimum} max={command.maximum} value={previewValue} onChange={e=>setValue(Number(e.target.value))}/></label>
      <label>Catalogue SysEx preview<textarea rows={3} readOnly value={built?.hex??''}/></label>
      {command.checksum&&<p role="status">Checksum is calculated here for the preview. The BCL checksum token remains file-only; native hardware transfer and the simple SysEx editor are unavailable for this template.</p>}
      {built?.error&&<p role="alert">{built.error}</p>}
      {source&&<p><a href={source.url} target="_blank" rel="noreferrer">Manufacturer documentation</a> · {model.section}</p>}
      <button disabled={!built||!!built.error} onClick={()=>{if(built&&!built.error)load(built.source,previewValue,!!command.checksum)}}>Load into current control draft</button>
      <p className="surface-help">Loading replaces this text draft only and is undoable. Nothing is applied or sent automatically. Channel and Device ID refer to the destination synth, not the BCR32.</p>
    </>}
  </section>
}
