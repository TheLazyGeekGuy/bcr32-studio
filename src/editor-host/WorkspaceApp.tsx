import { useEffect, useRef, useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import {automaticMidiAccess} from '../midi-permission'
import {createEditorRuntime,type EditorRuntime} from './runtime'
import type {EditorHostInstallation} from './installation'
import type {NativePresenceProvider} from './native-presence'
import {editorDragType,droppedEditorId,nextInstanceName,catalogIntent} from './catalog'
import {EditorPalette} from './EditorPalette'
import {InstanceNameDialog} from './InstanceNameDialog'
import {EditorViewBoundary,EditorViewContent} from './EditorViewBoundary'
import { themes, loadTheme, type Theme } from '../themes'
import { displayStyles, displayStyleKey, validDisplayStyle, type DisplayStyle } from '../display-styles'
import { LanguagePicker, translate, useLanguage } from '../i18n'
import {OfflineStatus} from '../OfflineStatus'
import { Icon } from '../Icon'
import {MidiConnectionIndicator} from '../MidiConnectionIndicator'
import {usePresentationSettings} from './PresentationTools'
import './workspace.css'
import type {TranslatorService} from '../translator/service'
import {midiTranslatorModule} from '../translator/module'
import type {PresetExchange} from './preset-exchange'

const savedKey = 'bcr-studio.multi-workspace.v1'
type Runtime=EditorRuntime&{translator:TranslatorService}

// Navigation around the COMPLETE editor. Hidden instances remain mounted; no reduced inspector or duplicate panel UI.
export default function WorkspaceApp({installation,nativePresence,tools,presetExchange}:{installation:EditorHostInstallation;nativePresence?:NativePresenceProvider;tools?:ReactNode;presetExchange?:PresetExchange}) {
  const {registry,views:editorViews,catalog:editorCatalog}=installation
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [runtime, setRuntime] = useState<Runtime | null>(null), permissionRef = useRef<ReturnType<typeof automaticMidiAccess> | null>(null)
  const [, render] = useState(0), [notice, setNotice] = useState(''), [railCollapsed, setRailCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false), [pendingModel,setPendingModel]=useState<string|null>(null),[dropActive,setDropActive]=useState(false)
  const [translatorOpen,setTranslatorOpen]=useState(false),[translatorArmed,setTranslatorArmed]=useState(false)
  const [globalTheme, setGlobalTheme] = useState<Theme>(loadTheme), [globalDisplay, setGlobalDisplay] = useState<DisplayStyle>(() => { try { const value = window.localStorage.getItem(displayStyleKey); return validDisplayStyle(value) ? value : 'ice' } catch { return 'ice' } })
  const createInstance = (r: Runtime, moduleId: string, resume = false, name?:string) => {
    const m = registry.get(moduleId).manifest, view=editorViews.get(moduleId)
    let previous: string | undefined
    try { const saved = window.localStorage.getItem(`bcr-studio.last-instance.${m.modelId}`); if (resume && saved && /^[a-zA-Z0-9_-]{1,100}$/.test(saved)) previous = saved } catch { /* Optional recovery hint. */ }
    const id = r.workspace.create(moduleId, { id: previous, name: name??nextInstanceName(m.name,r.workspace.list().map(e=>e.name)), restored: resume?view.loadInitial?.(previous):undefined })
    try { const key=`bcr-studio.last-instance.${m.modelId}`; if(resume || window.localStorage.getItem(key)===null)window.localStorage.setItem(key,id) } catch { /* Draft export still works. */ }
    return id
  }
  useEffect(() => {
    const host=createEditorRuntime({registry,views:editorViews,nativePresence,presetExchange,autoDiscover:installation.load?false:undefined,appearance:{theme:globalTheme,displayStyle:globalDisplay},
      onNotice:setNotice,
      requestAccess:()=>{permissionRef.current??=automaticMidiAccess();return permissionRef.current.catch(error=>{permissionRef.current=null;throw error})},
      recover:moduleId=>{
        const m=registry.get(moduleId).manifest
        let id:string|undefined
        try{const saved=window.localStorage.getItem(`bcr-studio.last-instance.${m.modelId}`);if(saved&&/^[a-zA-Z0-9_-]{1,100}$/.test(saved))id=saved}catch{/* optional hint */}
        return {id,restored:editorViews.get(moduleId).loadInitial?.(id)}
      }})
    const translator=midiTranslatorModule.create(host.broker,host.access,host.parameters),r:Runtime=Object.assign(host,{translator})
    const offTranslator=translator.subscribe(()=>setTranslatorArmed(translator.getSnapshot().armed))
    setRuntime(r)
    const off=host.workspace.subscribeShell(()=>{render(n=>n+1);queueMicrotask(()=>installation.releaseUnused?.())}),offViews=host.views.subscribe(()=>render(n=>n+1))
    void host.request().catch(()=>{})
    return()=>{off();offViews();offTranslator();translator.dispose();host.dispose();installation.releaseUnused?.()}
  }, [installation,nativePresence,presetExchange])
  const run = (fn: () => void|Promise<void>) => { setNotice(''); try { void Promise.resolve(fn()).catch(e=>setNotice(e instanceof Error?e.message:String(e))) } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) } }
  const globalPresentation=usePresentationSettings(runtime?.presentation.global())
  const workspace = runtime?.workspace, entries = workspace?.list() ?? [], active = entries.find(e => e.id === workspace?.getActive())
  const openEditor=(moduleId:string,gesture:'click'|'drop'='click')=>{
    if(!runtime||!workspace)return
    registry.get(moduleId)
    if(!workspace.isEnabled(moduleId))throw Error('Editor module disabled')
    const intent=catalogIntent(moduleId,gesture,entries,workspace.getActive())
    if(intent.type==='activate')workspace.activate(intent.id)
    else setPendingModel(moduleId)
  }
  const save = () => run(() => { window.localStorage.setItem(savedKey,JSON.stringify(workspace!.exportState())); setNotice(t('Workspace saved locally.')) })
  const exportJson = () => run(() => { const url=URL.createObjectURL(new Blob([JSON.stringify(workspace!.exportState(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='studio-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000) })
  const restore = (value: unknown) => run(async () => { const r=runtime;if(!r||r.disposed)throw Error('Editor workspace closed');try{await installation.prepareRestore?.(value);if(r.disposed)return;r.workspace.restoreState(value);const defaults=r.workspace.exportState().defaults;setGlobalTheme(defaults.theme);setGlobalDisplay(defaults.displayStyle)}finally{installation.releaseUnused?.()} })
  const close = (id: string) => run(() => { if(window.confirm(t('Close this editor? Export or save the workspace first.')))workspace!.closeInstance(id,{discardChanges:true}) })
  return <main className="studio editor-workspace" data-host-theme={globalTheme} data-rail-collapsed={railCollapsed || undefined}>
    <header className="ew-header"><button className="ew-icon" title={t('Editors')} aria-label={t('Editors')} aria-expanded={!railCollapsed} onClick={()=>setRailCollapsed(v=>!v)}><Icon name={railCollapsed?'expand':'collapse'} /></button><strong>MIDI <span>Studio</span></strong><small>v{version}</small><OfflineStatus /><div className="ew-header-spacer" /><button className="ew-command" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen}><Icon name="folder" />{t('Workspace')}</button><button className="ew-command" disabled={!runtime} aria-pressed={translatorArmed} onClick={()=>setTranslatorOpen(true)}><Icon name="midi"/>MIDI Translator{translatorArmed?' ●':''}</button><LanguagePicker /></header>
    <aside className="ew-rail" aria-label={t('Editors')}><EditorPalette items={editorCatalog.filter(item=>workspace?.isEnabled(item.id)??true)} disabled={!runtime} open={moduleId=>run(()=>openEditor(moduleId))} endDrag={()=>setDropActive(false)}/>
      <nav className="ew-instances">{entries.map(e=><button className="ew-instance" key={e.id} title={e.name} aria-pressed={e.id===active?.id} onClick={()=>run(()=>workspace!.activate(e.id))}><Icon name="sliders" /><span>{e.name}<small><MidiConnectionIndicator midi={workspace!.getTransport(e.id)} /></small></span></button>)}</nav>
      <div className="ew-rail-bottom">{tools}<button className="ew-command" title={t('Save workspace')} disabled={!workspace} onClick={save}><Icon name="save" /><span>{t('Save workspace')}</span></button></div></aside>
    <section className="ew-workspace" aria-label={t('Editor workspace')} data-drop-active={dropActive||undefined}
      onDragOver={event=>{if(event.dataTransfer.types.includes(editorDragType)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';setDropActive(true)}}}
      onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDropActive(false)}}
      onDrop={event=>{setDropActive(false);const moduleId=droppedEditorId(event.dataTransfer.types,event.dataTransfer.getData(editorDragType),editorCatalog);if(moduleId){event.preventDefault();event.stopPropagation();run(()=>openEditor(moduleId,'drop'))}}}>
      {dropActive&&<div className="ew-drop-hint">{t('Drop to open an editor')}</div>}<div className="ew-tabs" role="tablist" aria-label={t('Editor tabs')}>{entries.map(e=><div className="ew-tab" key={e.id} data-active={e.id===active?.id}><button role="tab" aria-selected={e.id===active?.id} id={`tab-${e.id}`} aria-controls={`editor-${e.id}`} onClick={()=>run(()=>workspace!.activate(e.id))}>{e.pinned&&<Icon name="folder" />}{e.name}</button><button className="ew-close" disabled={e.pinned} title={t('Close editor')} aria-label={`${t('Close editor')} ${e.name}`} onClick={()=>close(e.id)}><Icon name="close" /></button></div>)}</div>
      {entries.map(e=>{const record=runtime!.views.get(e.id),appearance=workspace!.appearance(e.id),fallback=<div role="alert"><p>{t('Editor unavailable')}</p><button onClick={()=>run(()=>runtime!.views.retry(e.id))}>{t('Retry editor')}</button></div>;return <section key={e.id} className="ew-instance-view" hidden={e.id!==active?.id} role="tabpanel" aria-labelledby={`tab-${e.id}`} id={`editor-${e.id}`}>
        <div className="ew-instance-toolbar"><span>{e.name}</span><MidiConnectionIndicator midi={workspace!.getTransport(e.id)} /><button className="ew-icon" title={t('Pin tab')} aria-label={t('Pin tab')} aria-pressed={e.pinned} onClick={()=>run(()=>workspace!.pin(e.id,!e.pinned))}><Icon name="folder" /></button><button className="ew-command" aria-pressed={e.snapshot.locked} onClick={()=>run(()=>workspace!.setLocked(e.id,!e.snapshot.locked))}>{t(e.snapshot.locked?'Unlock editing':'Lock editing')}</button></div>
        {record?.view?<EditorViewBoundary key={record.revision} fallback={fallback} onFault={error=>runtime!.views.fail(e.id,error)}><EditorViewContent view={record.view} presentation={runtime!.presentation.instance(e.id)} active={e.id===active?.id} locked={e.snapshot.locked} appearance={appearance} onAppearance={change=>run(()=>workspace!.setAppearance(e.id,{...e.appearance,...change}))} checkpoint={state=>{if(!runtime!.disposed&&runtime!.views.has(e.id))workspace!.updateViewState(e.id,state)}}/></EditorViewBoundary>:record?.error?fallback:<span>…</span>}</section>})}
      {!entries.length&&<div className="ew-empty"><Icon name="midi" /><h1>{t('Editors')}</h1><p>{t('Connect a controller or open an editor.')}</p><button className="ew-command" onClick={()=>{void runtime?.request().catch(()=>{})}}>{t('Connect MIDI')}</button></div>}
    </section>
    {menuOpen&&<section className="ew-menu" aria-label={t('Workspace')}><h2>{t('Workspace')}</h2><button className="ew-command" onClick={save}><Icon name="save" />{t('Save workspace')}</button><button className="ew-command" onClick={exportJson}><Icon name="export" />{t('Export workspace JSON')}</button><button className="ew-command" disabled={entries.length>0} onClick={()=>run(()=>restore(JSON.parse(window.localStorage.getItem(savedKey)??'null')))}><Icon name="import" />{t('Restore workspace')}</button><label className="ew-file">{t('Import workspace JSON')}<input type="file" accept=".json" disabled={entries.length>0} onChange={async e=>{const f=e.currentTarget.files?.[0];if(f)try{if(f.size>5000000)throw Error('Workspace file too large');restore(JSON.parse(await f.text()))}catch(error){setNotice(String(error))}}} /></label>
      <hr /><label><input type="checkbox" checked={globalPresentation.settings.activeZoom} onChange={e=>runtime?.presentation.setDefaults({activeZoom:e.target.checked})}/>{t('Zoom while adjusting')}</label><label>{t('Screen scale')}<input type="range" min="1" max="3" step="0.25" value={globalPresentation.settings.screenScale} onChange={e=>runtime?.presentation.setDefaults({screenScale:Number(e.target.value)})}/></label><label>{t('Global theme')}<select value={globalTheme} onChange={e=>run(()=>{const theme=e.currentTarget.value as Theme;workspace!.setDefaults({theme,displayStyle:globalDisplay});setGlobalTheme(theme)})}>{themes.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>{t('Global display')}<select value={globalDisplay} onChange={e=>run(()=>{const displayStyle=e.currentTarget.value as DisplayStyle;workspace!.setDefaults({theme:globalTheme,displayStyle});setGlobalDisplay(displayStyle)})}>{displayStyles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{active&&<button className="ew-command" onClick={()=>run(()=>workspace!.setAppearance(active.id,{}))}>{t('Use global appearance')}</button>}
      <details><summary>{t('Editors')}</summary>{registry.list().map(m=><label key={m.id}><input type="checkbox" checked={workspace?.isEnabled(m.id)??true} onChange={e=>run(()=>{const value=e.currentTarget.checked;if(value||window.confirm(t('Disable this module and close its editors? Save first.'))){workspace!.setEnabled(m.id,value,true)}})} />{m.name}</label>)}</details><a href="./">{t('Single editor')}</a><button className="ew-command" onClick={()=>setMenuOpen(false)}><Icon name="close" />{t('Close')}</button></section>}
    {pendingModel&&<InstanceNameDialog initial={nextInstanceName(registry.get(pendingModel).manifest.name,entries.map(e=>e.name))} model={registry.get(pendingModel).manifest.name}
      cancel={()=>setPendingModel(null)} submit={async name=>{const r=runtime;if(!r||r.disposed)return;try{if(r.workspace.list().some(e=>e.name===name))throw Error('An editor with this name already exists.');await installation.load?.(pendingModel);if(r.disposed)return;createInstance(r,pendingModel,false,name);setPendingModel(null)}finally{installation.releaseUnused?.()}}}/>}
    {notice&&<div className="ew-notice" role="status">{notice}<button className="ew-icon" aria-label={t('Close')} onClick={()=>setNotice('')}><Icon name="close" /></button></div>}
    {translatorOpen&&runtime&&<midiTranslatorModule.Panel service={runtime.translator} access={runtime.access} request={runtime.request} close={()=>setTranslatorOpen(false)}/>}
  </main>
}
