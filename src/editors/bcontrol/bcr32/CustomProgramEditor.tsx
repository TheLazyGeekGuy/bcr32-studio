import {lazy,Suspense,useEffect,useMemo,useRef,useState,type MutableRefObject} from 'react'
import {parseCustomAssignment,sysexToTx,txToSysex,evaluateAssignment} from '../../../bcl-tx'
import {createHistory} from '../../../history'
import {bclFile} from './bcl'
import {controlProgramFile,importControlProgram,programSelector,withoutCustomProgram,withCustomProgram,type ProgramTarget} from './custom-program'
import type {Encoder} from './profile'
import type {ProgramTools} from './custom-program-transfer'

export type CustomProgramActions={draft:()=>ReturnType<typeof parseCustomAssignment>|null;activate:()=>void;chooseRepresentation:(mode:'sysex'|'bcl')=>boolean}
const SynthCatalog=lazy(()=>import('../../../sysex-catalog/CatalogPicker'))
const example='.minmax 0 127\n.default 0\n.tx $F0 $7D val $F7\n.showvalue on'
const hex=(bytes:ArrayLike<number>)=>Array.from(bytes,b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')
export function CustomProgramEditor({target,config,locked,firmware,hardware,autoSend=false,connectionKey='',representation='sysex',visible=true,actions,onRepresentation,apply,download,catalogStorage}:{autoSend?:boolean;connectionKey?:string;catalogStorage?:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};representation?:'sysex'|'bcl';visible?:boolean;actions?:MutableRefObject<CustomProgramActions|null>;onRepresentation?:(mode:'sysex'|'bcl')=>void;hardware?:{tools:MutableRefObject<ProgramTools|null>;available:boolean;begin:()=>void};target:ProgramTarget;config:Encoder;locked:boolean;firmware:string|null;apply:(config:Encoder)=>void;download:(content:BlobPart,name:string,type?:string)=>void}){
  const controlExample=target.kind==='encoders'?example:example.replace('.default 0\n','')
  const [mode,setMode]=useState<'sysex'|'bcl'|'raw'>(representation),[source,setSource]=useState(config.customAssignment?.sourceBcl??controlExample)
  const [hexDraft,setHexDraft]=useState<string|null>(null),[preview,setPreview]=useState(32),[notice,setNotice]=useState('')
  const [importFailed,setImportFailed]=useState(false)
  const [editRevision,setEditRevision]=useState(0),handledRevision=useRef(0)
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const [catalogOpen,setCatalogOpen]=useState(false)
  const [original,setOriginal]=useState<{text:string;raw:Uint8Array}|null>(null)
  const [history]=useState(()=>{const h=createHistory(40);h.arrive('text',source);return h}),[,refresh]=useState(0)
  const [hardwareBusy,setHardwareBusy]=useState(false)
  async function hardwareAction(action:'read'|'write'|'restore'){
    const api=hardware?.tools.current;if(!api||!hardware?.available||hardwareBusy)return
    hardware.begin();setHardwareBusy(true);setNotice(action==='read'?'Reading the current hardware control…':action==='write'?'Backing up, replacing Type with OFF and sending this control…':'Restoring the backed-up hardware control…')
    try{if(action==='read'){const body=await api.read(target);edit(body,false,false);setHexDraft(null);setMode('bcl');onRepresentation?.('bcl');setNotice('Current control read from BCR32. Local draft not applied.')}else if(action==='write'){if(!p)throw Error('Invalid program');await api.write(target,p);apply(withCustomProgram(config,p));setNotice('Custom program independently read back on BCR32. Working memory only; not STORE.')}else{await api.restore(target);setNotice('Original hardware control restored and independently read back. Local draft retained.')}}catch(e){setNotice((e instanceof Error?e.message:String(e))+' Hardware may be partially changed if writing had begun; retain the backup.')}finally{setHardwareBusy(false)}
  }
  const input=useRef<HTMLTextAreaElement>(null)
  useEffect(()=>{const next=config.customAssignment?.sourceBcl;if(next===undefined)return;setSource(next);setHexDraft(null);setImportFailed(false);history.arrive('text',next)},[config.customAssignment?.sourceBcl,history])
  const checked=useMemo(()=>{try{return {program:parseCustomAssignment(source),error:''}}catch(e){return {program:null,error:e instanceof Error?e.message:String(e)}}},[source])
  const p=checked.program,selector=programSelector(target),counts=history.counts('text')
  const [form,setForm]=useState({minimum:'0',maximum:'127',defaultValue:'0'})
  useEffect(()=>{if(p)setForm({minimum:String(p.range[0]),maximum:String(p.range[1]),defaultValue:p.defaultValue===null?'off':String(p.defaultValue)})},[p])
  const unsupportedDefault=target.kind!=='encoders'&&/^\s*\.default\b/m.test(source)
  const editable=!!p&&p.conversionStatus==='exact'&&p.messages.length===1
  const shownHex=hexDraft??(p?.messages[0]?txToSysex(p.messages[0]):'')
  const value=p?Math.max(p.range[0],Math.min(p.range[1],preview)):preview
  const output=useMemo(()=>{if(!p)return '';try{return evaluateAssignment(p,value).map(hex).join('\n')}catch(e){return e instanceof Error?e.message:String(e)}},[p,value])
  const edit=(next:string,separate=false,live=true)=>{history.record('text',next,performance.now(),separate);setSource(next);setImportFailed(false);refresh(n=>n+1);if(live)setEditRevision(n=>n+1)}
  const setDirective=(name:string,args:string)=>{
    const lines=source.split(/\r\n|\r|\n/),indices=lines.flatMap((l,i)=>l.trim().split(/\s+/)[0]==='.'+name?[i]:[])
    if(indices.length){const i=indices.at(-1)!,comment=lines[i].includes(';')?lines[i].slice(lines[i].indexOf(';')):'';lines[i]=`.${name} ${args}${comment?' '+comment:''}`}else lines.unshift(`.${name} ${args}`)
    edit(lines.join('\n'))
  }
  const editHex=(next:string)=>{
    setHexDraft(next)
    if(!editable)return
    try{const tx=sysexToTx(next),lines=source.split(/\r\n|\r|\n/);edit(lines.map(l=>{
      if(!/^\s*\.tx\b/.test(l))return l
      const comment=l.includes(';')?l.slice(l.indexOf(';')):'';return (l.match(/^\s*/)?.[0]??'')+tx.originalText+(comment?' '+comment:'')
    }).join('\n'));setNotice('')}catch(e){setNotice(e instanceof Error?e.message:String(e))}
  }
  const hexValid=useMemo(()=>{if(hexDraft===null)return true;try{sysexToTx(hexDraft);return true}catch{return false}},[hexDraft])
  const fragment=p&&selector?controlProgramFile(target,p):''
  const raw=useMemo(()=>mode!=='raw'?'':original?hex(original.raw):fragment?hex(bclFile(fragment)):'',[mode,original,fragment])
  async function importFile(file?:File){
    if(!file)return
    try{if(file.size>1024*1024)throw Error('Control file exceeds 1 MiB');const bytes=new Uint8Array(await file.arrayBuffer());setOriginal({text:'',raw:bytes});const result=importControlProgram(bytes,target);setOriginal({text:result.original,raw:bytes});edit(result.program.sourceBcl,false,false);setHexDraft(null);setNotice('Selected control imported locally; other controls were not changed.');setMode('bcl');onRepresentation?.('bcl')}catch(e){setImportFailed(true);setMode('raw');setNotice('Import not applied; original bytes retained read-only. '+(e instanceof Error?e.message:String(e)))}
  }
  const changeMode=(next:typeof mode)=>{if(hexDraft!==null&&!hexValid){setNotice('Fix the hex draft before changing modes; it has not replaced the BCL source.');return false}setMode(next);setHexDraft(null);if(!importFailed)setNotice('');return true}
  useEffect(()=>{setMode(representation)},[representation])
  useEffect(()=>{if(!actions)return;const api:CustomProgramActions={draft:()=>hexValid&&!importFailed&&!unsupportedDefault?p:null,activate:()=>setEditRevision(n=>n+1),chooseRepresentation:next=>changeMode(next)};actions.current=api;return()=>{if(actions.current===api)actions.current=null}},[actions,hexDraft,hexValid,importFailed,unsupportedDefault,p])
  // Only direct edits or explicit Type activation schedule a live write. Opening/importing/reading/restoring a draft is inert.
  // Consume each revision once; re-enabling, rebinding or showing the view cannot replay old edits.
  const latest=useRef({locked,visible,hardware,autoSend,source,apply,hardwareAction})
  latest.current={locked,visible,hardware,autoSend,source,apply,hardwareAction}
  useEffect(()=>{
    if(!visible||!editRevision||handledRevision.current===editRevision)return
    handledRevision.current=editRevision
    if(!p||!hexValid||importFailed||unsupportedDefault||locked||!visible)return
    const program=p,wasAvailable=!!hardware?.available
    const timer=window.setTimeout(()=>{
      const now=latest.current
      if(!mounted.current||now.locked||!now.visible||now.source!==program.sourceBcl)return
      now.apply(withCustomProgram(config,program))
      if(program.conversionStatus==='exact'&&autoSend&&now.autoSend&&wasAvailable&&now.hardware?.available&&now.hardware.tools.current){
        void now.hardwareAction('write')
      }else setNotice(program.conversionStatus!=='exact'?'Applied locally; unsupported/opaque BCL stays file-only.':autoSend?'Applied locally; live hardware unavailable. Edit again after connection/read completes, or use Send program.':'Applied locally. Assignments → BCR32 is off; nothing sent.')
    },700)
    return()=>window.clearTimeout(timer)
  },[editRevision,source,hexValid,importFailed,locked,visible,connectionKey,autoSend])
  return <section className="custom-program" data-i18n-skip hidden={!visible} aria-label="Custom SysEx / BCL">
    <h3 className="mock-h3">{representation==='sysex'?'SysEx template':'BCL program'} · {autoSend?'live editing':'local draft'}</h3>
    {!selector?<p role="status">This system control has no qualified programmable BCL selector.</p>:<fieldset disabled={locked||hardwareBusy}>
      <p><code>{selector}</code> · {autoSend?'Live edits: valid direct changes are sent after a short pause, with backup and read-back. No STORE.':'Local editing: Assignments → BCR32 is off.'} Simulation never sends. Firmware {firmware??'unknown'}: custom output not hardware-validated.</p>
      <div className="mock-seg" role="group" aria-label="Custom program representation"><button aria-pressed={mode==='raw'} onClick={()=>changeMode(mode==='raw'?representation:'raw')}>{mode==='raw'?`Back to ${representation==='sysex'?'SysEx':'BCL'}`:'Raw'}</button></div>
      <button aria-expanded={catalogOpen} onClick={()=>setCatalogOpen(open=>!open)}>Synth SysEx catalogue</button>
      {catalogOpen&&<Suspense fallback={<p role="status">Loading offline catalogue…</p>}><SynthCatalog download={download} storage={catalogStorage} load={(next,value,needsBcl)=>{
        edit(next,true,false);setHexDraft(null);setPreview(value);setOriginal(null)
        const nextMode=needsBcl?'bcl':representation;setMode(nextMode);onRepresentation?.(nextMode)
        setCatalogOpen(false)
        setNotice('Catalogue template loaded into this text draft only. Nothing applied or sent.')
      }}/></Suspense>}
      {mode==='sysex'&&<><label>SysEx template<textarea ref={input} rows={4} spellCheck={false} aria-label="SysEx template" value={shownHex} readOnly={!editable} onChange={e=>editHex(e.target.value)}/></label>{!editable&&<p role="status">Use BCL to preserve multiple messages, unknown statements or advanced tokens. Simplified editing is unavailable.</p>}</>}
      {mode==='bcl'&&<div className="bcl-editor"><ol className="bcl-gutter" aria-hidden="true">{source.split(/\r\n|\r|\n/).map((_,i)=><li key={i}>{i+1}</li>)}</ol><textarea ref={input} aria-label="Custom BCL control body" rows={9} spellCheck={false} value={source} onChange={e=>{setHexDraft(null);edit(e.target.value)}}/></div>}
      {mode==='raw'&&<><p>{original?'Original imported bytes (read-only), not a new hardware capture.':'Generated BCR32 command-20 file bytes (read-only), not captured or sent.'}</p><textarea rows={8} readOnly aria-label="Raw BCL file bytes" value={raw}/></>}
      <div className="mock-actions"><button disabled={!counts.undo} onClick={()=>{const v=history.undo('text');if(v!==null){setSource(v);setHexDraft(null);refresh(n=>n+1);setEditRevision(n=>n+1)}}}>Undo text</button><button disabled={!counts.redo} onClick={()=>{const v=history.redo('text');if(v!==null){setSource(v);setHexDraft(null);refresh(n=>n+1);setEditRevision(n=>n+1)}}}>Redo text</button><button onClick={()=>{edit(controlExample,false,false);setHexDraft(null);setNotice('Example loaded locally, not applied or sent.')}}>Example</button><button onClick={()=>{void navigator.clipboard?.writeText(mode==='sysex'?shownHex:mode==='raw'?raw:source).then(()=>setNotice('Copied')).catch(()=>setNotice('Copy unavailable; select the text and copy manually.'))}}>Copy</button></div>
      <div className="fields two"><label>BCL minimum<input aria-label="BCL minimum" inputMode="numeric" value={form.minimum} onChange={e=>{setForm({...form,minimum:e.target.value});setDirective('minmax',`${e.target.value} ${form.maximum}`)}}/></label><label>BCL maximum<input aria-label="BCL maximum" inputMode="numeric" value={form.maximum} onChange={e=>{setForm({...form,maximum:e.target.value});setDirective('minmax',`${form.minimum} ${e.target.value}`)}}/></label></div>{target.kind==='encoders'&&<label>BCL default<input aria-label="BCL default" value={form.defaultValue} onChange={e=>{setForm({...form,defaultValue:e.target.value});setDirective('default',e.target.value)}}/></label>}{unsupportedDefault&&<p role="alert">Remove .default in BCL before sending: the BCR32 does not export this encoder-only directive for pushes/buttons.</p>}
      {p&&<label>Simulation value · {value}<input type="range" aria-label="SysEx simulation value" min={p.range[0]} max={p.range[1]} value={value} onChange={e=>setPreview(Number(e.target.value))}/></label>}
      <label>Simulated MIDI — nothing sent<textarea aria-label="Simulated SysEx output" rows={3} readOnly value={hexValid?output:'Invalid SysEx draft — simulation unavailable'}/></label>
      <p role="status">Conversion: {hexValid?p?.conversionStatus??'invalid':'invalid'}. {checked.error}</p>
      {!!p?.diagnostics.length&&<ul>{p.diagnostics.map((d,i)=><li key={i}>{d}</li>)}</ul>}
      <p role="status" aria-label="Custom program synchronization">{notice||'No custom program change sent.'}</p>
      <div className="mock-actions"><button disabled={!p||!hexValid||importFailed} onClick={()=>{if(p){apply(withCustomProgram(config,p));setNotice('Custom program applied to this local control only. Save JSON to retain it; hardware STORE does not include this draft.')}}}>Apply custom program locally</button>{config.customAssignment&&<button onClick={()=>{apply(withoutCustomProgram(config));setNotice('Previous standard assignment restored locally; nothing sent.')}}>Restore standard assignment</button>}</div>
      <div className="mock-actions"><label className="file">Import BCL / SYX<input aria-label="Import custom BCL or SYX" type="file" accept=".bcl,.bcr,.txt,.syx" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label><button disabled={!fragment} onClick={()=>download(fragment,'bcr32-control.bcl','text/plain')}>Export control BCL</button><button disabled={!fragment} onClick={()=>download(new Uint8Array(bclFile(fragment)),'bcr32-control.syx','application/octet-stream')}>Export control SYX</button>{original&&<button onClick={()=>download(new Uint8Array(original.raw),'bcr32-original-import.bin','application/octet-stream')}>Save original import</button>}</div>
      <section className="mock-card" aria-label="Custom program hardware transfer"><b>BCR32 working control</b>
        <p>Send replaces this control's native Type with OFF before installing .tx. The current preset is backed up first. Other controls and persistent presets must remain unchanged. Advanced/unknown programs stay file-only.</p>
        <div className="mock-actions"><button disabled={!hardware?.available} onClick={()=>void hardwareAction('read')}>Read control BCL from BCR32</button><button disabled={!hardware?.available||!p||p.conversionStatus!=='exact'||!hexValid||importFailed||unsupportedDefault} onClick={()=>void hardwareAction('write')}>Back up, set Type OFF and send program</button><button disabled={!hardware?.available||!hardware.tools.current?.canRestore(target)} onClick={()=>void hardwareAction('restore')}>Restore original hardware control</button><button disabled={!hardware?.tools.current?.backup()} onClick={()=>{const b=hardware?.tools.current?.backup();if(b)download(JSON.stringify(b,null,2),'bcr32-before-custom-program.json','application/json')}}>Save hardware backup</button></div>
        {!hardware?.available&&<p>Requires an unlocked, idle CTRL connection with live firmware1.0.2 or1.0.3.</p>}
      </section>
      <p className="surface-help">Custom programs are preserved in local JSON presets and history, never exported as OFF. A SysEx destination can interpret messages as reset, memory write or firmware commands. Hardware sending is explicit and limited to supported simple programs. ControlTribe requires native Type OFF before adding .tx; Studio does not change hardware Type during local editing.</p>
    </fieldset>}
  </section>
}
