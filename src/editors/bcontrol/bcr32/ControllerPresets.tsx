import type {EditorStorage} from '../../../editor-environment'
import { Icon } from './Icon'
import { applyControllerTracks, type ControllerTracks } from './controller-tracks'
import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react'
import { createPresetReader, type PresetRead, type PresetReadResult } from './controller-presets'
import { translate, useLanguage } from './i18n'
import { bclFile } from './bcl'
import { createBclSender, presetStorageValidated, storeHardwarePreset, type HardwarePresetStorePlan } from './preset-store'

type Props = { onCurrent?: (current: { slot: number; name: string | null } | null) => void; storeRequest?: { seq: number; name: string }; storage:EditorStorage; authorizeTransfer:(frames:number[][])=>(()=>void); onStored?: (slot: number) => void; trackSelect?: MutableRefObject<((track: number) => void) | null>; watchAvailable?: boolean; tracks?: ControllerTracks | null; active: boolean; available: boolean; connectionKey: string; device: number | null; send: (bytes: number[]) => void; sendWrite: (bytes: number[]) => void; receive: MutableRefObject<(bytes: number[]) => void>; onBusy: (busy: boolean) => void; globalsRevision?: number; autoGlobals?: boolean; onGlobals?: (text: string) => void; download: (content: BlobPart, name: string, type?: string) => void }
export function ControllerPresets({ onCurrent, storeRequest, storage, authorizeTransfer, onStored, trackSelect, watchAvailable = false, tracks, active, available, connectionKey, device, send, sendWrite, receive, onBusy, globalsRevision = 0, autoGlobals = true, onGlobals, download }: Props) {
  const language = useLanguage(), t = (s: string) => translate(s, language)
  const [menu,setMenu]=useState<'read'|'export'|null>(null),[saveOpen,setSaveOpen]=useState(false),[rawOpen,setRawOpen]=useState(false)
  const toolbar=useRef<HTMLDivElement>(null),menuId=useId()
  useEffect(()=>{if(!active){setMenu(null);setSaveOpen(false)}},[active])
  useEffect(()=>{if(!menu)return;const close=(e:PointerEvent)=>{if(!toolbar.current?.contains(e.target as Node))setMenu(null)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[menu])
  const [names, setNames] = useState<Record<number, string>>({}), [source, setSource] = useState('working')
  const [destination, setDestination] = useState<number | null>(null), [name, setName] = useState('')
  const [busy, setBusy] = useState(false), [count, setCount] = useState(0), [notice, setNotice] = useState('')
  const [snapshot, setSnapshot] = useState<PresetReadResult | null>(null)
  const [storeBusy, setStoreBusy] = useState(false), [storeError, setStoreError] = useState('')
  const writer = useRef<ReturnType<typeof createBclSender> | null>(null), writeRef = useRef(sendWrite); writeRef.current = sendWrite
  const reader = useRef<ReturnType<typeof createPresetReader> | null>(null), sendRef = useRef(send)
  sendRef.current = send
  const [trackDraft,setTrackDraft]=useState<ControllerTracks['presets']>([1,2,3,4])
  useEffect(()=>{if(tracks)setTrackDraft([...tracks.presets])},[tracks?.presets.join(':')])
  const quiet=useRef(false), quietFailures=useRef(0)
  const attempted = useRef(false)
  const globalAttempt = useRef<number | null>(null), globalsRef = useRef(onGlobals); globalsRef.current = onGlobals
  useEffect(() => {
    attempted.current = false; globalAttempt.current = null; quiet.current=false; quietFailures.current=0; setMenu(null);setSaveOpen(false);setRawOpen(false); setNames({}); setSnapshot(null); setSource('working'); setName(''); setDestination(null); setBusy(false); setStoreBusy(false); setStoreError(''); setNotice(''); setCount(0)
    if (device === null || device === 127) return
    const transport = createPresetReader(bytes => sendRef.current(bytes), device, 3000, count => { if(!quiet.current)setCount(count) })
    const sender = createBclSender(bytes => writeRef.current(bytes), device,1500,15,authorizeTransfer); writer.current = sender
    reader.current = transport; receive.current = bytes => { transport.receive(bytes); sender.receive(bytes) }
    return () => { sender.close(); writer.current = null; transport.close(); if (reader.current === transport) reader.current = null; receive.current = () => {} }
  }, [connectionKey, device, receive])
  useEffect(() => { onBusy(busy || storeBusy) }, [busy, storeBusy, onBusy])
  useEffect(() => { if (!available && !watchAvailable) reader.current?.cancel() }, [available,watchAvailable])
  async function read(request: PresetRead) {
    const transport = reader.current
    if(quiet.current) {transport?.cancel();quiet.current=false}
    if (!transport || busy || storeBusy || !available) return
    setBusy(true); setCount(0); setNotice('Reading BCR32 presets…')
    try {
      const result = await transport.read(request)
      if (reader.current !== transport) return
      if (request.kind === 'names') setNames(result.names)
      else if (result.status === 'complete') setSnapshot(result)
      if (result.status === 'complete' && (request.kind === 'global' || request.kind === 'all')) {quietFailures.current=0;globalsRef.current?.(result.text)}
      setNotice(result.status === 'complete' ? 'BCR32 preset read complete' : result.status === 'timeout' ? 'No complete preset reply. Check CTRL mode and stop the sequencer, then retry.' : result.status === 'cancelled' ? 'Read cancelled' : 'Invalid preset reply. Previous complete backup retained.')
    } catch { if (reader.current === transport) setNotice('Read failed') }
    finally { if (reader.current === transport) setBusy(false) }
  }
  useEffect(() => {
    if (!available || !reader.current || busy || storeBusy) return
    if (autoGlobals && onGlobals && globalAttempt.current !== globalsRevision) { globalAttempt.current = globalsRevision; void read({ kind: 'global' }); return }
    if (active && !attempted.current) { attempted.current = true; void read({ kind: 'names' }) }
  }, [active, available, connectionKey, device, busy, storeBusy, globalsRevision, autoGlobals, !!onGlobals])
  useEffect(()=>{
    if(!watchAvailable||!autoGlobals||!tracks||!onGlobals)return
    const timer=window.setInterval(async()=>{
      const transport=reader.current
      if(!transport||busy||storeBusy||quiet.current||quietFailures.current>=3||document.hidden)return
      quiet.current=true
      try{const result=await transport.read({kind:'global'},false);if(reader.current===transport&&result.status==='complete'){quietFailures.current=0;globalsRef.current?.(result.text)}else if(result.status!=='cancelled'){quietFailures.current++;if(quietFailures.current>=3)setNotice('Shortcut monitoring stopped after missing replies')}}
      finally{quiet.current=false}
    },2000)
    return()=>{window.clearInterval(timer);if(quiet.current){reader.current?.cancel();quiet.current=false}}
  },[watchAvailable,autoGlobals,!!tracks,!!onGlobals,busy,storeBusy,connectionKey])
  async function changeTracks(selected?:number) {
    const transport=reader.current,sender=writer.current
    if(!watchAvailable||busy||storeBusy||!transport||!sender||!tracks)return
    if(quiet.current){transport.cancel();quiet.current=false}
    setStoreBusy(true);setStoreError('');setNotice('Updating controller shortcuts…')
    try{
      const result=await applyControllerTracks({read:r=>transport.read(r),transfer:lines=>sender.transfer(lines,setCount),presets:selected===undefined?trackDraft:undefined,selected,
        backup:contents=>{const key='bcr32-studio.before-shortcut-change.v1';storage.setItem(key,contents);if(storage.getItem(key)!==contents)throw Error('Shortcut backup unavailable')},
      })
      if(reader.current!==transport)return
      globalsRef.current?.(result.globals);setNotice('Controller shortcuts read back and confirmed')
    }catch(error){if(reader.current===transport){setStoreError(String(error));setNotice('Shortcut update stopped; backup retained')}}
    finally{if(reader.current===transport)setStoreBusy(false)}
  }
  useEffect(()=>{if(!trackSelect)return;trackSelect.current=track=>{void changeTracks(track)};return()=>{trackSelect.current=null}},[trackSelect,available,watchAvailable,busy,storeBusy,tracks,trackDraft])
  async function store() {
    const transport = reader.current, sender = writer.current
    if(quiet.current){transport?.cancel();quiet.current=false}
    if (!presetStorageValidated || destination === null || !available || busy || storeBusy || !transport || !sender) return
    setStoreBusy(true); setStoreError(''); setNotice('Saving complete controller preset…'); setCount(0)
    let acknowledged: HardwarePresetStorePlan | undefined
    try {
      await storeHardwarePreset({ read: request => transport.read(request), transfer: lines => sender.transfer(lines, setCount), source: source === 'working' ? 'working' : Number(source), slot: destination, name,
        onAcknowledged: saved => {
          if(reader.current!==transport)return
          acknowledged=saved
          setNames(current=>({...current,[saved.slot]:saved.name}))
          onStored?.(saved.slot+1)
        },
        backup: contents => { const key = 'bcr32-studio.before-hardware-store.v1'; storage.setItem(key, contents); if (storage.getItem(key) !== contents) throw Error('Backup could not be verified; nothing sent') },
      })
      if (reader.current !== transport) return
      setSaveOpen(false); setNotice('Preset stored and read back. Working contents restored.')
    } catch (error) { if (reader.current === transport) {
      // A failed verification makes the acknowledged destination uncertain; do not retain a false label.
      if(acknowledged){const slot=acknowledged.slot;setNames(current=>{const next={...current};delete next[slot];return next})}
      setNotice('Preset save stopped. Backup retained; hardware may be partially changed.'); setStoreError(String(error)) } }
    finally { if (reader.current === transport) setStoreBusy(false) }
  }
  // The toolbar shows the preset of the selected track; renaming or storing it opens the save sheet below, prefilled
  // (destination = that slot, source = the working preset), so every write still goes through the checked STORE path.
  const currentSlot = tracks ? tracks.presets[tracks.selected - 1] : null
  useEffect(() => { onCurrent?.(currentSlot === null ? null : { slot: currentSlot, name: Object.hasOwn(names, currentSlot - 1) ? names[currentSlot - 1] : null }) }, [currentSlot, names[(currentSlot ?? 0) - 1], Object.hasOwn(names, (currentSlot ?? 0) - 1)])
  useEffect(() => { if (!storeRequest?.seq || currentSlot === null) return; setSource('working'); setDestination(currentSlot - 1); setName(storeRequest.name.replace(/[^\x20-\x7e]|'/g, '').slice(0, 24)); setSaveOpen(true) }, [storeRequest?.seq])
  const label = (slot: number) => `${slot + 1} · ${names[slot] || t(Object.hasOwn(names, slot) ? 'Unnamed preset' : 'Name not read')}`
  function save(syx: boolean) {
    if (!snapshot) return
    const suffix = snapshot.request.kind === 'slot' ? `preset-${snapshot.request.slot + 1}` : snapshot.request.kind
    download(syx ? new Uint8Array(bclFile(snapshot.text)) : snapshot.text, `bcr32-${suffix}.${syx ? 'syx' : 'bcl'}`, syx ? 'application/octet-stream' : 'text/plain')
  }
  const locked=!available||busy||storeBusy
  const snapshotLabel=snapshot ? snapshot.request.kind==='slot'?label(snapshot.request.slot):t(snapshot.request.kind==='working'?'Current working preset':snapshot.request.kind==='all'?'Full controller bank':'Global settings') : t('Nothing read yet')
  function chooseRead(request:PresetRead){setMenu(null);void read(request)}
  return <section className="controller-presets" aria-label={t('BCR32 hardware presets')}>
    <div hidden={saveOpen}>
      <div className="mock-card">
      <div className="preset-picker-heading"><b>{t('BCR32 hardware presets')}</b><button type="button" disabled={locked} aria-label={t('Read 64 preset names')} title={t('Read 64 preset names')} onClick={()=>chooseRead({kind:'names'})}><Icon name="rotate"/></button></div>
      <label className="preset-source-label">{t('Preset')}<select aria-label={t('Preset to read')} value={source} disabled={busy||storeBusy} onChange={e=>setSource(e.target.value)}><option value="working">{t('Current working preset')}</option>{Array.from({length:64},(_,i)=><option key={i} value={i}>{label(i)}</option>)}</select></label>
      <div className="preset-commandbar mock-actions" ref={toolbar} onKeyDown={e=>{if(e.key==='Escape'){setMenu(null);(toolbar.current?.querySelector(`[data-command=${menu}]`) as HTMLButtonElement|null)?.focus()}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setMenu(null)}}>
        <button data-command="read" type="button" aria-expanded={menu==='read'} aria-controls={`${menuId}-read`} onClick={()=>setMenu(menu==='read'?null:'read')}>{t('Read')}<span aria-hidden="true"> ▾</span></button>
        <button type="button" disabled={locked} onClick={()=>{setMenu(null);setSaveOpen(true)}}>{t('Save to…')}</button>
        <button data-command="export" type="button" disabled={!snapshot} aria-expanded={menu==='export'} aria-controls={`${menuId}-export`} onClick={()=>setMenu(menu==='export'?null:'export')}>{t('Export')}<span aria-hidden="true"> ▾</span></button>
        <div className="preset-action-menu" id={`${menuId}-read`} role="group" aria-label={t('Read options')} hidden={menu!=='read'}>
          <small>{t('Read from BCR32')}</small>
          <button disabled={locked} onClick={()=>chooseRead(source==='working'?{kind:'working'}:{kind:'slot',slot:Number(source)})}><Icon name="folder"/><span>{t('Read complete preset')}<small data-i18n-skip>{source==='working'?t('Current working preset'):label(Number(source))}</small></span></button>
          <button disabled={locked} onClick={()=>chooseRead({kind:'all'})}><Icon name="copy"/><span>{t('Read full controller bank')}</span></button>
          <button disabled={locked} onClick={()=>chooseRead({kind:'global'})}><Icon name="sliders"/><span>{t('Read global backup')}</span></button>
        </div>
        <div className="preset-action-menu" id={`${menuId}-export`} role="group" aria-label={t('Export options')} hidden={menu!=='export'}>
          <small>{t('Last read content')}: <span data-i18n-skip>{snapshotLabel}</span></small>
          <button onClick={()=>{setMenu(null);save(true)}}><Icon name="import"/>{t('Save BCL SysEx file')}</button>
          <button onClick={()=>{setMenu(null);save(false)}}><Icon name="log"/>{t('Save BCL text')}</button>
          <button onClick={()=>{setMenu(null);setRawOpen(true)}}><Icon name="sliders"/>{t('View BCL text')}</button>
        </div>
      </div>
      <p className="preset-read-context">{t('Last read content')}: <span data-i18n-skip>{snapshotLabel}</span></p>
      {snapshot&&<details open={rawOpen} onToggle={e=>setRawOpen(e.currentTarget.open)}><summary>{t('Raw hardware preset')}</summary><pre data-i18n-skip>{snapshot.text}</pre></details>}
      </div>
      <div className="mock-card track-shortcuts">
      <div className="preset-picker-heading"><b>{t('T1–T4 preset shortcuts')}</b> <span className="writes-hardware" title={t('Writes the BCR32')}>⬆ BCR32</span></div>
      <p className="surface-help">{t('Each shortcut recalls a BCR32 preset. Selecting it reloads the preset; the working contents are backed up first.')}</p>
      <div className="track-shortcut-grid">{Array.from({length:4},(_,i)=><label key={i}>T{i+1}<select aria-label={`T${i+1} preset`} disabled={!tracks||busy||storeBusy} value={trackDraft[i]} onChange={e=>setTrackDraft(p=>p.map((v,j)=>j===i?Number(e.target.value):v) as ControllerTracks['presets'])}>{Array.from({length:64},(_,slot)=><option key={slot} value={slot+1}>{label(slot)}</option>)}</select></label>)}</div>
      <button disabled={!tracks||!available||busy||storeBusy||tracks.presets.every((v,i)=>v===trackDraft[i])} onClick={()=>{void changeTracks()}}>{t('Assign shortcut presets')}</button>
      <p className="surface-help">{t('Selected shortcut')}: <span data-i18n-skip>{tracks?`T${tracks.selected} · ${tracks.presets[tracks.selected-1]}`:'—'}</span></p>
      </div>
    </div>
    {saveOpen&&<form className="preset-save-sheet" aria-label={t('Save to BCR32')} onSubmit={e=>{e.preventDefault();void store()}}>
      <button type="button" className="preset-back" disabled={storeBusy} onClick={()=>setSaveOpen(false)}><Icon name="close"/>{t('Back to presets')}</button>
      <h3>{t('Save to BCR32')}</h3>
      <p className="preset-save-source">{t('Source')}: <span data-i18n-skip>{source==='working'?t('Current working preset'):label(Number(source))}</span></p>
      <label>{t('Hardware save destination')}<select autoFocus aria-label={t('Hardware save destination')} disabled={storeBusy} value={destination??''} required onChange={e=>setDestination(e.target.value===''?null:Number(e.target.value))}><option value="">{t('Choose destination 1–64')}</option>{Array.from({length:64},(_,i)=><option key={i} value={i}>{label(i)}</option>)}</select></label>
      <label>{t('Destination preset name')}<input disabled={storeBusy} maxLength={24} required value={name} onChange={e=>setName(e.target.value.replace(/[^\x20-\x7e]|'/g,''))}/></label>
      <p className="surface-help">{t('Stores the selected source, including pedals. Unsent local edits are excluded.')}</p>
      <div className="preset-sheet-actions"><button type="button" disabled={storeBusy} onClick={()=>setSaveOpen(false)}>{t('Cancel')}</button><button className="primary" type="submit" disabled={!presetStorageValidated||locked||destination===null||!name.trim()}><Icon name="save"/>{t('Save complete preset to BCR32')}</button></div>
    </form>}
    <div className="preset-operation-status"><p role="status">{t(notice)}{(busy||storeBusy)&&count>0&&<span data-i18n-skip> · {count}</span>}</p>{busy&&<button onClick={()=>reader.current?.cancel()}>{t('Cancel read')}</button>}</div>
    {storeError&&<p role="alert" data-i18n-skip>{storeError}</p>}
  </section>
}
