import {Bcr32Help} from './Help'
import {PresentationTools,usePresentationSettings,type EditorScreen} from '../../../editor-host/PresentationTools'
import {floatingScreenSupported,openFloatingScreen,type FloatingScreen} from '../../../editor-host/floating-screen'
import type {PresentationInstance} from '../../../editor-host/presentation-preferences'
import {drawScreens,screenText,canvasSize} from '../../../display-canvas'
import {moveControl,type MoveKind,type MoveMode} from '../../../control-move'
import {bcr32} from '../../../device-bcr32'
import type {MonitorRow} from '../../../midi-monitor'
import {usePresetExchange} from '../../../use-preset-exchange'
import {createHistory} from '../../../history'
import {MidiMonitor} from '../../../MidiMonitor'
import type {MidiMonitor as Monitor} from '../../../midi-monitor'
import type {PresetExchange} from '../../../editor-host/preset-exchange'
import type {EditorStorage} from '../../../editor-environment'
import type {Theme} from '../../../themes'
import { controllerTracksFromBcl, type ControllerTracks } from './controller-tracks'
import { activeButtonValue, activityPorts, retainControlSources, controllerRoutes, routingFromBcl, type IndicatorReadings } from './controller-indicators'
import { isControllerPageRequest } from './controller-presets'
import { isBclWrite, presetStorageValidated } from './preset-store'
import { ControllerPresets } from './ControllerPresets'
import { useEffect, useMemo, useRef, useState } from 'react'
import { version as studioVersion } from '../../../../package.json'
import { createProfile, parseProfile, buttonValues, displayControlId, valueLimit, parameterLimit, is14Bit, isRelative, modesFor, typesFor, mmcCommands, defaultSettings, type Bcr32Profile, type ControllerSettings, type Encoder, type EncoderMode, type EncoderType } from './profile'
import { FrontPanel, type Selection, type LiveValues } from './FrontPanel'
import { encoderMessages, createCcSender, isBcrOutput } from './cc-transport'
import { asHex, describeMessage, isSystemRealtime, parseFirmwareReply, productQuery, supportsWebMidi, type MidiAccess, type MidiPort } from './web-midi'
import { associateDefaultEncoder, automaticMidiAccess, automaticPorts, isControllerPort } from './auto-midi'
import { parseTheme, themes, themeStorageKey } from './themes'
import { Icon } from './Icon'
import { ledModes, ledModeLabel, type LedMode } from './led-modes'
import { translatedTree, useLanguage, translate } from './i18n'
import { ParameterPicker, ParameterTable } from './ParameterNames'
import { loadNames, namesFile, parameterNamesKey, type ParameterName } from './parameter-names'
import { cleanLabel, controlIndex, draftStorageKey, emptyLabels, emptyValues, libraryFile, makePreset, parseControllerState, parseLibrary, parsePreset, presetStorageKey, sameState, type ControllerPreset, type ControllerState } from './presets'
import { idleActivity, type Activity } from './ActivityLeds'
import { modeText, controlForChanges } from './oled-model'
import { applyChange, buttonValue, createMidiDecoder, decoderKey, transportIssue, type LiveValue } from './controller-midi'
import { buttonNames } from './panel-layout'
import { ControlSearch } from './ControlSearch'
import { LibraryList } from './LibraryList'
import { SequencerView } from './SequencerView'
import { createBrightnessTransport } from './led-brightness'
import { applySelectionChange, selectControls, selectedControls, selectionKey, sharedField, type SelectionGesture, type ControlChange } from './multi-selection'
import { applyLearn, createLearnSession, describeApplied, type LearnResult } from './midi-learn'
import { createDisplayArbiter, followSettled, type ActiveControl } from './display-arbiter'
import { cubaseFolder, cubaseMidiRemoteScript } from './cubase-export'
import { displayStyles, type DisplayStyle } from './display-styles'
import { createGlobalsReader, settingsFromDevice, valueOf, withValue, type GlobalResult } from './device-globals'
import { DeviceSettings, type WriteStatus } from './DeviceSettings'
import { applyRecord, decodeControllerDump, knownRecords, type ControllerDump, type DumpRecord } from './controller-dump'
import { ExportImport } from './ExportImport'
import { FirmwareTools } from './FirmwareTools'
import { firmwareOne, isFirmwareRead } from './firmware-codec'
import { controllerGroups, controllerTargets, createControllerReader, emptyControllerRead, mergeControllerRead, assignmentFromRead, type ControllerGroup, type ControllerReadState } from './controller-read'
import { ControllerReadPanel, ControllerReadValues, FirmwareIdentity } from './ControllerReadPanel'
import { changedControllerFields, createAssignmentWriter, isEncoderAssignmentWrite, type AssignmentWriteState } from './controller-write'
import { AssignmentWriteStatus } from './AssignmentWritePanel'
import { createPortal } from 'react-dom'
import { FloatingDisplay, delegatingTimers, floatingSupported, openFloatingWindow } from './FloatingDisplay'
import { controlLabel } from './FrontPanel'
import { DisplayPreview } from './OledDisplay'

const storageKey = 'bcr32-studio.profile.v1'
// Log lines keep hex and description apart so translatedTree can translate the description alone.
type LogLine = { hex: string; text: string; note?: string }
// Fetched once per page; the PDF export used to reload the 556 KB font on every export.
let pdfFont: Promise<ArrayBuffer> | null = null
const workspaceKey = 'bcr32-studio.workspace.v1'
const initialNotice = 'MIDI reception available after connection; CC sending disabled. Hardware configuration locked.'

