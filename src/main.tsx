import { StrictMode,Suspense,lazy } from 'react'
import { createRoot,type Root } from 'react-dom/client'
import {createLazyEditorInstallation} from './editor-host/lazy-installation'
import {generatedLazyEditors,distribution,loadWorkspace,loadLegacy,loadLibrary} from 'virtual:midi-studio-distribution'
import {createNativePresenceClient} from './editor-host/native-presence'
import { I18nProvider } from './i18n'
import {RouteBoundary} from './RouteBoundary'
import './styles.css'
import './offline.css'
import './editor-host/midi-connection.css'
import {startOffline} from './offline'
import {createPresetExchange} from './editor-host/preset-exchange'
import {DocumentationLink} from './editor-host/DocumentationLink'

const App=loadLegacy?lazy(loadLegacy):null
const WorkspaceApp=loadWorkspace?lazy(loadWorkspace):null
const LibraryTool=loadLibrary?lazy(loadLibrary):null
const presetExchange=createPresetExchange()
const tools=<><DocumentationLink/>{LibraryTool?<Suspense fallback={<span>…</span>}><LibraryTool exchange={presetExchange}/></Suspense>:null}</>
const installation=createLazyEditorInstallation(generatedLazyEditors)

startOffline(new URL(import.meta.env.BASE_URL,document.baseURI),import.meta.env.PROD)
const params=new URLSearchParams(window.location.search),editorId=params.get('editor')??(distribution.mode==='standalone'?distribution.modules[0]:null)
const standalone=editorId&&installation.registry.list().some(m=>m.id===editorId)
  ? lazy(async()=>{const [selected,{StandaloneEditorApp}]=await Promise.all([installation.load(editorId),import('./editor-host/StandaloneEditorApp')]);return {default:()=> <StandaloneEditorApp automaticMidi={params.get('midi')!=='manual'} installation={selected} nativePresence={nativePresence} tools={tools} presetExchange={presetExchange}/>}}) : null
const Standalone=standalone
const nativePresence=params.get('native')==='0'?undefined:import.meta.env.DEV
  ?createNativePresenceClient(new URL('/__midi-studio/native-ports',window.location.origin))
  :params.get('native')==='1'?createNativePresenceClient(new URL('http://127.0.0.1:5181/__midi-studio/native-ports')):undefined

// The dev virtual catalog can invalidate this entry. Never mount a second root on the same container.
const root:Root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!)
if(import.meta.hot)import.meta.hot.data.root=root
root.render(
  <StrictMode>
    <I18nProvider><RouteBoundary><Suspense fallback={<p role="status">…</p>}>{Standalone ? <Standalone/> : editorId ? <p role="alert">Editor not installed.</p> : WorkspaceApp&&(params.get('workspace')==='1'||!App) ? <WorkspaceApp installation={installation} nativePresence={nativePresence} tools={tools} presetExchange={presetExchange}/> : App ? <App tools={tools} presetExchange={presetExchange}/> : <p role="alert">Editor not installed.</p>}</Suspense></RouteBoundary></I18nProvider>
  </StrictMode>,
)
