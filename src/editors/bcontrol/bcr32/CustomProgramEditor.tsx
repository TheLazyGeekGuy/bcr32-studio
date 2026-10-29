import {lazy,Suspense,useEffect,useMemo,useRef,useState,useId,type MutableRefObject} from 'react'
import {parseCustomAssignment,sysexToTx,txToSysex,evaluateAssignment} from '../../../bcl-tx'
import {createHistory} from '../../../history'
import {bclFile} from './bcl'
import {controlProgramFile,importControlProgram,programSelector,withoutCustomProgram,withCustomProgram,type ProgramTarget} from './custom-program'
import type {Encoder} from './profile'
import type {ProgramTools} from './custom-program-transfer'
import {translate,translatedTree,useLanguage} from './i18n'

function HelpHint({label,text}:{label:string;text:string}){
  const language=useLanguage(),id=useId(),[open,setOpen]=useState(false)
  return <span className="custom-help" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
    <button type="button" aria-label={translate(label,language)} aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation()}}}>?</button>
    {open&&<span id={id} role="tooltip">{translate(text,language)}</span>}
  </span>
}
export type CustomProgramActions={draft:()=>ReturnType<typeof parseCustomAssignment>|null;activate:()=>void;chooseRepresentation:(mode:'sysex'|'bcl')=>boolean}
const SynthCatalog=lazy(()=>import('../../../sysex-catalog/CatalogPicker'))
const example='.minmax 0 127\n.default 0\n.tx $F0 $7D val $F7\n.showvalue on'
const hex=(bytes:ArrayLike<number>)=>Array.from(bytes,b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')
export function CustomProgramEditor({target,config,locked,firmware,hardware,autoSend=false,connectionKey='',representation='sysex',visible=true,actions,onRepresentation,apply,download,catalogStorage}:{autoSend?:boolean;connectionKey?:string;catalogStorage?:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};representation?:'sysex'|'bcl';visible?:boolean;actions?:MutableRefObject<CustomProgramActions|null>;onRepresentation?:(mode:'sysex'|'bcl')=>void;hardware?:{tools:MutableRefObject<ProgramTools|null>;available:boolean;begin:()=>void};target:ProgramTarget;config:Encoder;locked:boolean;firmware:string|null;apply:(config:Encoder)=>void;download:(content:BlobPart,name:string,type?:string)=>void}){
  const language=useLanguage()
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
    hardware.begin();setHardwareBusy(true);setNotice(action==='read'?'Reading control…':action==='write'?'Sending control…':'Restoring backup…')
    try{if(action==='read'){const body=await api.read(target);edit(body,false,false);setHexDraft(null);setMode('bcl');onRepresentation?.('bcl');setNotice('Control read from BCR32.')}else if(action==='write'){if(!p)throw Error('Invalid program');await api.write(target,p);apply(withCustomProgram(config,p));setNotice('Control synchronized · not stored.')}else{await api.restore(target);setNotice('Hardware backup restored; local draft retained.')}}catch(e){setNotice((e instanceof Error?e.message:String(e))+' Hardware may be partially changed if writing had begun; retain the backup.')}finally{setHardwareBusy(false)}
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
    try{if(file.size>1024*1024)throw Error('Control file exceeds 1 MiB');const bytes=new Uint8Array(await file.arrayBuffer());setOriginal({text:'',raw:bytes});const result=importControlProgram(bytes,target);setOriginal({text:result.original,raw:bytes});edit(result.program.sourceBcl,false,false);setHexDraft(null);setNotice('Control imported locally.');setMode('bcl');onRepresentation?.('bcl')}catch(e){setImportFailed(true);setMode('raw');setNotice('Import not applied; original bytes retained read-only. '+(e instanceof Error?e.message:String(e)))}
  }
  const changeMode=(next:typeof mode)=>{if(hexDraft!==null&&!hexValid){setNotice('Fix the SysEx draft before changing modes.');return false}setMode(next);setHexDraft(null);if(!importFailed)setNotice('');return true}
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
      }else setNotice(program.conversionStatus!=='exact'?'Local draft · BCL stays file-only.':autoSend?'Applied locally · controller unavailable.':'Applied locally · nothing sent.')
    },700)
    return()=>window.clearTimeout(timer)
  },[editRevision,source,hexValid,importFailed,locked,visible,connectionKey,autoSend])
  return translatedTree(<section className="custom-program" hidden={!visible} aria-label="Custom SysEx / BCL">
    {!selector?<p role="status">This system control has no qualified programmable BCL selector.</p>:<fieldset disabled={locked||hardwareBusy}>
      <header className="custom-editor-header">
        <h3>{representation==='sysex'?'SysEx template':'BCL program'}</h3>
        <span className="custom-edit-state">{autoSend?'Live editing':'Local draft'}</span>
        <HelpHint label="Editing help" text={autoSend?'Valid direct edits are applied after a short pause. When the hardware is available, the control is backed up, sent and independently read back. STORE remains a separate action.':'Edits apply to the local draft. Enable Assignments → BCR32 to send subsequent direct edits to the controller. STORE remains a separate action.'}/>
      </header>
      <div className="custom-source-tools">
        <div className="mock-actions"><button aria-label="Undo text" title="Undo text" disabled={!counts.undo} onClick={()=>{const v=history.undo('text');if(v!==null){setSource(v);setHexDraft(null);refresh(n=>n+1);setEditRevision(n=>n+1)}}}>Undo</button><button aria-label="Redo text" title="Redo text" disabled={!counts.redo} onClick={()=>{const v=history.redo('text');if(v!==null){setSource(v);setHexDraft(null);refresh(n=>n+1);setEditRevision(n=>n+1)}}}>Redo</button><button onClick={()=>{void navigator.clipboard?.writeText(mode==='sysex'?shownHex:mode==='raw'?raw:source).then(()=>setNotice('Copied')).catch(()=>setNotice('Copy unavailable; select the text and copy manually.'))}}>Copy</button></div>
        <button aria-label="Synth SysEx catalogue" aria-expanded={catalogOpen} onClick={()=>setCatalogOpen(open=>!open)}>Catalogue</button>
      </div>
      {catalogOpen&&<Suspense fallback={<p role="status">Loading offline catalogue…</p>}><SynthCatalog download={download} storage={catalogStorage} load={(next,value,needsBcl)=>{
        edit(next,true,false);setHexDraft(null);setPreview(value);setOriginal(null)
        const nextMode=needsBcl?'bcl':representation;setMode(nextMode);onRepresentation?.(nextMode)
        setCatalogOpen(false)
        setNotice('Template loaded locally · nothing sent.')
      }}/></Suspense>}
      {mode==='sysex'&&<label className="custom-source-label"><span className="sr-only">SysEx template</span><textarea ref={input} rows={4} spellCheck={false} aria-label="SysEx template" value={shownHex} readOnly={!editable} onChange={e=>editHex(e.target.value)}/></label>}
      {mode==='bcl'&&<div className="bcl-editor"><ol className="bcl-gutter" aria-hidden="true">{source.split(/\r\n|\r|\n/).map((_,i)=><li key={i}>{i+1}</li>)}</ol><textarea ref={input} aria-label="Custom BCL control body" rows={9} spellCheck={false} value={source} onChange={e=>{setHexDraft(null);edit(e.target.value)}}/></div>}
      {mode==='sysex'&&!editable&&<p className="custom-warning" role="status">Use BCL for this program.</p>}
      <div className="custom-value-fields">
        <label>Minimum<input aria-label="BCL minimum" inputMode="numeric" value={form.minimum} onChange={e=>{setForm({...form,minimum:e.target.value});setDirective('minmax',`${e.target.value} ${form.maximum}`)}}/></label>
        <label>Maximum<input aria-label="BCL maximum" inputMode="numeric" value={form.maximum} onChange={e=>{setForm({...form,maximum:e.target.value});setDirective('minmax',`${form.minimum} ${e.target.value}`)}}/></label>
        {target.kind==='encoders'&&<label>Initial value<input aria-label="BCL default" value={form.defaultValue} onChange={e=>{setForm({...form,defaultValue:e.target.value});setDirective('default',e.target.value)}}/></label>}
      </div>
      {unsupportedDefault&&<p role="alert">Remove .default in BCL before sending: the BCR32 does not export this encoder-only directive for pushes/buttons.</p>}
      {(!p||!hexValid)&&<p className="custom-warning" role="alert">{!hexValid?'Invalid SysEx draft':checked.error}</p>}
      {notice&&<p className="custom-sync" role="status" aria-label="Custom program synchronization">{notice}</p>}
      <details className="custom-preview"><summary>Preview <HelpHint label="Preview help" text="Simulation calculates MIDI bytes locally. Moving this slider never sends MIDI or moves hardware."/></summary>
        {p&&<label>Simulation value · {value}<input type="range" aria-label="SysEx simulation value" min={p.range[0]} max={p.range[1]} value={value} onChange={e=>setPreview(Number(e.target.value))}/></label>}
        <label>Simulated MIDI — nothing sent<textarea aria-label="Simulated SysEx output" rows={2} readOnly value={hexValid?output:translate('Invalid SysEx draft — simulation unavailable',language)}/></label>
      </details>
      <details className="custom-advanced" open={importFailed||mode==='raw'||undefined}><summary>Files and recovery</summary>
        <div className="custom-local-tools mock-actions"><button disabled={!p||!hexValid||importFailed} onClick={()=>{if(p){apply(withCustomProgram(config,p));setNotice('Applied locally · save JSON to keep the draft.')}}}>Apply custom program locally</button>{config.customAssignment&&<button onClick={()=>{apply(withoutCustomProgram(config));setNotice('Standard assignment restored locally.')}}>Restore standard assignment</button>}<button onClick={()=>{edit(controlExample,false,false);setHexDraft(null);setNotice('Example loaded locally · nothing sent.')}}>Example</button></div>
        <div className="mock-actions"><label className="file">Import BCL / SYX<input aria-label="Import custom BCL or SYX" type="file" accept=".bcl,.bcr,.txt,.syx" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label><button disabled={!fragment} onClick={()=>download(fragment,'bcr32-control.bcl','text/plain')}>Export control BCL</button><button disabled={!fragment} onClick={()=>download(new Uint8Array(bclFile(fragment)),'bcr32-control.syx','application/octet-stream')}>Export control SYX</button>{original&&<button onClick={()=>download(new Uint8Array(original.raw),'bcr32-original-import.bin','application/octet-stream')}>Save original import</button>}</div>
        <section className="custom-hardware" aria-label="Custom program hardware transfer">
          <h4>Controller <HelpHint label="Hardware transfer help" text="Read gets the selected control from BCR32. Send backs up the preset, replaces this control’s Type with OFF, installs the program and verifies it by an independent read. Other controls and stored presets are preserved. Advanced programs may remain file-only. Saving a preset with STORE is separate."/></h4>
          <div className="mock-actions"><button aria-label="Read control BCL from BCR32" disabled={!hardware?.available} onClick={()=>void hardwareAction('read')}>Read control</button><button aria-label="Back up, set Type OFF and send program" disabled={!hardware?.available||!p||p.conversionStatus!=='exact'||!hexValid||importFailed||unsupportedDefault} onClick={()=>void hardwareAction('write')}>Send program</button><button aria-label="Restore original hardware control" disabled={!hardware?.available||!hardware.tools.current?.canRestore(target)} onClick={()=>void hardwareAction('restore')}>Restore backup</button><button aria-label="Save hardware backup" disabled={!hardware?.tools.current?.backup()} onClick={()=>{const b=hardware?.tools.current?.backup();if(b)download(JSON.stringify(b,null,2),'bcr32-before-custom-program.json','application/json')}}>Download backup</button></div>
          {!hardware?.available&&<p className="custom-hardware-unavailable">Controller unavailable <HelpHint label="Connection requirements" text="Requires an unlocked, idle CTRL connection with live firmware1.0.2 or1.0.3."/></p>}
        </section>
        <div className="mock-seg" role="group" aria-label="Custom program representation"><button aria-pressed={mode==='raw'} onClick={()=>changeMode(mode==='raw'?representation:'raw')}>{mode==='raw'?'Back to editor':'File bytes'}</button></div>
        {mode==='raw'&&<><p>{original?'Original imported bytes (read-only), not a new hardware capture.':'Generated BCR32 command-20 file bytes (read-only), not captured or sent.'}</p><textarea rows={5} readOnly aria-label="Raw BCL file bytes" value={raw}/></>}
        <details className="custom-compatibility"><summary>Compatibility details</summary><code data-i18n-skip>{selector}</code><p>Firmware: <span data-i18n-skip>{firmware??'—'}</span></p><p>Conversion: {hexValid?p?.conversionStatus??'invalid':'invalid'}</p>{!!p?.diagnostics.length&&<ul data-i18n-skip>{p.diagnostics.map((d,i)=><li key={i}>{d}</li>)}</ul>}<p>Custom programs are kept in JSON presets and history. Imported and catalogue programs stay local until edited or sent. A destination device may interpret SysEx as a memory write or reset.</p></details>
      </details>
    </fieldset>}
  </section>,language)
}