function download(data: BlobPart, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fileStem = (name: string) => name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'preset'

export interface WorkbenchProps {
 storage: EditorStorage; initialState?: ControllerState; requestAccess: typeof automaticMidiAccess
 bindPair: (input:string,output:string)=>void; onSnapshot: (state:ControllerState)=>void
 themeOverride:Theme; displayOverride:DisplayStyle; onAppearance:(change:{theme?:Theme;displayStyle?:DisplayStyle})=>void
 autoZoomOverride:boolean; onAutoZoom:(on:boolean)=>void; active:boolean; locked:boolean
 instanceId:string; presetsExchange?:PresetExchange; signal?:AbortSignal; monitor:Monitor
 parameters?:import('../../../translator/parameters').ParameterBus; presentation?:PresentationInstance; onHelpReady:(open:(()=>void)|undefined)=>void; onMidiSettingsReady?:(open:(()=>void)|undefined)=>void
 authorizeTransfer:(frames:number[][])=>(()=>void)
}
function App({storage,initialState,requestAccess,bindPair,onSnapshot,themeOverride,displayOverride,onAppearance,autoZoomOverride,onAutoZoom,active,locked,instanceId,presetsExchange,signal,monitor,authorizeTransfer,presentation,onHelpReady,onMidiSettingsReady,parameters}:WorkbenchProps) {
  const lockedRef=useRef(locked);lockedRef.current=locked
function loadProfile(): Bcr32Profile {
  try {
    const candidate = storage.getItem(storageKey)
    if (!candidate) return createProfile()
    return parseProfile(JSON.parse(candidate))
  } catch {
    return createProfile()
  }
}

function loadDraft(): ControllerState {
  try {
    const json = storage.getItem(draftStorageKey)
    if (json) return parseControllerState(JSON.parse(json))
  } catch { /* Keep the original profile when draft storage is invalid. */ }
  return { profile: loadProfile(), labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' }
}
function loadLibrary(): ControllerPreset[] {
  try { return parseLibrary(JSON.parse(storage.getItem(presetStorageKey) || 'null')) } catch { return [] }
}
function loadWorkspace() {
  try {
    const p = JSON.parse(storage.getItem(workspaceKey) || 'null')
    if (p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 80) return p as { id: string; name: string }
  } catch { /* A missing workspace does not discard the draft. */ }
  return { id: '', name: 'My preset' }
}

  const language = useLanguage()
  const [initial] = useState(()=>initialState ? parseControllerState(initialState) : loadDraft())
  const theme=themeOverride
  const setTheme=(theme:Theme)=>onAppearance({theme})
  const [parameterNames, setParameterNames] = useState(()=>loadNames(storage))
  const [parameterOpen, setParameterOpen] = useState(0)
  const saveParameterNames = (entries: ParameterName[]) => {
    try { storage.setItem(parameterNamesKey, JSON.stringify(namesFile(entries))); setParameterNames(entries) }
    catch { setNotice('Table not saved: local storage unavailable.') }
  }
  const autoZoom=autoZoomOverride, setAutoZoom=onAutoZoom
  // Numbers above encoders and keys: shown unless the user turned them off.
  // Label screen above the OLED: off unless the user turned it on.
  const [nameScreen, setNameScreen] = useState(() => { try { return storage.getItem('bcr32-studio.name-screen') === 'true' } catch { return false } })
  useEffect(() => { try { storage.setItem('bcr32-studio.name-screen', String(nameScreen)) } catch { /* Optional preference. */ } }, [nameScreen])
  // Screen style of the OLED and the label screen (Config), remembered per browser.
  const displayStyle=displayOverride
  const setDisplayStyle=(displayStyle:DisplayStyle)=>onAppearance({displayStyle})
  // Test mode shows the Test block of the Control tab (value fader, test press); off by default.
  const [testMode, setTestMode] = useState(() => { try { return storage.getItem('bcr32-studio.test-mode') === 'true' } catch { return false } })
  useEffect(() => { try { storage.setItem('bcr32-studio.test-mode', String(testMode)) } catch { /* Optional preference. */ } }, [testMode])
  const [showNumbers, setShowNumbers] = useState(() => { try { return storage.getItem('bcr32-studio.show-numbers') !== 'false' } catch { return true } })
  useEffect(() => { try { storage.setItem('bcr32-studio.show-numbers', String(showNumbers)) } catch { /* Optional preference. */ } }, [showNumbers])
  const [presetLocation,setPresetLocation]=useState<'hardware'|'browser'>('hardware')
  const [localSaveOpen,setLocalSaveOpen]=useState(false)
  const [tab, setTab] = useState<'control' | 'device' | 'log' | 'presets' | 'files'>('control')
  const [toolsCollapsed,setToolsCollapsed]=useState(false)
  // Display menu of the editor toolbar: closes on Escape or a pointer press outside it.
  const [displayOpen,setDisplayOpen]=useState(false),displayMenu=useRef<HTMLDivElement>(null)
  const {preferences:presentationStore}=usePresentationSettings(presentation),[,setInheritTick]=useState(0)
  const inheritsPresentation=presentationStore.isInherited('activeZoom')&&presentationStore.isInherited('screenScale')
  useEffect(()=>{if(!displayOpen)return;const close=(event:PointerEvent)=>{if(!displayMenu.current?.contains(event.target as Node))setDisplayOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[displayOpen])
  // Documentation (host header) opens the help over the current tab; the tab itself, and what it arms, is unchanged.
  const [helpOpen,setHelpOpen]=useState(false),view=helpOpen?'help':tab
  useEffect(()=>{onHelpReady(()=>setHelpOpen(true));return()=>onHelpReady(undefined)},[onHelpReady])
  // Host MIDI icon beside the connection status: the MIDI connection window (permission, ports, CC sending).
  const [midiSettingsOpen,setMidiSettingsOpen]=useState(false)
  const midiSettingsDialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{onMidiSettingsReady?.(()=>setMidiSettingsOpen(true));return()=>onMidiSettingsReady?.(undefined)},[onMidiSettingsReady])
  useEffect(()=>{const dialog=midiSettingsDialog.current;if(!dialog)return;if(midiSettingsOpen&&!dialog.open)dialog.showModal();else if(!midiSettingsOpen&&dialog.open)dialog.close()},[midiSettingsOpen])
  const [profile, setProfile] = useState<Bcr32Profile>(initial.profile)
  const profileRef = useRef(profile); profileRef.current = profile
  // Only the fields the MIDI decoder reads: a label or LED edit must not recreate it.
  const midiKey = useMemo(() => decoderKey(profile), [profile])
  const [customLabels, setCustomLabels] = useState(initial.labels)
  const [auxValues, setAuxValues] = useState(initial.values)
  const [presets, setPresets] = useState(loadLibrary)
  const [presetId, setPresetId] = useState(() => { const id = loadWorkspace().id; return presets.some(p => p.id === id) ? id : '' })
  const [presetName, setPresetName] = useState(() => loadWorkspace().name)
  const hasPresetRef = useRef(!!presetId); hasPresetRef.current = !!presetId
  const [pdfBusy, setPdfBusy] = useState(false)
  const [activity, setActivity] = useState<Activity>(idleActivity)
  const pulseActivity = (source: Activity['source'], ports: number[] = source === 'local' ? [] : [5]) => setActivity(current => ({ serial: current.serial + 1, source, pulses: Array.from({ length: 6 }, (_, i) => (current.pulses?.[i] ?? 0) + (ports.includes(i) ? 1 : 0)) }))
  const indicatorRef = useRef<IndicatorReadings>({ outputRouting: null, midiInput: null, feet: [null, null] })
  const [selection, setSelection] = useState<Selection>({ kind: 'encoders', id: 1 })
  const [selections, setSelections] = useState<Selection[]>([{kind:'encoders',id:1}])
  const [mouseMulti,setMouseMulti]=useState(false)
  const selectionsRef = useRef(selections);selectionsRef.current=selections
  const selectionAnchor = useRef<Selection>({kind:'encoders',id:1})
  const selectionRef = useRef(selection); selectionRef.current = selection
  // MIDI Learn: refs keep the armed flag and the session (parser + 14-bit pair timer) out of the receive effect's closure.
  const [learn, setLearn] = useState({ active: false, status: '' })
  const learnArmed = useRef(false)
  const learnSession = useRef<ReturnType<typeof createLearnSession> | null>(null)
  const learnReceive = useRef<(data: number[]) => boolean>(() => false)
  const [screenControl, setScreenControl] = useState<Selection>({ kind: 'encoders', id: 1 })
  // Display arbiter (src/display-arbiter.ts): the OLED and the auto-zoom follow its `shown` (one change per dwell at most), the inspector
  // selection follows `settled`, the activity strip shows `active`. Created once with real timers; onChange fires at a tick, or
  // once with the empty state on reset()/stop() so the strip empties with the arbiter.
  const [activeControls, setActiveControls] = useState<ActiveControl[]>([])
  // Floating display window (src/FloatingDisplay.tsx): while open, the arbiter's timers run in it (visible, not throttled).
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const pipRef = useRef<Window | null>(null); pipRef.current = pipWindow
  const [arbiter] = useState(() => createDisplayArbiter({ timers: delegatingTimers(() => pipRef.current), onChange: state => {
    setActiveControls(current => current.length === 0 && state.active.length === 0 ? current : state.active)
    const shown = state.shown
    if (shown) setScreenControl(current => selectionKey(current) === selectionKey(shown) ? current : shown)
    // Same guard as the former per-message follow (controlForChanges): single selection only, never while Learn is armed, not already
    // selected. No other memo: after a panel click on B, A turned again must re-select A (the arbiter was reset by the click).
    const settled = followSettled(state.settled, selectionRef.current, selectionsRef.current, learnArmed.current)
    if (settled) { selectionRef.current = settled; setSelection(settled); setSelections([settled]); selectionsRef.current = [settled] }
  } }))
  useEffect(() => () => arbiter.stop(), [arbiter])
  const alive=useRef(false)
  useEffect(() => {alive.current=true;return()=>{alive.current=false;pipRef.current?.close()}}, [])
  // Borderless floating screen: the OLED drawn into a canvas shown as video picture-in-picture (no title bar, like a
  // video player). Redrawn on every render while open; closing it from the system control updates the button.
  const [videoFloating,setVideoFloating]=useState(false),videoFloat=useRef<FloatingScreen|null>(null),latestScreen=useRef<EditorScreen|null>(null)
  useEffect(()=>{try{videoFloat.current?.redraw()}catch{/* closed by the failure */}})
  useEffect(()=>()=>videoFloat.current?.close(),[])
  async function toggleVideoFloating() {
    if (videoFloat.current) { videoFloat.current.close(); return }
    const screen = latestScreen.current; if (!screen) return
    try { videoFloat.current = await openFloatingScreen({ width: screen.width, height: screen.height, draw: ctx => latestScreen.current?.draw(ctx) }, () => { videoFloat.current = null; if (alive.current) setVideoFloating(false) }, signal); setVideoFloating(true) }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }
  async function toggleFloatingDisplay() {
    if (pipRef.current) { pipRef.current.close(); return }
    try {
      const pip = await openFloatingWindow()
      if(!alive.current||signal?.aborted){pip.close();return}
      pip.document.body.classList.add('bcr32-workbench')
      pip.addEventListener('pagehide', () => setPipWindow(current => current === pip ? null : current))
      setPipWindow(pip)
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }
  const [values, setValues] = useState<LiveValues>(() => Object.fromEntries(initial.values.encoders.flatMap((v, i) => v === null ? [] : [[i + 1, { value: v, source: 'local' as const }]])))
  const liveRef = useRef(values); liveRef.current = values
  const auxRef = useRef(auxValues); auxRef.current = auxValues
  const [receivedAux, setReceivedAux] = useState<Record<string, number | null>>({})
  const receivedAuxRef=useRef(receivedAux);receivedAuxRef.current=receivedAux
  const [controllerTracks,setControllerTracks]=useState<ControllerTracks|null>(null)
  const controllerTracksRef=useRef(controllerTracks);controllerTracksRef.current=controllerTracks
  const trackSelect=useRef<((track:number)=>void)|null>(null)
  const [auxSources, setAuxSources] = useState<Record<string, LiveValue['source']>>({})
  const heldButton = useRef<{ control: Selection; config: Encoder } | null>(null)
  const [ringMode, setRingMode] = useState<LedMode>(initial.ringMode)
  const [access, setAccess] = useState<MidiAccess | null>(null)
  const [inputId, setInputId] = useState('')
  const [outputId, setOutputId] = useState('')
  const [sendCC, setSendCC] = useState(false)
  const [portVersion, setPortVersion] = useState(0)
  const sender = useRef<ReturnType<typeof createCcSender> | null>(null)
  const automaticEmissionPort = useRef<MidiPort | null>(null)
  const automaticStarted = useRef(false)
  const associatedOnce = useRef(false)
  const connecting = useRef(false)
  const probedPair = useRef<{ access: MidiAccess; input: MidiPort; output: MidiPort } | null>(null)
  const [events, setEvents] = useState<LogLine[]>([])
  const [notice, setNotice] = useState(initialNotice)
  const [brightness, setBrightness] = useState<number | null>(null)
  const [brightnessDraft, setBrightnessDraft] = useState(5)
  const [brightnessStatus, setBrightnessStatus] = useState('')
  const brightnessTransport = useRef<ReturnType<typeof createBrightnessTransport>|null>(null)
  // Read-only global settings (src/device-globals.ts): the official editor's short reads, one at a time.
  const globalsReader = useRef<ReturnType<typeof createGlobalsReader>|null>(null)
  const [deviceSettings, setDeviceSettings] = useState<GlobalResult[] | null>(null)
  const [deviceSettingsBusy, setDeviceSettingsBusy] = useState(false)
  const [globalsRevision, setGlobalsRevision] = useState(0)
  const [bclSettings, setBclSettings] = useState<Partial<ControllerSettings> | null>(null)
  const bclSettingsRef = useRef(bclSettings); bclSettingsRef.current = bclSettings
  const deviceSettingsRef = useRef(deviceSettings); deviceSettingsRef.current = deviceSettings
  const [writeStatus, setWriteStatus] = useState<Record<number, WriteStatus>>({})
  // Front-panel exports received while the editor listens (src/controller-dump.ts), newest first (all 64 presets fit).
  const [dumps, setDumps] = useState<ControllerDump[]>([])
  const [liveFirmware, setLiveFirmware] = useState<string | null>(null)
  const [liveDeviceId, setLiveDeviceId] = useState<number | null>(null)
  const firmwareReceive = useRef<(bytes: number[]) => void>(() => {}), sequencerReceive = useRef<(bytes: number[]) => void>(() => {})
  // Controller view (front panel and panel) or the full-width sequencer view; remembered per browser.
  const [editorMode, setEditorMode] = useState<'controller' | 'sequencer'>(() => { try { return storage.getItem('bcr32-studio.editor-mode') === 'sequencer' ? 'sequencer' : 'controller' } catch { return 'controller' } })
  useEffect(() => { try { storage.setItem('bcr32-studio.editor-mode', editorMode) } catch { /* Optional preference. */ } }, [editorMode])
  const [presetBusy, setPresetBusy] = useState(false)
  const presetReceive = useRef<(bytes: number[]) => void>(() => {})
  const controllerReader = useRef<ReturnType<typeof createControllerReader> | null>(null)
  const [controllerRead, setControllerRead] = useState(emptyControllerRead)
  const [autoReadController, setAutoReadController] = useState(() => { try { return storage.getItem('bcr32-studio.controller-autoread') !== 'false' } catch { return true } })
  const [presetCacheEnabled, setPresetCacheEnabled] = useState(() => { try { return storage.getItem('bcr32-studio.preset-cache') !== 'false' } catch { return true } })
  const presetCacheEnabledRef = useRef(presetCacheEnabled); presetCacheEnabledRef.current = presetCacheEnabled
  const [fromPresetCache, setFromPresetCache] = useState(false)
  // Session-only: a reconnect must read the physical controller again.
  const presetCache = useRef(new Map<number, { profile: Bcr32Profile; values: LiveValues; aux: typeof auxValues; received: typeof receivedAux; sources: typeof auxSources; read: ControllerReadState }>())
  const cacheInitialized = useRef(false)
  const auxSourcesRef = useRef(auxSources); auxSourcesRef.current = auxSources
  const restoringCache = useRef(false)
  useEffect(() => {
    presetCache.current.clear()
    try { storage.setItem('bcr32-studio.preset-cache', String(presetCacheEnabled)) } catch { /* Optional preference. */ }
  }, [presetCacheEnabled])
  const [readGroups, setReadGroups] = useState<ControllerGroup[]>([...controllerGroups])
  const autoReadControllerRef = useRef(autoReadController); autoReadControllerRef.current = autoReadController
  const readGroupsRef = useRef(readGroups); readGroupsRef.current = readGroups
  useEffect(() => { try { storage.setItem('bcr32-studio.controller-autoread', String(autoReadController)) } catch { /* Optional preference. */ } }, [autoReadController])
  const [probeRevision, setProbeRevision] = useState(0)
  const [assignmentLive, setAssignmentLive] = useState(() => { try { return storage.getItem('bcr32-studio.assignment-live') !== 'false' } catch { return true } })
  const assignmentWriter = useRef<ReturnType<typeof createAssignmentWriter> | null>(null)
  const [assignmentWrite, setAssignmentWrite] = useState<AssignmentWriteState>({ status: 'idle', queued: 0 })
  const controllerReadRef = useRef(controllerRead); controllerReadRef.current = controllerRead
  useEffect(() => { try { storage.setItem('bcr32-studio.assignment-live', String(assignmentLive)) } catch { /* Optional preference. */ } }, [assignmentLive])
  // Values read from the controller, as Config fields, with the time of the read (src/device-globals.ts settingsFromDevice).
  const [deviceSnapshot, setDeviceSnapshot] = useState<{ at: string; settings: Partial<ControllerSettings> } | null>(null)
  // Load the controller's settings automatically at each connection (default on, remembered per browser).
  const [autoLoadDevice, setAutoLoadDevice] = useState(() => { try { return storage.getItem('bcr32-studio.device-autoload') !== 'false' } catch { return true } })
  useEffect(() => { try { storage.setItem('bcr32-studio.device-autoload', String(autoLoadDevice)) } catch { /* Optional preference. */ } }, [autoLoadDevice])
  const autoLoadRef = useRef(autoLoadDevice); autoLoadRef.current = autoLoadDevice

  const inputs = useMemo(() => access ? Array.from(access.inputs.values()) : [], [access, portVersion])
  const outputs = useMemo(() => access ? Array.from(access.outputs.values()) : [], [access, portVersion])
  const output = outputs.find(port => port.id === outputId)
  const brightnessEnabled = !!access?.sysexEnabled && isBcrOutput(output) && isControllerPort(output) && inputs.some(p=>p.id===inputId && isControllerPort(p))
  const selected = profile[selection.kind].find((encoder) => encoder.id === selection.id)!
  const selectedItems = selectedControls(profile,selections)
  const multiple = selections.length>1
  const selectedKeys = new Set(selections.map(selectionKey))
  const batchType = sharedField(selectedItems.map(x=>x.control.type))
  const batchMode = sharedField(selectedItems.map(x=>x.control.mode))
  const commonTypes = typesFor(selection.kind==='encoders').filter(t=>selectedItems.every(x=>typesFor(x.selection.kind==='encoders').includes(t)))
  const commonModes = modesFor(selected.type,selection.kind==='encoders').filter(m=>selectedItems.every(x=>modesFor(x.control.type,x.selection.kind==='encoders').includes(m)))
  const selectedRotations = selectedItems.filter(x=>x.selection.kind==='encoders')
  const batchLed = sharedField(selectedRotations.map(x=>(x.control.ledMode??ringMode)==='dot'?'1dot_in':x.control.ledMode??ringMode))
  const selectUi = (value: Selection, gesture: SelectionGesture = {}, preserveTab = false) => {
    const list=selectControls(selectionsRef.current,value,selectionAnchor.current,gesture,profile)
    const active=list.find(s=>selectionKey(s)===selectionKey(value))??list[list.length-1]
    if(!gesture.range)selectionAnchor.current=value
    selectionsRef.current=list;setSelections(list);setSelection(active);arbiter.reset();setScreenControl(active)
    if(!preserveTab)setTab('control')
  }
  const snapshot: ControllerState = useMemo(() => ({ profile, labels: customLabels, ringMode, values: { ...auxValues, encoders: profile.encoders.map(e => values[e.id]?.value ?? null) } }), [profile, customLabels, ringMode, auxValues, values])
  useEffect(()=>onSnapshot(snapshot),[snapshot,onSnapshot])
  const parameterLast=useRef(new Map<string,number>())
  // Optional common tool adapter: routed targets only update local values, never the CC sender.
  useEffect(()=>{
    if(!parameters||!instanceId)return
    const offs=(['encoders','pushes','buttons'] as const).flatMap(kind=>profile[kind].map(e=>{
      const id=`${instanceId}:${kind}:${e.id}`
      return parameters.register({id,name:`${'BCR32'} · ${instanceId!.slice(0,8)} · ${kind} ${e.id}`,minimum:Math.min(e.minimum,e.maximum),maximum:Math.max(e.minimum,e.maximum),setLocal:(value,trace)=>{
        if(lockedRef.current)return
        parameterLast.current.set(id,value)
        if(kind==='encoders'){liveRef.current={...liveRef.current,[e.id]:{value,source:'local'}};setValues(liveRef.current)}
        else {auxRef.current={...auxRef.current,[kind]:auxRef.current[kind].map((v,i)=>i===controlIndex(kind,e.id)?value:v)};setAuxValues(auxRef.current);setAuxSources(old=>({...old,[`${kind}:${e.id}`]:'local'}))}
        parameters.publish(id,value,trace)
      }})
    }))
    return()=>{offs.forEach(off=>off())}
  },[parameters,instanceId,profile])
  useEffect(()=>{
    if(!parameters||!instanceId)return
    for(const kind of ['encoders','pushes','buttons'] as const)for(const e of profile[kind]){
      const id=`${instanceId}:${kind}:${e.id}`,value=kind==='encoders'?values[e.id]?.value:auxValues[kind][controlIndex(kind,e.id)]
      if(value===null||value===undefined||value<Math.min(e.minimum,e.maximum)||value>Math.max(e.minimum,e.maximum)||parameterLast.current.get(id)===value)continue
      parameterLast.current.set(id,value);parameters.publish(id,value)
    }
  },[parameters,instanceId,profile,values,auxValues])
  const [history]=useState(()=>createHistory())
  const historyKey=presetId||'draft'
  const config=JSON.stringify({profile,labels:customLabels,ringMode})
  const [historyVersion,setHistoryVersion]=useState(0)
  useEffect(()=>{history.record(historyKey,config,performance.now());setHistoryVersion(n=>n+1)},[history,historyKey,config])
  const historyCounts=useMemo(()=>history.counts(historyKey),[history,historyKey,historyVersion])
  const moveHistory=(action:'undo'|'redo')=>{if(lockedRef.current)return;const value=history[action](historyKey);if(value){recallState({...snapshot,...JSON.parse(value),values:emptyValues()});setHistoryVersion(n=>n+1)}}
  usePresetExchange(presetsExchange,{id:instanceId,moduleId:'bcr32-editor',stateVersion:2,name:'BCR32',isLocked:()=>lockedRef.current,capture:()=>({name:presetName,state:snapshot}),validate:parseControllerState,load:value=>recallState(parseControllerState(value))},signal)
  const selectMany=(list:Selection[])=>{
    if(!list.length)return
    const active=list[list.length-1]
    selectionsRef.current=list;setSelections(list);selectionAnchor.current=list[0];setSelection(active);arbiter.reset();setScreenControl(active);setTab('control')
  }
  const activePreset = presets.find(p => p.id === presetId)
  // sameState serializes the whole state several times: only when values/profile change, not on log/activity renders.
  const dirty = useMemo(() => activePreset ? !sameState(activePreset, snapshot) || presetName.trim() !== activePreset.name : true, [activePreset, snapshot, presetName])
  const selectedIndex = controlIndex(selection.kind, selection.id)
  const selectedRead = controllerRead.targets.find(s => { const target = controllerTargets[s.index]; return target.kind === selection.kind && target.id === selection.id })
  const unsupportedRead = selectedRead && controllerRead.status === 'complete' && !assignmentFromRead(selected, selectedRead)


  useEffect(()=>{if(!active)return;const handler=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true]'))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();moveHistory(event.shiftKey?'redo':'undo')}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler)},[active,locked,historyKey,snapshot])

  // Draft persistence is debounced; pendingDraft holds the snapshot not yet written.
  const pendingDraft = useRef<ControllerState | null>(null)
  const flushDraft = () => {
    const draft = pendingDraft.current
    if (!draft) return
    pendingDraft.current = null
    try { storage.setItem(draftStorageKey, JSON.stringify(draft)) }
    catch { setNotice('Local storage unavailable: export the preset JSON to keep your work.') }
  }
  useEffect(() => {
    pendingDraft.current = snapshot
    const timer = setTimeout(flushDraft, 250)
    return () => clearTimeout(timer)
  }, [snapshot])
  useEffect(() => {
    window.addEventListener('beforeunload', flushDraft); window.addEventListener('pagehide', flushDraft)
    return () => { window.removeEventListener('beforeunload', flushDraft); window.removeEventListener('pagehide', flushDraft); flushDraft() }
  }, [])
  useEffect(() => {
    try { storage.setItem(workspaceKey, JSON.stringify({ id: presetId, name: presetName })) } catch { /* Preset export remains available. */ }
  }, [presetId, presetName])
  useEffect(() => {
    try { storage.setItem(themeStorageKey, theme) } catch { /* Theme remains usable without local storage. */ }
  }, [theme])


  const stopEmission = () => { sender.current?.close(); sender.current = null; heldButton.current = null; setSendCC(false); assignmentWriter.current?.close(); assignmentWriter.current = null; setAssignmentLive(false) }
  const storeLibrary = (next: ControllerPreset[]) => {
    if(lockedRef.current)throw Error('Editor configuration locked')
    // Persist before updating state: a quota error must not pretend the save succeeded.
    storage.setItem(presetStorageKey, JSON.stringify(libraryFile(next)))
    setPresets(next)
  }
  const recallState = (state: ControllerState) => {
    if(lockedRef.current)return
    if (controllerRead.status === 'reading') cancelControllerRead()
    presetCache.current.clear(); cacheInitialized.current = false; setFromPresetCache(false)
    stopEmission(); disarmLearn()
    setSelections([selection]);selectionsRef.current=[selection]
    setAuxSources({}); setReceivedAux({})
    setProfile(state.profile); setCustomLabels(state.labels); setAuxValues(state.values); setRingMode(state.ringMode)
    setValues(Object.fromEntries(state.values.encoders.flatMap((v, i) => v === null ? [] : [[i + 1, { value: v, source: 'local' as const }]])))
  }
  const recallPreset = (id: string) => {
    const p = presets.find(p => p.id === id)
    if (!p) return
    if (dirty && !window.confirm(translate('Load this preset and replace the current draft? Unsaved changes will be replaced.', language))) return
    recallState(parseControllerState(p)); setPresetId(p.id); setPresetName(p.name)
    setNotice(`Preset “${p.name}” loaded locally. CC sending disabled; no hardware writes.`)
  }
  const savePreset = (asNew = false) => {
    try {
      if ((asNew || !activePreset) && presets.length >= 500) throw new Error('Library full (500 presets)')
      const p = makePreset(snapshot, presetName, !asNew && activePreset ? activePreset.id : undefined)
      storeLibrary([...presets.filter(e => e.id !== p.id), p])
      setPresetId(p.id); setPresetName(p.name)
      setNotice(`Preset “${p.name}” saved in this browser. Visual labels only.`)
    } catch (error) { setNotice(`Save failed: ${error instanceof Error ? error.message : String(error)}`) }
  }
  const importPresets = async (file: File | undefined) => {
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const incoming = raw.format === 'bcr32-preset-library' ? parseLibrary(raw) : [parsePreset(raw)]
      // Imported files never silently overwrite an existing preset or load hardware state.
      const imported = incoming.map(p => ({ ...p, id: crypto.randomUUID() }))
      if (presets.length + imported.length > 500) throw new Error('Limit of 500 presets')
      storeLibrary([...presets, ...imported])
      setNotice(`${imported.length} preset(s) imported into the library, without loading or MIDI sending.`)
    } catch (error) { setNotice(`Import rejected: ${error instanceof Error ? error.message : String(error)}`) }
  }
  const exportPreset = () => {
    try { const p = makePreset(snapshot, presetName); download(JSON.stringify(p, null, 2), `bcr32-${fileStem(p.name)}.json`) }
    catch { setNotice('Enter a preset name before exporting.') }
  }
  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      const p = makePreset(snapshot, presetName)
      if (!pdfFont) pdfFont = fetch('fonts/NotoSans-Regular.ttf').then(response => { if (!response.ok) throw new Error('PDF font unavailable'); return response.arrayBuffer() }).catch(error => { pdfFont = null; throw error })
      const { presetPdf } = await import('./preset-pdf')
      const bytes = await presetPdf(p, new Uint8Array((await pdfFont).slice(0)))
      download(bytes.buffer as ArrayBuffer, `bcr32-${fileStem(p.name)}-A4.pdf`, 'application/pdf')
      setNotice('A4 PDF downloaded: panel and current draft assignments. Reduced sheet, not a 1:1 template.')
    } catch (error) { setNotice(`PDF failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setPdfBusy(false) }
  }

  useEffect(() => {
    try { storage.setItem(storageKey, JSON.stringify(profile)) } catch { /* Draft persistence reports errors above. */ }
  }, [profile])

  useEffect(() => {
    if (!access) return
    access.onstatechange = () => {
      const pair = automaticPorts(access, inputId, outputId)
      if (!pair.input || !pair.output) probedPair.current = null
      setInputId(pair.input?.id ?? '')
      setOutputId(pair.output?.id ?? '')
      setPortVersion(n => n + 1)
      if (!isBcrOutput(access.outputs.get(outputId)) || pair.output?.id !== outputId) {
        sender.current?.close(); sender.current = null; setSendCC(false)
        if (!isBcrOutput(pair.output)) setNotice('BCR32 output unavailable: CC sending stopped, no pending values.')
      }
      if (pair.input && pair.output && !associatedOnce.current) {
        associatedOnce.current = true
        setProfile(current => associateDefaultEncoder(current, hasPresetRef.current))
      }
      if (pair.ambiguous) setNotice('Multiple BCR32 ports: choose a pair; no device is selected at random.')
    }
    return () => { access.onstatechange = null }
  }, [access, inputId, outputId])

  // Arm only a newly connected BCR output. This never enqueues preset values,
  // and does not undo a manual stop, preset recall or transport failure.
  useEffect(() => {
    if (!isBcrOutput(output)) { automaticEmissionPort.current = null; return }
    if (automaticEmissionPort.current === output) return
    automaticEmissionPort.current = output
    setSendCC(true)
  }, [access, output, portVersion])

  useEffect(() => {
    if (!sendCC || !isBcrOutput(output) || presetBusy || (controllerTracks && controllerRead.status !== 'complete')) return
    const transport = createCcSender(bytes => {
      if (!isBcrOutput(output)) throw new Error('BCR32 output disconnected')
      output.send!(bytes)
    }, bytes => { pulseActivity('send', activityPorts(bytes, 'send', indicatorRef.current)); setEvents(current => [{ hex: `→ ${asHex(bytes)}`, text: describeMessage(bytes), note: 'value sent' }, ...current].slice(0, 12)) }, error => {
      setSendCC(false)
      setNotice(`Sending stopped: ${error instanceof Error ? error.message : String(error)}`)
    })
    sender.current = transport
    return () => { transport.close(); if (sender.current === transport) sender.current = null }
  }, [sendCC, output, presetBusy, !!controllerTracks, controllerRead.status])

  useEffect(() => { setAuxSources({}); setReceivedAux({}) }, [inputId, inputs])
  const previousAssignments = useRef(profile)
  useEffect(() => {
    const before = previousAssignments.current
    previousAssignments.current = profile
    if (restoringCache.current) { restoringCache.current = false; return }
    setAuxSources(sources => retainControlSources(sources, before, profile))
    setReceivedAux(values => retainControlSources(values, before, profile))
  }, [profile])
  useEffect(() => {
    const input = inputs.find((port) => port.id === inputId && port.state === 'connected')
    if (!input) return
    // Decoder state (NRPN selector, 14-bit MSBs) survives edits that leave midiKey unchanged.
    const decode = createMidiDecoder(profileRef.current)
    // Do not combine an old input/profile MSB with a new source's LSB.
    setValues(current => Object.fromEntries(Object.entries(current).map(([id, v]) => [id, { value: v.value, source: v.source }])))
    input.onmidimessage = (event) => {
      const data = Array.from(event.data)
      // Clock (F8) and active sensing (FE) touch no React state: no activity pulse, no log line, no App render.
      if (data.length && !isSystemRealtime(data)) {
        setEvents((current) => [{ hex: asHex(data), text: describeMessage(data) }, ...current].slice(0, 12))
      }
      brightnessTransport.current?.receive(data)
      globalsReader.current?.receive(data)
      controllerReader.current?.receive(data)
      assignmentWriter.current?.receive(data)
      firmwareReceive.current(data)
      sequencerReceive.current(data)
      presetReceive.current(data)
      const dump = decodeControllerDump(data)
      // Up to 64 presets × 8 blocks are kept; the notice counts messages instead of announcing each block.
      if (dump) setDumps(list => { const next = [dump, ...list].slice(0, 600); setNotice(dump.checksumOk ? `Front-panel export received: ${next.length} messages.` : 'Front-panel export received with a checksum error.'); return next })
      // While Learn is armed the message feeds the learn parser first and the selection does not follow MIDI,
      // so the learned parameters land on the control the user chose, not on one that already matched the CC.
      const learned = learnReceive.current(data)
      const changes = decode(data)
      if (data.length && !isSystemRealtime(data)) pulseActivity('receive', activityPorts(data, 'receive', indicatorRef.current, changes))
      const current = profileRef.current
      const encoderChanges = changes.filter(c => c.control.kind === 'encoders'), auxChanges = changes.filter(c => c.control.kind !== 'encoders')
      // Clock, active sensing and unmatched CCs must not touch value state.
      if (encoderChanges.length) setValues(previous => {
        const next = { ...previous }
        for (const change of encoderChanges) {
          const e = current.encoders.find(e => e.id === change.control.id)!
          next[e.id] = applyChange(e, next[e.id], change)
        }
        liveRef.current = next
        return next
      })
      if (auxChanges.length) {
        // Update the reference synchronously: a following local toggle must see the latest MIDI value.
        const next = { ...auxRef.current, pushes: [...auxRef.current.pushes], buttons: [...auxRef.current.buttons] }
        for (const change of auxChanges) {
          const { kind, id } = change.control
          if (kind === 'encoders') continue
          const e = current[kind].find(e => e.id === id)!, i = controlIndex(kind, id)
          next[kind][i] = applyChange(e, { value: next[kind][i], source: 'midi' }, change).value
        }
        auxRef.current = next
        setAuxValues(next)
        const received={ ...receivedAuxRef.current, ...Object.fromEntries(auxChanges.filter(c => c.control.kind !== 'encoders').map(c => [selectionKey(c.control), next[c.control.kind as 'buttons' | 'pushes'][controlIndex(c.control.kind,c.control.id)]])) }
        receivedAuxRef.current=received;setReceivedAux(received)
        setAuxSources(previous => {
          const next = { ...previous }
          for (const change of auxChanges) next[`${change.control.kind}:${change.control.id}`] = 'midi'
          return next
        })
      }
      // controlForChanges still decides which control a message designates (the selected one among shared assignments, else the
      // unique match, else nothing: never a guess); the arbiter then decides what the screen shows and when the selection follows.
      const receivedControl = learned ? null : controlForChanges(selectionRef.current, changes)
      if (receivedControl) arbiter.push(receivedControl, performance.now())
      const firmware = parseFirmwareReply(data)
      // Same version again: keep the profile reference, no re-render cascade.
      if (firmware) {
        setLiveDeviceId(data[4])
        setLiveFirmware(firmware)
        setProfile(p => p.device.firmwareObserved === firmware ? p : { ...p, device: { ...p.device, firmwareObserved: firmware } })
      }
    }
    return () => { input.onmidimessage = null; arbiter.stop() }
  }, [inputId, inputs, midiKey])

  const setPreviewValue = (id: number, value: number) => {
    if(lockedRef.current)return
    if(presetBusy || (controllerTracks && controllerRead.status==='reading')){setNotice('Wait for the controller preset operation to complete');return}
    const encoder = profile.encoders.find(e => e.id === id)
    if (!encoder || !Number.isFinite(value)) return
    const next = Math.max(encoder.minimum, Math.min(encoder.maximum, Math.round(value)))
    const previous = liveRef.current[id]?.value ?? encoder.minimum
    if (next === previous && liveRef.current[id]?.value !== null && liveRef.current[id] !== undefined) return
    const messages = sendCC ? encoderMessages(encoder, next, previous) : null
    if (sendCC && isRelative(encoder) && !messages) { setNotice('Relative gesture not sent: compatible CC/NRPN required, up to 256 increments per gesture.'); return }
    arbiter.reset(); setScreenControl({ kind: 'encoders', id })
    if (values[id]?.value !== next) pulseActivity('local')
    liveRef.current = { ...liveRef.current, [id]: { value: next, source: isRelative(encoder) ? 'relative' : 'local' } }
    setValues(liveRef.current)
    if (!sendCC) return
    if (messages) { if (isRelative(encoder)) sender.current?.enqueueOrdered(messages); else sender.current?.enqueueMessages(messages) }
    else setNotice(transportIssue(encoder) ?? 'Preview only: unsupported mode.')
  }

  const setAuxValue = (control: Selection, value: number) => {
    if(lockedRef.current)return
    if(presetBusy || (controllerTracks && controllerRead.status==='reading')){setNotice('Wait for the controller preset operation to complete');return}
    if (control.kind === 'encoders') return
    if (control.kind === 'buttons' && control.id >= 74 && profile.settings?.footswitchModes[control.id-74] !== 'ctrl') return
    const e = profile[control.kind].find(e => e.id === control.id)!
    if (!Number.isFinite(value)) return
    const next = Math.max(e.minimum, Math.min(e.maximum, Math.round(value)))
    auxRef.current = { ...auxRef.current, [control.kind]: auxRef.current[control.kind].map((v, i) => i === controlIndex(control.kind, control.id) ? next : v) }
    setAuxValues(auxRef.current)
    setAuxSources(current => ({ ...current, [`${control.kind}:${control.id}`]: 'local' }))
    arbiter.reset(); setScreenControl(control); pulseActivity('local')
    if (sendCC) {
      const messages = encoderMessages({ ...e, mode: 'absolute' }, next)
      if (messages) sender.current?.enqueueOrdered(messages) // Press AND release must survive batching.
      else setNotice(transportIssue({ ...e, mode: 'absolute' }) ?? 'Button not sent.')
    }
  }
  const setScreenValue = (value: number) => screenControl.kind === 'encoders' ? setPreviewValue(screenControl.id, value) : setAuxValue(screenControl, value)
  const pressSelected = (pressed: boolean) => {
    if (selection.kind === 'encoders') return
    if (pressed) { if (heldButton.current) return; heldButton.current = { control: selection, config: selected } }
    const held = heldButton.current
    if (!held) return
    if (!pressed) heldButton.current = null
    if (held.control.kind === 'encoders') return
    const next = buttonValue(held.config, auxRef.current[held.control.kind][controlIndex(held.control.kind, held.control.id)], pressed)
    if (next !== null) setAuxValue(held.control, next)
  }

  const changeOutput = (id: string) => { sender.current?.close(); sender.current = null; setSendCC(false); setOutputId(id) }
  const toggleSend = () => {
    sender.current?.close(); sender.current = null
    const enabled = !sendCC && isBcrOutput(output)
    setSendCC(enabled)
    setNotice(enabled ? 'CC sending enabled: UI gestures send values to BCR32, not assignments.' : 'CC sending disabled: reception and local preview only.')
  }

  const connect = async () => {
    if (connecting.current) return
    connecting.current = true
    automaticEmissionPort.current = null
    sender.current?.close(); sender.current = null; setSendCC(false)
    try {
      const { access: midi, sysexError } = await requestAccess()
      setAccess(midi)
      const pair = automaticPorts(midi)
      setInputId(pair.input?.id ?? '')
      setOutputId(pair.output?.id ?? '')
      if (pair.input && pair.output && !associatedOnce.current) {
        associatedOnce.current = true
        setProfile(current => associateDefaultEncoder(current, hasPresetRef.current))
      }
      setNotice(sysexError ? 'MIDI connected; browser denied SysEx. Retry after granting permission.' : pair.ambiguous ? 'Multiple BCR32 devices: choose ports; no arbitrary pairing.' : pair.input && pair.output ? 'CC sending enabled: UI gestures send values to BCR32, not assignments.' : 'MIDI allowed; waiting for BCR32, automatic connection when plugged in.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'MIDI access denied.')
    }
    finally { connecting.current = false }
  }

  useEffect(() => {
    if (automaticStarted.current || !supportsWebMidi()) return
    automaticStarted.current = true
    void connect()
  }, [])

  useEffect(()=>{bindPair(inputId,outputId)},[inputId,outputId,bindPair])

  // A saved profile is not evidence of the currently connected firmware. Re-probe on port changes.
  useEffect(() => { presetCache.current.clear(); cacheInitialized.current = false; setFromPresetCache(false); controllerTracksRef.current = null; probedPair.current = null; setLiveFirmware(null); setLiveDeviceId(null); setBclSettings(null); setDeviceSettings(null); setDeviceSnapshot(null); setControllerTracks(null) }, [access, inputId, outputId, portVersion, probeRevision])
  // Declared after the receive effect: attach the listener before probing.
  useEffect(() => {
    const input = inputs.find(p => p.id === inputId && p.state === 'connected' && /BCR[- ]?32/i.test(p.name ?? ''))
    if (!access?.sysexEnabled || !input || !isControllerPort(input) || !isBcrOutput(output) || !isControllerPort(output)) { probedPair.current = null; return }
    if (probedPair.current?.access === access && probedPair.current.input === input && probedPair.current.output === output) return
    probedPair.current = { access, input, output }
    try {
      output.send!(productQuery)
      pulseActivity('send')
      setEvents(current => [{ hex: `→ ${asHex(productQuery)}`, text: 'automatic product/firmware probe (read-only)' }, ...current].slice(0, 12))
    } catch (error) { setNotice(`Automatic probe failed: ${error instanceof Error ? error.message : String(error)}`) }
  }, [access, inputId, inputs, output, portVersion, probeRevision])

  // Single validation path for the inspector and MIDI Learn: applySelectionChange, then clamp live values of the targets.
  const commitChange = (targets: Selection[], change: ControlChange) => {
    if(lockedRef.current)throw Error('Editor configuration locked')
    const keys=new Set(targets.map(selectionKey))
    const before=profileRef.current
    const next=applySelectionChange(before,targets,change)
    setProfile(next)
    if (assignmentWriter.current) {
      try {
        const jobs = []
        for (const target of targets) {
          const wireTarget=controllerTargets.find(t=>t.kind===target.kind&&t.id===target.id)
          const snapshot = controllerReadRef.current.targets.find(t => t.index === wireTarget?.index)
          if (!snapshot) throw Error('Read this controller target before writing its assignment')
          const old = before[target.kind].find(e => e.id === target.id)!, updated = next[target.kind].find(e => e.id === target.id)!
          for (const field of changedControllerFields(old, updated, snapshot)) jobs.push({ snapshot, field: field.field, value: field.value })
        }
        assignmentWriter.current.enqueueBatch(jobs)
      } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    }
    setValues(current=>Object.fromEntries(Object.entries(current).map(([id,old])=>{
      if(!keys.has(selectionKey({kind:'encoders',id:Number(id)})))return [id,old]
      const e=next.encoders.find(e=>e.id===Number(id))!
      return [id,{value:old.value===null?null:Math.max(e.minimum,Math.min(e.maximum,old.value)),source:'local' as const}]
    })))
    setAuxValues(current=>({...current,...Object.fromEntries((['pushes','buttons'] as const).map(kind=>[kind,current[kind].map((v,i)=>keys.has(selectionKey({kind,id:next[kind][i].id}))&&v!==null?Math.max(next[kind][i].minimum,Math.min(next[kind][i].maximum,v)):v)]))}))
  }
  const moveControls=(kind:MoveKind,from:number,to:number,mode:MoveMode)=>{
    if(lockedRef.current)return
    if(kind==='buttons'&&[from,to].some(id=>id>=21&&id<=24))return
    stopEmission();disarmLearn()
    const next=moveControl(profileRef.current,customLabels,bcr32,kind,from,to,mode)
    setProfile(parseProfile(next.profile));setCustomLabels(next.labels);setValues({});liveRef.current={};setAuxValues(emptyValues());auxRef.current=emptyValues()
    setReceivedAux({});receivedAuxRef.current={};setAuxSources({});selectUi({kind,id:to},{},true)
    setNotice('Assignments rearranged locally; sending disabled.')
  }
  const messageType=(row:MonitorRow):EncoderType|null=>({CC:'cc',NRPN:'nrpn',Note:'note',PB:'pb',AT:'at',PC:'pc'} as Record<string,EncoderType>)[row.kind]??null
  const monitorControl=(row:MonitorRow)=>{const type=messageType(row);if(!type||row.channel===null)return null;const hits=(['encoders','pushes','buttons'] as const).flatMap(kind=>profile[kind].filter(e=>e.type===type&&e.channel===row.channel&&(type==='pc'||type==='pb'||e.parameter===row.parameter)).map(e=>controlName({kind,id:e.id})));return hits.slice(0,3).join(', ')||null}
  const applyMessage=(row:MonitorRow)=>{if(lockedRef.current)return;const type=messageType(row);if(!type||row.channel===null)return;try{for(const target of selections)commitChange([target],{type,channel:row.channel,...(row.parameter===null?{}:{parameter:row.parameter}),...(type==='at'?{aftertouchAll:row.parameter===null}:{}),...(type==='nrpn'?{maximum:16383}:{})})}catch(e){setNotice(String(e))}}
  const updateSelected = (change: ControlChange) => {
    try { commitChange(selections,change) } catch(error){setNotice(error instanceof Error?error.message:String(error))}
  }

  // MIDI Learn is one-shot and single-target; assignment changes follow the explicit live-writing preference.
  const controlName = (s: Selection) => `${s.kind === 'encoders' ? 'Encoder' : s.kind === 'pushes' ? 'Push' : 'Button'} ${displayControlId(s.kind, s.id)}`
  const disarmLearn = () => {
    learnSession.current?.cancel(); learnSession.current = null
    learnArmed.current = false
    setLearn(current => current.active ? { active: false, status: '' } : current)
  }
  const cancelLearn = () => { disarmLearn(); setNotice('Learn cancelled: no assignment changed.') }
  const armLearn = () => {
    if(lockedRef.current)return
    if (selectionsRef.current.length > 1 || mouseMulti) { setMouseMulti(false); selectUi(selection, {}, true) }
    learnSession.current = createLearnSession((result, data) => finishLearn(result, asHex(data)), () => setLearn({ active: true, status: 'MSB received · waiting for a 14-bit LSB (60 ms)…' }))
    learnArmed.current = true
    setLearn({ active: true, status: 'Waiting for the physical control…' })
    setNotice(`Learn armed: move the physical control to assign to ${controlName(selection)}.`)
  }
  const toggleLearn = () => learnArmed.current ? cancelLearn() : armLearn()
  // The target is read at apply time: selecting another control on the panel while armed re-targets Learn.
  const finishLearn = (result: LearnResult, hex: string) => {
    const target = selectionRef.current, control = profileRef.current[target.kind].find(e => e.id === target.id)
    if (!control) return
    const change = applyLearn(control, target.kind, result)
    if ('error' in change) { setNotice(change.error); setLearn({ active: true, status: 'Waiting for the physical control…' }); return }
    try { commitChange([target], change) } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); return }
    const detail = `${controlName(target)} · ${describeApplied(result, target.kind)} · channel ${result.channel}`
    setEvents(current => [{ hex, text: `learned → ${detail}` }, ...current].slice(0, 12))
    setNotice(`Learned: ${detail}`)
    disarmLearn()
  }
  learnReceive.current = (data: number[]) => {
    if (!learnArmed.current) return false
    learnSession.current?.receive(data)
    return true
  }
  // Disarm when the input port changes or disconnects (and on unmount), and when leaving the Control tab.
  useEffect(() => () => disarmLearn(), [inputId])
  useEffect(() => { if (tab !== 'control') disarmLearn() }, [tab])

  // Receive listener is attached before automatic brightness read.
  useEffect(()=>{
    setBrightness(null)
    setBrightnessStatus('')
    if(!brightnessEnabled||!output||!liveFirmware||liveDeviceId===null){brightnessTransport.current=null;return}
    const transport=createBrightnessTransport(bytes=>{
      if(!isBcrOutput(output))throw Error('BCR32 output disconnected')
      output.send!(bytes);pulseActivity('send')
      setEvents(current=>[{hex:`→ ${asHex(bytes)}`,text:'LED brightness'},...current].slice(0,12))
    },state=>{setBrightness(state.value);setBrightnessDraft(state.draft);setBrightnessStatus(state.status)},80,2000,firmwareOne(liveFirmware) ? 0x52 : 0x40,liveDeviceId)
    brightnessTransport.current=transport;transport.read()
    return ()=>{transport.close();if(brightnessTransport.current===transport)brightnessTransport.current=null}
  },[access,inputId,output,brightnessEnabled,portVersion,liveFirmware,liveDeviceId])
  useEffect(()=>{if(tab==='device'&&brightness===null)brightnessTransport.current?.read()},[tab])
  useEffect(() => {
    if (!brightnessEnabled || !output?.send || !liveFirmware || liveDeviceId === null) { globalsReader.current = null; return }
    const port = output, reader = createGlobalsReader(bytes => port.send?.(bytes), 400, undefined, liveFirmware, liveDeviceId)
    globalsReader.current = reader
    if (autoLoadRef.current) void loadDeviceSettings(reader)
    return () => { reader.close(); if (globalsReader.current === reader) globalsReader.current = null }
  }, [access, inputId, output, brightnessEnabled, portVersion, liveFirmware, liveDeviceId])
  // Read the controller's settings and put them into the Config fields (the values stay editable; nothing is written).
  async function loadDeviceSettings(reader = globalsReader.current) {
    if (!reader) return
    setDeviceSettingsBusy(true)
    try {
      const rawResults = await reader.read()
      const verifiedRoute = bclSettingsRef.current?.outputRouting
      const results = rawResults.map(row => row.cmd === 0x30 && verifiedRoute ? { ...row, indexedValue: row.value, source: 'bcl' as const, value: controllerRoutes.indexOf(verifiedRoute), label: verifiedRoute } : row)
      if (lockedRef.current || globalsReader.current !== reader) return // port changed meanwhile: these results are stale
      setDeviceSettings(results)
      const fromDevice = { ...settingsFromDevice(results, liveFirmware), ...bclSettingsRef.current }
      if (!Object.keys(fromDevice).length) return
      setDeviceSnapshot({ at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), settings: fromDevice })
      setProfile(current => ({ ...current, settings: { ...(current.settings ?? defaultSettings()), ...fromDevice } }))
    } finally { setDeviceSettingsBusy(false); setGlobalsRevision(n => n + 1) }
  }
  function receiveGlobalBcl(text: string) {
    if(lockedRef.current)return
    const tracks=controllerTracksFromBcl(text),previous=controllerTracksRef.current
    if(tracks&&JSON.stringify(tracks)!==JSON.stringify(previous)) {
      controllerTracksRef.current=tracks;setControllerTracks(tracks)
      if(previous&&(tracks.selected!==previous.selected||tracks.presets[tracks.selected-1]!==previous.presets[previous.selected-1])) {
        const oldSlot = previous.presets[previous.selected - 1], slot = tracks.presets[tracks.selected - 1]
        if (presetCacheEnabledRef.current && cacheInitialized.current) {
          presetCache.current.set(oldSlot, structuredClone({ profile: profileRef.current, values: liveRef.current, aux: auxRef.current, received: receivedAuxRef.current, sources: auxSourcesRef.current, read: controllerReadRef.current }))
        }
        // Never restore a cancelled/incomplete read as a complete initialization.
        const cached = presetCacheEnabledRef.current ? presetCache.current.get(slot) : undefined
        cancelControllerRead()
        if (cached) {
          restoringCache.current = true
          const next = { ...cached.profile, settings: profileRef.current.settings }
          profileRef.current = next; setProfile(next)
          liveRef.current = cached.values; setValues(cached.values)
          auxRef.current = cached.aux; setAuxValues(cached.aux)
          receivedAuxRef.current = cached.received; setReceivedAux(cached.received); setAuxSources(cached.sources)
          setControllerRead({ ...cached.read, status: 'complete' }); cacheInitialized.current = true; setFromPresetCache(true)
          setNotice('Preset restored from UI cache; hardware changes are ignored until a manual read.')
        } else {
          cacheInitialized.current = false; setFromPresetCache(false)
          setReceivedAux({});receivedAuxRef.current={};setAuxSources({});setValues({});liveRef.current={}
          setAuxValues(emptyValues());auxRef.current=emptyValues()
          if(autoReadControllerRef.current)void readControllerAssignments()
          setNotice('Controller preset changed; reading its assignments')
        }
      }
    }
    const settings = routingFromBcl(text)
    if (!settings) return
    if(JSON.stringify(settings)===JSON.stringify(bclSettingsRef.current))return
    bclSettingsRef.current = settings; setBclSettings(settings)
    setProfile(current => ({ ...current, settings: { ...(current.settings ?? defaultSettings()), ...settings } }))
    setDeviceSnapshot(current => ({ at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), settings: { ...current?.settings, ...settings } }))
    setDeviceSettings(current => current?.map(row => row.cmd === 0x30 ? { ...row, indexedValue: row.indexedValue ?? row.value, source: 'bcl', value: controllerRoutes.indexOf(settings.outputRouting!), label: settings.outputRouting!, status: 'value' } : row) ?? null)
  }
  useEffect(() => { if (autoLoadDevice && globalsReader.current && !deviceSnapshot) void loadDeviceSettings() }, [autoLoadDevice])

  // Independent read session. Changing ports/firmware or disabling auto-read cancels pending work.
  useEffect(() => { presetCache.current.clear(); cacheInitialized.current = false; setFromPresetCache(false); setControllerRead(emptyControllerRead()) }, [access, inputId, output, portVersion, liveFirmware, liveDeviceId])
  useEffect(() => {
    setControllerRead(state => state.status === 'reading' ? { ...state, status: 'cancelled' } : state)
    if (!brightnessEnabled || !output?.send || !firmwareOne(liveFirmware) || liveDeviceId === null) return
    const port = output
    const reader = createControllerReader(bytes => {
      if (!isBcrOutput(port) || !isFirmwareRead(bytes)) throw Error('Controller read unavailable')
      port.send!(bytes)
    }, state => { if (controllerReader.current === reader) setControllerRead(state) },1200,15,liveDeviceId)
    controllerReader.current = reader
    if (autoReadControllerRef.current) void readControllerAssignments(reader)
    return () => { controllerReader.current?.close(); controllerReader.current = null; reader.close() }
  }, [access, inputId, output, brightnessEnabled, portVersion, liveFirmware, liveDeviceId, autoReadController])

  async function readControllerAssignments(reader = controllerReader.current) {
    if (!reader) return
    cacheInitialized.current = false; setFromPresetCache(false)
    const tracksAtStart = controllerTracksRef.current
    if (tracksAtStart) presetCache.current.delete(tracksAtStart.presets[tracksAtStart.selected - 1])
    assignmentWriter.current?.close(); assignmentWriter.current = null
    const baseline = profileRef.current
    // Preserve the original draft before automatic synchronization can replace local assignments.
    try {
      const key = 'bcr32-studio.before-controller-read.v1'
      const existing = storage.getItem(key)
      if (existing) parseProfile(JSON.parse(existing))
      else {
        const backup = JSON.stringify(baseline)
        storage.setItem(key, backup)
        if (storage.getItem(key) !== backup) throw Error('Backup verification failed')
      }
    } catch { setNotice('Controller read stopped: the local draft backup could not be saved.'); return }
    const result = await reader.read(readGroupsRef.current)
    if (controllerReader.current !== reader || result.status === 'cancelled') return
    if(lockedRef.current)return
    const merged = mergeControllerRead(profileRef.current, baseline, result.targets).profile
    profileRef.current = merged; setProfile(merged)
    cacheInitialized.current = result.status === 'complete' && result.total === controllerTargets.length * 8

  }

  function cancelControllerRead() {
    controllerReader.current?.close(); controllerReader.current = null
    setControllerRead(state => ({ ...state, status: 'cancelled' }))
    // Recreate a manual session without restarting automatic reading.
    if (!brightnessEnabled || !output?.send || !firmwareOne(liveFirmware) || liveDeviceId === null) return
    const port = output
    const reader = createControllerReader(bytes => {
      if (!isBcrOutput(port) || !isFirmwareRead(bytes)) throw Error('Controller read unavailable')
      port.send!(bytes)
    }, state => { if (controllerReader.current === reader) setControllerRead(state) },1200,15,liveDeviceId)
    controllerReader.current = reader
  }

  useEffect(() => {
    if (locked || presetBusy || !assignmentLive || !brightnessEnabled || !output?.send || liveFirmware !== '1.0.2' || liveDeviceId === null || liveDeviceId === 127 || controllerRead.status !== 'complete') return
    const port = output, device = liveDeviceId
    const writer = createAssignmentWriter(bytes => {
      if (!isBcrOutput(port) || !isControllerPort(port)) throw Error('Assignment output unavailable')
      const read = isFirmwareRead(bytes) && bytes[6] >= 49 && bytes[6] <= 56 && bytes[7] >= 50
      if (!read && !isEncoderAssignmentWrite(bytes, device)) throw Error('Assignment packet rejected')
      port.send!(bytes)
      pulseActivity('send')
      setEvents(current => [{ hex: `→ ${asHex(bytes)}`, text: read ? 'Encoder assignment read-back' : 'Encoder assignment write' }, ...current].slice(0, 12))
    }, device, state => { if (assignmentWriter.current === writer) setAssignmentWrite(state) }, value => {
      setControllerRead(current => ({ ...current, targets: current.targets.map(t => t.index === value.index ? { ...t, fields: { ...t.fields, [value.field]: value } } : t) }))
    })
    assignmentWriter.current = writer; setAssignmentWrite({ status: 'idle', queued: 0 })
    return () => { if (assignmentWriter.current === writer) assignmentWriter.current = null; writer.close() }
  }, [locked, assignmentLive, brightnessEnabled, output, liveFirmware, liveDeviceId, inputId, portVersion, controllerRead.status, presetBusy])
  // Apply one record of a front-panel export to the control it is known to describe (type, channel, parameter, range).
  function applyExportRecord(record: DumpRecord) {
    if(lockedRef.current)return
    const target = knownRecords[record.index]
    if (!target) return
    setProfile(current => ({ ...current, encoders: current.encoders.map(e => e.id === target.id ? applyRecord(e, record) : e) }))
    setNotice(`Encoder ${target.id} updated from the front-panel export.`)
  }
  // Write the editor's value of one setting to the BCR32, then show what the read-back says (src/device-globals.ts).
  async function writeDeviceSetting(cmd: number) {
    if(lockedRef.current)return
    const reader = globalsReader.current, value = valueOf(cmd, profileRef.current.settings ?? defaultSettings(), liveFirmware)
    if (!reader || value === null) return
    setWriteStatus(s => ({ ...s, [cmd]: 'busy' }))
    let result: { value: number | null; status: GlobalResult['status'] }
    try { result = await reader.write(cmd, value) } catch { result = { value: null, status: 'no reply' } }
    if (globalsReader.current !== reader) return
    const next = deviceSettingsRef.current?.map(r => r.cmd === cmd ? { ...r, value: result.value, status: result.status } : r) ?? null
    deviceSettingsRef.current = next; setDeviceSettings(next)
    if (next) setDeviceSnapshot(s => ({ at: s?.at ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), settings: settingsFromDevice(next, liveFirmware) }))
    setWriteStatus(s => ({ ...s, [cmd]: result.status !== 'value' ? 'no reply' : result.value === value ? 'ok' : 'mismatch' }))
  }

  // Cubase MIDI Remote script: surface + exact MIDI of each assigned control, no Cubase function mapped.
  const exportCubase = () => {
    const result = cubaseMidiRemoteScript(profile, customLabels, { studioVersion, date: new Date().toISOString().slice(0, 10) })
    download(result.source, result.fileName, 'text/javascript')
    setNotice(`Cubase script exported: ${result.bound.length} bindings; not bound: ${result.skipped.length}.`)
  }
  const exportProfile = () => {
    const file = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bcr32-controller-profile.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importProfile = async (file: File | undefined) => {
    if (!file) return
    try {
      const candidate = parseProfile(JSON.parse(await file.text()))
      if(lockedRef.current)return
      if (dirty && !window.confirm(translate('Importing this profile replaces the draft, its values and labels. Continue?', language))) return
      recallState({ profile: candidate, labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' })
      setPresetId(''); setPresetName('Imported profile')
      setNotice(`Profile imported: ${file.name}`)
    } catch {
      setNotice('Import rejected: incompatible v1/v2 profile or invalid values.')
    }
  }

  const routeValue = deviceSettings?.find(row => row.cmd === 0x30 && row.status === 'value')?.value
  const midiSource = deviceSettings?.find(row => row.cmd === 0x1e && row.status === 'value')?.value
  const indicatorsReady = brightnessEnabled && liveFirmware !== null && liveDeviceId !== null
  const indicators: IndicatorReadings = {
    outputRouting: indicatorsReady ? bclSettings?.outputRouting ?? (routeValue != null ? controllerRoutes[routeValue] ?? null : null) : null,
    routeSource: bclSettings?.outputRouting ? 'bcl' : 'indexed',
    midiInput: indicatorsReady && midiSource != null ? midiSource === 1 : null,
    feet: [0, 1].map(i => {
      const mode = bclSettings?.footswitchModes?.[i] ?? (deviceSettings?.find(row => row.cmd === 0x1b + i && row.status === 'value')?.value === 0 ? 'ctrl' : null)
      const config = profile.buttons.find(b => b.id === 74 + i)
      return indicatorsReady && mode === 'ctrl' && config && auxSources[`buttons:${74 + i}`] === 'midi' ? activeButtonValue(config, auxValues.buttons[controlIndex('buttons', 74 + i)]) : null
    }) as [boolean | null, boolean | null],
  }
  indicatorRef.current = indicators
  const screenValue = screenControl.kind === 'encoders' ? { value: values[screenControl.id]?.value ?? null, source: values[screenControl.id]?.source ?? 'local' } : { value: auxValues[screenControl.kind][controlIndex(screenControl.kind, screenControl.id)], source: auxSources[`${screenControl.kind}:${screenControl.id}`] ?? 'local' }
  const sharedScreens:EditorScreen[]=latestScreenList([{id:'bcr32-oled',label:'BCR32 OLED',...canvasSize,draw(ctx){
    const original=profile[screenControl.kind].find(e=>e.id===screenControl.id)!
    const config=original.type==='pc'&&screenControl.kind!=='encoders'?{...original,parameter:buttonValues(original)[0]}:original
    const text=screenText({...screenControl,id:displayControlId(screenControl.kind,screenControl.id)},config,screenValue.value,screenValue.source,controlLabel(screenControl.kind,screenControl.id,customLabels));drawScreens(ctx,text,displayStyle)
  }}])
  function latestScreenList(list:EditorScreen[]){latestScreen.current=list[0];return list}
  const assignmentAvailable = brightnessEnabled && liveFirmware === '1.0.2' && liveDeviceId !== null && liveDeviceId !== 127 && controllerRead.status === 'complete'
  return translatedTree(<main className="studio compact" data-theme={theme} data-tools-collapsed={toolsCollapsed||undefined} data-mode={editorMode} onKeyDown={event=>{if(event.key!=='Escape')return;if(displayOpen){setDisplayOpen(false);event.preventDefault()}else if(learn.active){cancelLearn();event.preventDefault()}else if(multiple||mouseMulti){setMouseMulti(false);selectUi(selection,{},true);event.preventDefault()}}}>
    <section className="workspace">
      <section className="surface" aria-label="BCR-32 encoders">
        <div className="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
          <div className="mock-seg editor-mode" role="group" aria-label="Editor view"><button aria-pressed={editorMode === 'controller'} onClick={() => setEditorMode('controller')}>Controller</button><button aria-pressed={editorMode === 'sequencer'} onClick={() => setEditorMode('sequencer')}>Sequencer</button></div>
          {editorMode === 'controller' && <>
          <span className="tb-sep" aria-hidden="true" />
          <div className="editor-history-tools" role="group" aria-label="History"><button aria-label="Undo" title="Undo" disabled={locked||!historyCounts.undo} onClick={()=>moveHistory('undo')}><span aria-hidden="true" data-i18n-skip>↶</span></button><button aria-label="Redo" title="Redo" disabled={locked||!historyCounts.redo} onClick={()=>moveHistory('redo')}><span aria-hidden="true" data-i18n-skip>↷</span></button></div>
          <span className="tb-sep" aria-hidden="true" />
          <button className={`cc-toggle tb-switch ${sendCC ? 'enabled' : ''}`} aria-pressed={sendCC} title="Send CC to BCR32" onClick={toggleSend} disabled={!isBcrOutput(output)}><span className="switch" aria-hidden="true" />CC → BCR32</button>
          <button className={`cc-toggle tb-switch assignment-toggle ${assignmentLive ? 'enabled' : ''}`} aria-pressed={assignmentLive} disabled={locked} title="Send assignment edits immediately" onClick={() => setAssignmentLive(on => !on)}><span className="switch" aria-hidden="true" />Assignments → BCR32</button>
          <span className="tb-sep" aria-hidden="true" />
          {floatingScreenSupported() && <button className="floating-toggle" aria-pressed={videoFloating} title="Borderless always-on-top screen, like a video player" onClick={() => { void toggleVideoFloating() }}><span aria-hidden="true" data-i18n-skip>▣ </span>{videoFloating ? 'Close floating display' : 'Floating display'}</button>}
          <div className="display-menu-anchor" ref={displayMenu}>
            <button className="display-menu-toggle" aria-haspopup="dialog" aria-expanded={displayOpen} onClick={()=>setDisplayOpen(open=>!open)}>Display<span aria-hidden="true" data-i18n-skip> ▾</span></button>
            <div className="display-menu" role="dialog" aria-label="Display" hidden={!displayOpen}><header className="display-menu-head"><strong>Display</strong><button className="midi-settings-close" aria-label="Close" title="Close" onClick={()=>setDisplayOpen(false)}><Icon name="close" /></button></header><fieldset className="host-lock-fields" disabled={locked}>
              <p className="mock-caption">Theme of this editor</p>
              <div className="theme-swatches" role="group" aria-label="Controller and interface theme">{themes.map(t => <button key={t.id} className={`theme-swatch swatch-${t.id}`} aria-label={`Theme ${t.name}`} aria-pressed={theme === t.id} title={t.name} onClick={() => setTheme(parseTheme(t.id))}><span className="sr-only">{t.name}</span><span className="swatch-tooltip" aria-hidden="true">{t.name}</span></button>)}</div>
              <label className="mock-field">Display style<select aria-label="Display style" value={displayStyle} onChange={event => setDisplayStyle(event.target.value as DisplayStyle)}>{displayStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="mock-check"><input type="checkbox" checked={autoZoom} onChange={event => setAutoZoom(event.target.checked)} />Zoom while adjusting</label>
              <label className="mock-check"><input type="checkbox" checked={showNumbers} onChange={event => setShowNumbers(event.target.checked)} />Show control numbers</label>
              <label className="mock-check"><input type="checkbox" checked={nameScreen} onChange={event => setNameScreen(event.target.checked)} />Label screen</label>
              <label className="mock-check"><input type="checkbox" checked={testMode} onChange={event => setTestMode(event.target.checked)} />Test mode</label>
              <label className="mock-check"><input type="checkbox" checked={inheritsPresentation} onChange={event => {if(event.target.checked)presentationStore.reset();else presentationStore.set({...presentationStore.getSnapshot()});setInheritTick(n=>n+1)}} />Use global presentation</label>
              {floatingSupported() && <button className="mock-link display-interactive-window" aria-pressed={!!pipWindow} title="Small always-on-top window with the screen, movable and resizable" onClick={() => { void toggleFloatingDisplay() }}>{pipWindow ? 'Close interactive window' : 'Interactive window (browser)'}</button>}
              <details className="adv"><summary>Screen and floating window</summary><PresentationTools preferences={presentation} screens={sharedScreens} inline zoom={false} floating={false}/></details>
            </fieldset></div>
          </div>
          <span className="tb-spacer" />
          </>}
          {editorMode === 'controller' && <button className="bcr32-tools-toggle" aria-label={toolsCollapsed?'Show editing tools':'Collapse editing tools'} aria-expanded={!toolsCollapsed} title={toolsCollapsed?'Show editing tools':'Collapse editing tools'} onClick={()=>setToolsCollapsed(on=>!on)}><span aria-hidden="true" data-i18n-skip>{toolsCollapsed?'◂':'▸'}</span></button>}
        </div>
        {editorMode === 'sequencer' ? <SequencerView access={access} controllerInputId={inputId} receive={sequencerReceive} download={download} locked={locked} /> : <FrontPanel move={locked?undefined:moveControls} trackFeedback={{tracks:controllerTracks}} onTrackSelect={track=>{if(lockedRef.current||tab==='files'||!trackSelect.current||controllerTracks?.selected===track||presetBusy||['pending','writing'].includes(assignmentWrite.status))return;cancelControllerRead();trackSelect.current(track)}} buttonFeedback={receivedAux} indicators={indicators} auxValues={auxValues} auxSources={auxSources} brightness={brightness} selectMany={selectMany} mouseMulti={mouseMulti} autoZoom={autoZoom} showNumbers={showNumbers} nameScreen={nameScreen} displayStyle={displayStyle} profile={profile} screenControl={screenControl} screenValue={screenValue} setScreenValue={setScreenValue} activity={activity} customLabels={customLabels} rename={(control, name) => {if(lockedRef.current)return;setCustomLabels(current => ({ ...current, [control.kind]: current[control.kind].map((label, i) => i === controlIndex(control.kind, control.id) ? name : label) }))}} selection={selection} selections={selections} select={selectUi} action={setNotice} values={values} setValue={setPreviewValue} ringMode={ringMode} compact />}
      </section>

      <aside className="sidebar" aria-label="Editing and MIDI tools">
        {pipWindow && createPortal(<FloatingDisplay theme={theme} displayStyle={displayStyle} control={screenControl} config={profile[screenControl.kind].find(e => e.id === screenControl.id)!} label={controlLabel(screenControl.kind, screenControl.id, customLabels)} value={screenValue.value} source={screenValue.source} inspect={() => selectUi(screenControl, {}, true)} setValue={setScreenValue} />, pipWindow.document.body)}
        <nav className="tool-tabs" aria-label="Editor tools">{(['control', 'presets', 'device', 'files', 'log'] as const).map((item, i) => <button key={item} aria-pressed={view === item} title={['Control', 'Presets', 'Device', 'Files', 'Log'][i]} onClick={() => {setTab(item);setHelpOpen(false)}}>{['Control', 'Presets', 'Device', 'Files', 'Log'][i]}</button>)}</nav>
        {!access?.sysexEnabled && <p className="mock-warn sidebar-midi-warning">{access ? 'SysEx not granted' : 'automatic connection'} <button className="mock-link" onClick={() => connect()} disabled={!supportsWebMidi()}>Retry MIDI + SysEx</button> <button className="mock-link" aria-haspopup="dialog" onClick={()=>setMidiSettingsOpen(true)}>MIDI connection…</button></p>}
        <div className="sidebar-content"><fieldset className="host-lock-fields" disabled={locked}>
        <section className="profile-actions preset-panel" hidden={view !== 'presets'} aria-label="Preset management">
          <h2 className="sr-only">Presets{dirty ? ' *' : ''}</h2>
          <div className="preset-location-tabs" role="group" aria-label="Preset location">
            <button aria-pressed={presetLocation==='hardware'} onClick={()=>setPresetLocation('hardware')}><Icon name="midi"/>BCR32</button>
            <button aria-pressed={presetLocation==='browser'} onClick={()=>setPresetLocation('browser')}><Icon name="folder"/>On this computer</button>
          </div>
          <div className="hardware-presets" hidden={presetLocation!=='hardware'}>
          <ControllerReadPanel cacheEnabled={presetCacheEnabled} setCacheEnabled={setPresetCacheEnabled} fromCache={fromPresetCache} groups={readGroups} setGroups={setReadGroups} canRead={brightnessEnabled && firmwareOne(liveFirmware)} state={controllerRead} read={() => { void readControllerAssignments() }} cancel={cancelControllerRead} />
          <ControllerPresets storage={storage} authorizeTransfer={authorizeTransfer} onStored={slot => presetCache.current.delete(slot)} trackSelect={trackSelect} tracks={controllerTracks} watchAvailable={!locked && brightnessEnabled && !deviceSettingsBusy && liveFirmware === '1.0.2' && !['pending','writing'].includes(assignmentWrite.status) && tab !== 'files'} autoGlobals={autoLoadDevice && tab !== 'files'} globalsRevision={globalsRevision} onGlobals={receiveGlobalBcl} sendWrite={bytes => {
            if (lockedRef.current || !presetStorageValidated || !brightnessEnabled || !output?.send || liveFirmware !== '1.0.2' || liveDeviceId === null || !isBclWrite(bytes, liveDeviceId)) throw Error('Preset write unavailable')
            output.send(bytes)
          }} onBusy={setPresetBusy} active={tab === 'presets' && presetLocation === 'hardware'} available={!locked && brightnessEnabled && !deviceSettingsBusy && liveFirmware === '1.0.2' && controllerRead.status !== 'reading' && !['pending','writing'].includes(assignmentWrite.status)} connectionKey={`${inputId}:${outputId}:${portVersion}:${!!access}:${liveFirmware}`} device={liveDeviceId} receive={presetReceive} send={bytes => {
            if (!brightnessEnabled || !output?.send || liveFirmware !== '1.0.2' || !(isFirmwareRead(bytes) || isControllerPageRequest(bytes))) throw Error('Preset read unavailable')
            output.send(bytes)
          }} download={download} />
          </div>
          <div className="browser-presets" hidden={presetLocation!=='browser'}>
          <div className="preset-local-toolbar mock-actions" hidden={localSaveOpen}>
            <button className="primary" onClick={()=>setLocalSaveOpen(true)}>Save</button>
            <button disabled={!presets.length} onClick={()=>download(JSON.stringify(libraryFile(presets),null,2),'bcr32-browser-presets.json','application/json')}>Export</button>
            <label className="file" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}>Import<input type="file" accept="application/json,.json" onChange={event => { void importPresets(event.target.files?.[0]); event.target.value = '' }} /></label>
          </div>
          <div hidden={localSaveOpen}>
          <LibraryList presets={presets} activeId={presetId} recall={recallPreset} reorder={next => { try { storeLibrary(next); setNotice('Library order saved on this computer.') } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) } }} disabled={locked} /><p className="surface-help">These copies are stored in this browser, separately from the BCR32.</p>
          </div>
          <div className="preset-save-sheet" hidden={!localSaveOpen}>
          <button className="preset-back" onClick={()=>setLocalSaveOpen(false)}><Icon name="close"/>Back to presets</button>
          <h3>Save on this computer</h3>
          <label>Preset name<input maxLength={80} value={presetName} onChange={event => setPresetName(event.target.value.replace(/[\u0000-\u001f\u007f]/g, ' '))} /></label>
          <div className="preset-actions"><button className="primary" onClick={() => {savePreset();setLocalSaveOpen(false)}} disabled={!presetName.trim()}><Icon name="save" />{activePreset ? 'Save / rename' : 'Create preset'}</button><button onClick={() => {savePreset(true);setLocalSaveOpen(false)}} disabled={!presetName.trim()}><Icon name="copy" />Save as new</button></div>
          </div></div>
        </section>
        <section className="profile-actions device-panel" hidden={view !== 'device'} aria-label="Device">
          <h2 className="sr-only">Device</h2>
          <DeviceSettings firmware={liveFirmware} results={deviceSettings} settings={profile.settings ?? defaultSettings()} change={(cmd, value) => setProfile(current => ({ ...current, settings: withValue(cmd, value, current.settings ?? defaultSettings(), liveFirmware) }))} update={change=>setProfile(current=>({...current,settings:{...(current.settings??defaultSettings()),...change}}))} autoLoad={autoLoadDevice} canRead={brightnessEnabled} busy={deviceSettingsBusy} write={cmd => { void writeDeviceSetting(cmd) }} writeStatus={writeStatus} read={() => { void loadDeviceSettings() }} reset={() => { setDeviceSnapshot(null); setProfile(current => ({ ...current, settings: defaultSettings() })) }} readAt={deviceSnapshot?.at ?? null} brightness={brightness} draft={brightnessDraft} setDraft={n=>brightnessTransport.current?.set(n)} brightnessEnabled={brightnessEnabled && !firmwareOne(liveFirmware)} brightnessStatus={brightnessStatus} editFootswitch={i=>{selectUi({kind:'buttons',id:profile.buttons[buttonNames.indexOf(`FOOTSW ${i+1}`)].id},{},true);setTab('control')}} />
        </section>
        <section className="profile-actions preset-panel" hidden={view !== 'files'} aria-label="Imports and exports">
          <h2 className="sr-only">Files</h2>
          <section className="mock-card" aria-label="Export"><b>Export</b><div className="mock-actions"><button onClick={exportPreset} disabled={!presetName.trim()}>Draft (JSON)</button><button onClick={() => download(JSON.stringify(libraryFile(presets), null, 2), 'bcr32-presets.json')} disabled={!presets.length}>Library (JSON)</button><button onClick={exportPdf} disabled={pdfBusy || !presetName.trim()}>{pdfBusy ? 'Preparing PDF…' : 'PDF'}</button><button onClick={exportCubase} title="Surface script for Cubase 12 and later: encoders, pushes and buttons with their exact MIDI messages. No function is assigned: map them in Cubase with the Mapping Assistant.">Cubase</button></div></section>
          <section className="mock-card" aria-label="Import"><b>Import</b><div className="mock-actions"><label className="file" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}>Open a file…<input type="file" accept="application/json,.json" onChange={event => { void importPresets(event.target.files?.[0]); event.target.value = '' }} /></label></div></section>
          <section className="mock-card files-front-panel">
          <ExportImport dumps={dumps} apply={applyExportRecord} save={dump => download(new Uint8Array(dump.raw), `bcr32-export-block${dump.block}.syx`, 'application/octet-stream')} saveAll={list => download(new Uint8Array([...list].reverse().flatMap(d => d.raw)), `bcr32-exports-${list.length}.syx`, 'application/octet-stream')} />
          </section>
          <details className="files-advanced adv"><summary>Advanced</summary>
          <FirmwareTools firmware={liveFirmware} replyDevice={liveDeviceId ?? 127} connectionKey={`${inputId}:${outputId}:${portVersion}:${!!access}:${liveFirmware}`} canRead={!presetBusy && brightnessEnabled && !!output?.send && firmwareOne(liveFirmware) && controllerRead.status !== 'reading' && !['pending','writing'].includes(assignmentWrite.status)} receive={firmwareReceive} sendRead={bytes => {
            if (!brightnessEnabled || !output?.send || !firmwareOne(liveFirmware) || !isFirmwareRead(bytes)) throw Error('Firmware read unavailable')
            output.send(bytes)
          }} download={download} flat />
          <ParameterTable entries={parameterNames} save={saveParameterNames} download={download} flat />
          <section className="legacy-profile"><h4>Legacy profile format</h4><div className="preset-actions"><button onClick={exportProfile}><Icon name="export" />Export profile v2</button><label className="file">Import profile v1/v2<input type="file" accept="application/json" onChange={event => { void importProfile(event.target.files?.[0]); event.target.value = '' }} /></label></div></section>
          </details>
        </section>
      <section className="inspector mock-inspector" hidden={view !== 'control'} aria-label={`Edit ${selection.kind} ${displayControlId(selection.kind, selected.id)}`}>
        <ControlSearch profile={profile} labels={customLabels} selection={selection} select={s=>selectUi(s,{},true)} />
        <p className="mock-caption mock-kind">{selection.kind === 'buttons' ? 'Button' : selection.kind === 'pushes' ? 'Push' : 'Encoder'} <span data-i18n-skip>{displayControlId(selection.kind, selected.id)}</span></p>
        <h2 className="mock-title" data-i18n-skip>{controlLabel(selection.kind, selected.id, customLabels)}</h2>
        {selection.kind !== 'buttons' && <div className="mock-seg" role="group" aria-label="Action"><button aria-pressed={selection.kind === 'encoders'} onClick={() => selectUi({ ...selection, kind: 'encoders' },{},true)}>Rotation</button><button aria-pressed={selection.kind === 'pushes'} onClick={() => selectUi({ ...selection, kind: 'pushes' },{},true)}>Push</button></div>}
        <p className="selection-tools mock-selection"><span title={mouseMulti?'Click: add / remove':'Cmd/Ctrl + click · Shift + click'}>Selection · <span data-i18n-skip>{selections.length}</span></span> · <button className="mock-link" aria-pressed={mouseMulti} onClick={()=>setMouseMulti(current=>!current)}>Multi</button> · <button className="mock-link" onClick={()=>{const list=profile[selection.kind].map(e=>({kind:selection.kind,id:e.id}));setSelections(list);selectionsRef.current=list}}>All</button>{(multiple||mouseMulti)&&<> · <button className="mock-link" onClick={()=>{setMouseMulti(false);selectUi(selection,{},true)}}>Single</button></>} · <button className="mock-link learn-toggle" aria-pressed={learn.active} onClick={toggleLearn}>Learn</button></p>
        {learn.active&&<p className="surface-help learn-status" role="status">Learn · {learn.status}</p>}
        {mouseMulti&&<p className="surface-help">Drag on the background: rectangle selection.</p>}
        {activeControls.length>0&&<ol className="activity-strip" aria-label="Active controls">{activeControls.slice(0,4).map(a=>{const value=a.control.kind==='encoders'?values[a.control.id]?.value:auxValues[a.control.kind][controlIndex(a.control.kind,a.control.id)];const source=a.control.kind==='encoders'?values[a.control.id]?.source:auxSources[`${a.control.kind}:${a.control.id}`];const percent=Math.round(a.share*100);return <li key={selectionKey(a.control)}><button aria-pressed={selectionKey(a.control)===selectionKey(selection)} onClick={()=>selectUi(a.control,{},true)}><span>{controlName(a.control)}</span><output>{value??'—'}</output><small>{source==='relative'?'relative estimate':source==='midi'?'MIDI received':'local preview'}</small><span className="activity-share" title={`${percent}% of pulses`}><span style={{width:`${percent}%`}} /></span></button></li>})}</ol>}
        {unsupportedRead && <p role="alert">Controller assignment cannot be represented. The fields below remain the local draft; inspect the raw replies.</p>}
        <h3 className="mock-h3">MIDI message</h3>
        <div className="fields two"><label>Type<select value={batchType} onChange={(event) => updateSelected({ type: event.target.value as EncoderType })}>
          {batchType===''&&<option value="" disabled>Mixed</option>}{Array.from(new Set([...(multiple?[]:[selected.type]),...commonTypes])).map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
        </select></label>
        <label>Mode<select disabled={!commonModes.length} value={batchMode} onChange={(event) => updateSelected({ mode: event.target.value as EncoderMode })}>
          {batchMode===''&&<option value="" disabled>Mixed</option>}{Array.from(new Set([...(multiple?[]:[selected.mode]), ...commonModes])).map((mode) => <option key={mode} value={mode}>{selection.kind !== 'encoders' && mode === 'inc_dec' ? 'Inc' : modeText[mode]}</option>)}
        </select></label></div>
        {selected.type !== 'mmc' && <div className="fields two"><label>Channel<input type="number" min="1" max="16" value={selected.channel} onChange={(event) => updateSelected({ channel: Number(event.target.value) })} /></label>
          <label>{selected.type === 'pc' ? 'Bank number' : selected.type === 'note' ? 'Note number' : 'CC / Parameter'}<input disabled={multiple || selected.type === 'pc' && !!selected.bankOff} title={multiple?'Parameter: individual editing only':undefined} type="number" min="0" max={selection.kind === 'encoders' ? parameterLimit(selected) : 127} value={selected.parameter} onClick={() => setParameterOpen(n => n + 1)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setParameterOpen(n => n + 1) } }} onChange={(event) => { if (event.target.value !== '') updateSelected({ parameter: Number(event.target.value) }) }} /></label></div>}
        {selected.type !== 'mmc' && !multiple && !(selected.type === 'pc' && selected.bankOff) && <ParameterPicker config={selected} entries={parameterNames} save={saveParameterNames} choose={parameter => updateSelected({ parameter })} openSignal={parameterOpen} />}
        {selected.type === 'mmc' && (()=>{const m=selected.mmc??{deviceId:'all' as const,command:'Play' as const,locate:[0,0,0,0],frameRate:'off' as const};const update=(change:Partial<typeof m>)=>updateSelected({mmc:change});return <div className="mmc-config" data-i18n-skip>
          <label>MMC Device ID<select value={m.deviceId} onChange={e=>update({deviceId:e.target.value==='all'?'all':Number(e.target.value)})}><option value="all">All</option>{Array.from({length:127},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label>
          <label>MMC command<select disabled={multiple} value={m.command} onChange={e=>update({command:e.target.value as typeof m.command})}>{mmcCommands.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Frame rate<select value={m.frameRate} onChange={e=>update({frameRate:e.target.value as typeof m.frameRate})}>{['off','24','25','30','30d'].map(v=><option key={v}>{v}</option>)}</select></label>
          {[0,1].map(i=><label className="zoom-option" key={i}><input type="checkbox" checked={m.locateOff?.[i]??false} onChange={e=>update({locateOff:[0,1].map(j=>j===i?e.target.checked:m.locateOff?.[j]??false)})} />{i===0?'HH:MM':'SS:FF'} Off</label>)}
          <div className="fields two">{['HH','MM','SS','FF'].map((v,i)=><label key={v}>{v}<input disabled={m.locateOff?.[Math.floor(i/2)]??false} type="number" min="0" max="127" value={m.locate[i]} onChange={e=>update({locate:m.locate.map((n,j)=>j===i?Math.max(0,Math.min(127,Math.round(Number(e.target.value)||0))):n)})} /></label>)}</div>
        </div>})()}
        {selected.type !== 'mmc' && (selection.kind === 'encoders' ? <div className="fields two"><label>Minimum<input type="number" min="0" max={valueLimit(selected)} value={selected.minimum} onChange={(event) => updateSelected({ minimum: Number(event.target.value) })} /></label>
          <label>{selected.type === 'note' ? 'Velocity' : selected.type === 'pc' ? 'Program maximum' : 'Maximum'}<input type="number" min="0" max={valueLimit(selected)} value={selected.maximum} onChange={(event) => updateSelected({ maximum: Number(event.target.value) })} /></label></div> : <div className="fields two">{[0, 1].map(index => <label key={index}>{index === 0 ? 'Value 1' : 'Value 2'}<input type="number" min="0" max={valueLimit(selected)} value={buttonValues(selected)[index]} onChange={event => { if (event.target.value !== '') { const pair = [...buttonValues(selected)] as [number, number]; pair[index] = Number(event.target.value); updateSelected({ buttonValues: pair }) } }} /></label>)}</div>)}
        {selected.type !== 'off' && transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' }) && <p className="surface-help" role="status">{transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' })}</p>}
        <h3 className="mock-h3">Display</h3>
        <label>Label<input maxLength={48} placeholder={multiple?'Mixed / batch label':'Default printed name'} value={sharedField(selections.map(s=>customLabels[s.kind][controlIndex(s.kind,s.id)]))} onChange={event => setCustomLabels(current => ({ ...current,...Object.fromEntries((['encoders','pushes','buttons'] as const).map(kind=>[kind,current[kind].map((label,i)=>selectedKeys.has(selectionKey({kind,id:profile[kind][i].id}))?cleanLabel(event.target.value):label)])) }))} /></label>
        <div className="fields two mock-display-row"><label className="zoom-option" data-i18n-skip><input type="checkbox" checked={selected.display !== false} onChange={e=>updateSelected({display:e.target.checked})} />Display</label>{!!selectedRotations.length && <label>LED ring<select value={batchLed} onChange={event=>updateSelected({ledMode:event.target.value as LedMode})}>{batchLed===''&&<option value="" disabled>Mixed</option>}{ledModes.map(mode=><option data-i18n-skip key={mode} value={mode}>{ledModeLabel[mode]}</option>)}</select></label>}</div>
        {testMode && <>
        <h3 className="mock-h3">Test</h3>
        {selection.kind === 'encoders' && <section className="value-preview">
          <label>Value · {values[selected.id]?.source === 'relative' ? 'relative estimate' : values[selected.id]?.source === 'midi' ? 'MIDI received' : sendCC ? 'UI adjustment' : 'local preview'}<output>{values[selected.id]?.value ?? '—'}</output>
            <input aria-label="Encoder value" type="range" min={selected.minimum} max={selected.maximum} value={values[selected.id]?.value ?? selected.minimum} onChange={event => setPreviewValue(selected.id, Number(event.target.value))} /></label>
          {isRelative(selected) && <div className="action-tabs"><button onClick={() => setPreviewValue(selected.id, (values[selected.id]?.value ?? selected.minimum) - 1)}>−1</button><button onClick={() => setPreviewValue(selected.id, (values[selected.id]?.value ?? selected.minimum) + 1)}>+1</button></div>}
        </section>}
        {selection.kind !== 'encoders' && <section className="value-preview"><label>Value · {auxSources[`${selection.kind}:${selection.id}`] === 'midi' ? 'MIDI received' : sendCC ? 'UI adjustment' : 'local preview'}<output>{auxValues[selection.kind][selectedIndex] ?? '—'}</output><input aria-label="Local button or push value" type="range" min={selected.minimum} max={selected.maximum} value={auxValues[selection.kind][selectedIndex] ?? selected.minimum} onChange={event => setAuxValue(selection, Number(event.target.value))} /></label>
          <button onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); pressSelected(true) }} onPointerUp={() => pressSelected(false)} onPointerCancel={() => pressSelected(false)}
            onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) pressSelected(true) } }} onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); pressSelected(false) } }}
            onBlur={() => { if (selected.mode === 'momentary') pressSelected(false) }}><Icon name="push" />Test press / release</button>
        </section>}
        <p className="mock-caption">{sendCC ? 'CC values sent · assignments unchanged.' : 'Receive / local preview · CC sending disabled.'}</p>
        </>}
        <details className="adv"><summary>Advanced</summary>
        {selected.type === 'pc' && <label className="zoom-option"><input type="checkbox" disabled={multiple} checked={!!selected.bankOff} onChange={e=>updateSelected({bankOff:e.target.checked})} />Bank Off</label>}
        {selected.type === 'at' && selection.kind !== 'encoders' && <label className="zoom-option" data-i18n-skip><input disabled={multiple} type="checkbox" checked={!!selected.aftertouchAll} onChange={e=>updateSelected({aftertouchAll:e.target.checked})} />Aftertouch: All</label>}
        {selected.type === 'cc' && selection.kind === 'encoders' && <label className="zoom-option" data-i18n-skip><input disabled={multiple} type="checkbox" checked={!!selected.parameterOff} onChange={e=>updateSelected({parameterOff:e.target.checked})} />Parameter Off</label>}
        {selected.type === 'pc' && selection.kind === 'encoders' && <label className="zoom-option" data-i18n-skip><input type="checkbox" checked={!!selected.minimumOff} onChange={e=>updateSelected({minimumOff:e.target.checked})} />Minimum Off</label>}
        {selection.kind !== 'encoders' && selected.mode === 'inc_dec' && <label>Step per press<input type="number" min="-127" max="127" value={selected.increment ?? 1} onChange={event => updateSelected({ increment: Number(event.target.value) })} /></label>}
        {is14Bit(selected) && <p className="surface-help">{modeText[selected.mode]} · 14 bits · {selected.type === 'nrpn' ? 'Data Entry CC 6 + 38' : `CC ${selected.parameter} + ${selected.parameter + 32}`}.</p>}
          {selection.kind === 'encoders' && <p className="surface-help">{isRelative(selected) ? 'Relative: local reference, not hardware position. Up to 256 increments per sent gesture.' : 'Receive: matching channel and CC/NRPN parameter.'} Sending only when enabled; no configuration writes.</p>}
          {selection.kind !== 'encoders' && <p className="surface-help">{selected.mode === 'momentary' ? 'Tog Off: Value 1 on press, Value 2 on release.' : selected.mode === 'toggle' ? 'Tog On: alternate Value 1 and Value 2 on each press.' : 'Inc: add the step on each press, clamped to the range.'} Clicking the panel only selects a control.</p>}
        <ControllerReadValues snapshot={selectedRead} />
        </details>
      </section>

    <section className="lower">
      {helpOpen&&<section className="help-view"><button className="help-back" onClick={()=>setHelpOpen(false)}>← Back</button><Bcr32Help/><p className="muted studio-version" data-i18n-skip>Studio v{studioVersion}</p></section>}
      <section className="log" hidden={view !== 'log'}><MidiMonitor monitor={monitor} control={monitorControl} canApply={!locked} apply={applyMessage}/><p className="eyebrow">MIDI LOG</p><h2>Recent messages</h2><ol>{events.length ? events.map((event, index) => <li key={`${event.hex}-${index}`}>{event.hex} · {event.text}{event.note && <span> · {event.note}</span>}</li>) : <li>No messages received.</li>}</ol></section>
    </section>
        </fieldset></div>
        <footer className="sidebar-meta sidebar-statusbar"><p className="sidebar-summary" title={notice}><span aria-hidden="true">ⓘ </span>{assignmentLive && assignmentAvailable && assignmentWrite.status !== 'idle' ? <AssignmentWriteStatus inline enabled available state={assignmentWrite} /> : <span>{!assignmentLive ? 'Local assignments' : assignmentAvailable ? 'Live assignments' : 'Live assignments after a full read'}</span>} · <span>{fromPresetCache ? 'Preset restored from UI cache' : controllerRead.total > 0 ? `Assignment read ${controllerRead.received}/${controllerRead.total}` : 'Not read'}</span> · <span>{sendCC ? 'CC → BCR32 on' : 'CC → BCR32 off'}</span></p><p className="sidebar-notice" role="status" title={notice} hidden={notice === initialNotice}>{notice}</p></footer>
      </aside>
    </section>
    <dialog ref={midiSettingsDialog} className="midi-settings-dialog" aria-labelledby={`${instanceId}-midi-settings-title`} onClose={()=>setMidiSettingsOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setMidiSettingsOpen(false)}}>
      <header><h2 id={`${instanceId}-midi-settings-title`}>MIDI connection</h2><button className="midi-settings-close" aria-label="Close" title="Close" onClick={()=>setMidiSettingsOpen(false)}><Icon name="close" /></button></header>
      <p className="midi-settings-status" role="status"><span className={access ? 'status live' : 'status'}>{access ? 'MIDI ready' : 'automatic connection'}</span><span aria-hidden="true">·</span><span>{access?.sysexEnabled ? 'SysEx allowed' : 'SysEx not granted'}</span><span aria-hidden="true">·</span><FirmwareIdentity firmware={liveFirmware} previous={profile.device.firmwareObserved} canProbe={brightnessEnabled} probe={() => setProbeRevision(n => n + 1)} /></p>
      <button className="primary" onClick={() => connect()} disabled={!supportsWebMidi()}>{access?.sysexEnabled ? 'Search again for the BCR32' : 'Retry MIDI + SysEx'}</button>
      {!supportsWebMidi()&&<p className="muted">Web MIDI is unavailable in this browser.</p>}
      <div className="fields ports-fields"><label>Input<select value={inputId} onChange={(event) => setInputId(event.target.value)}><option value="">Choose…</option>{inputs.map((port) => <option key={port.id} value={port.id}>{port.name ?? port.id}</option>)}</select></label>
        <label>Output<select value={outputId} onChange={(event) => changeOutput(event.target.value)}><option value="">Choose…</option>{outputs.map((port) => <option key={port.id} value={port.id}>{port.name ?? port.id}</option>)}</select></label>
      </div>
      <fieldset className="midi-settings-at-connection" disabled={locked}><legend>At connection:</legend>
        <label className="mock-check"><input type="checkbox" checked={autoReadController} onChange={e => setAutoReadController(e.target.checked)} />read the assignments</label>
        <label className="mock-check"><input type="checkbox" checked={autoLoadDevice} onChange={e => setAutoLoadDevice(e.target.checked)} />load the BCR32 settings</label>
      </fieldset>
      <p className="midi-settings-cc" role="status">{sendCC ? 'CC sending on · switch it in the editor toolbar' : 'CC sending off · switch it in the editor toolbar'} · <span className="routing-status">Controller outputs: <span data-i18n-skip>{indicators.outputRouting ?? '—'}</span>{indicators.routeSource === 'bcl' && indicators.outputRouting && <small> · BCR32 global export</small>}</span></p>
      <p className="muted">Opening this window sends nothing to the BCR32; choosing ports never writes the controller.</p>
    </dialog>
  </main>, language)
}

export default App
