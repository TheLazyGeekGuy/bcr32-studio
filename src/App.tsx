import {publicAsset} from './deployment-base'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { version as studioVersion } from '../package.json'
import { createProfile, parseProfile, valueLimit, parameterLimit, is14Bit, isRelative, modesFor, typesFor, mmcCommands, defaultSettings, type Bcr32Profile, type ControllerSettings, type Encoder, type EncoderMode, type EncoderType } from './profile'
import { FrontPanel, type Selection, type LiveValues } from './FrontPanel'
import { encoderMessages, createCcSender, isBcrOutput } from './cc-transport'
import { asHex, describeMessage, isSystemRealtime, parseFirmwareReply, productQuery, supportsWebMidi, type MidiAccess, type MidiPort } from './web-midi'
import { associateDefaultEncoder, automaticMidiAccess, automaticPorts } from './auto-midi'
import { chooseDevice, currentDevice as defaultDevice, devices, scopedKey } from './devices'
import { isDevicePort } from './device-definition'
import { loadTheme, parseTheme, themes, themeStorageKey } from './themes'
import { Icon } from './Icon'
import { ledModes, ledModeLabel, type LedMode } from './led-modes'
import { LanguagePicker, translatedTree, useLanguage, translate } from './i18n'
import {OfflineStatus} from './OfflineStatus'
import {MidiConnectionIndicator} from './MidiConnectionIndicator'
import type {MidiLease} from './editor-host/midi-broker'
import { ParameterPicker, ParameterTable } from './ParameterNames'
import { loadNames, namesFile, parameterNamesKey, type ParameterName } from './parameter-names'
import { cleanLabel, controlIndex, draftStorageKey, emptyLabels, emptyValues, libraryFile, makePreset, parseControllerState, parseLibrary, parsePreset, presetStorageKey, sameState, type ControllerPreset, type ControllerState } from './presets'
import { idleActivity, type Activity } from './ActivityLeds'
import { modeText, controlForChanges } from './oled-model'
import { applyChange, buttonValue, createMidiDecoder, decoderKey, transportIssue, type LiveValue } from './controller-midi'
import { StudioConfig } from './StudioConfig'
import { ControlSearch } from './ControlSearch'
import { createBrightnessTransport } from './led-brightness'
import { applySelectionChange, selectControls, selectedControls, selectionKey, sharedField, type SelectionGesture, type ControlChange } from './multi-selection'
import { applyLearn, createLearnSession, describeApplied, type LearnResult } from './midi-learn'
import { createDisplayArbiter, followSettled, type ActiveControl } from './display-arbiter'
import { cubaseFolder, cubaseMidiRemoteScript } from './cubase-export'
import { displayStyleKey, displayStyles, validDisplayStyle, type DisplayStyle } from './display-styles'
import { createGlobalsReader, settingsFromDevice, valueOf, withValue, type GlobalResult } from './device-globals'
import { DeviceSettings, type WriteStatus } from './DeviceSettings'
import { applyRecord, decodeControllerDump, knownRecords, type ControllerDump, type DumpRecord } from './controller-dump'
import { ExportImport } from './ExportImport'
import { floatingSupported, openFloatingDisplay, type FloatingScreen } from './FloatingDisplay'
import { drawScreens, screenText, type ScreenText } from './display-canvas'
import { controlLabel } from './FrontPanel'
import { DisplayPreview } from './OledDisplay'
import { DevicePanel } from './DevicePanel'
import { bclFileLimits, bclLinesFromSyx, bclToSyx, parseBcl, presetParameterState, presetSettings, presetToProfile, profileToBcl, type BclIssue, type Unconverted } from './bcl'
import { createBcReader, type BcIdentity, type BcReader, type PresetName } from './bc-reader'
import { createMonitor, type MonitorRow } from './midi-monitor'
import { MidiMonitor } from './MidiMonitor'
import { createHistory } from './history'
import { BclParameters, bclSchema } from './BclParameters'
import { ParameterFields } from './ParameterFields'
import { MidiStatus } from './MidiStatus'
import { BclText } from './BclText'
import { HelpPanel } from './HelpPanel'
import { moveControl, type MoveKind, type MoveMode } from './control-move'
import { createEditorEnvironment, type EditorEnvironment } from './editor-environment'
import {usePresetBank} from './use-preset-bank'
import {PresetStorageNotice} from './PresetStorageNotice'
import {EditorPresetTools} from './EditorPresetTools'
import {usePresetExchange} from './use-preset-exchange'
import type {PresetExchange} from './editor-host/preset-exchange'
import type { Theme } from './themes'
type AppearanceOverride = { theme?: Theme | 'inherit'; displayStyle?: DisplayStyle | 'inherit' }

const currentDevice = defaultDevice
const storageKey = scopedKey('bcr32-studio.profile.v1')
// Log lines keep hex and description apart so translatedTree can translate the description alone.
type LogLine = { hex: string; text: string; note?: string }
// Fetched once per page; the PDF export used to reload the 556 KB font on every export.
let pdfFont: Promise<ArrayBuffer> | null = null
const workspaceKey = scopedKey('bcr32-studio.workspace.v1')

function loadProfile(): Bcr32Profile {
  try {
    const candidate = window.localStorage.getItem(storageKey)
    if (!candidate) return createProfile()
    return parseProfile(JSON.parse(candidate))
  } catch {
    return createProfile()
  }
}

function loadDraft(): ControllerState {
  try {
    const json = window.localStorage.getItem(draftStorageKey)
    if (json) return parseControllerState(JSON.parse(json))
  } catch { /* Keep the original profile when draft storage is invalid. */ }
  return { profile: loadProfile(), labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' }
}
function loadLibrary(): ControllerPreset[] {
  try { return parseLibrary(JSON.parse(window.localStorage.getItem(presetStorageKey) || 'null')) } catch { return [] }
}
function loadWorkspace() {
  try {
    const p = JSON.parse(window.localStorage.getItem(workspaceKey) || 'null')
    if (p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 80) return p as { id: string; name: string }
  } catch { /* A missing workspace does not discard the draft. */ }
  return { id: '', name: 'My preset' }
}
function download(data: BlobPart, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fileStem = (name: string) => name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'preset'

export interface AppProps {
  presetExchange?:PresetExchange
  presetSignal?:AbortSignal
  tools?:ReactNode
  autoZoomOverride?:boolean
  onAutoZoom?:(value:boolean)=>void
  midiLease?: MidiLease
  parameters?:import('./translator/parameters').ParameterBus
  environment?: EditorEnvironment
  initialState?: ControllerState
  requestAccess?: typeof automaticMidiAccess
  bindPair?: (input: string, output: string) => void
  onSnapshot?: (state: ControllerState) => void
  active?: boolean
  locked?: boolean
  themeOverride?: Theme
  displayOverride?: DisplayStyle
  onAppearance?: (change: AppearanceOverride) => void
}
function App({ tools, environment, initialState, requestAccess, bindPair, onSnapshot, parameters, midiLease, active = true, locked = false, themeOverride, displayOverride, onAppearance,autoZoomOverride,onAutoZoom,presetExchange,presetSignal }: AppProps = {}) {
  const bound = useMemo(() => environment ?? createEditorEnvironment(defaultDevice), [environment])
  const { device: currentDevice, storage, storageKey, workspaceKey, draftStorageKey, presetStorageKey,
    createProfile, parseProfile, parseControllerState, parsePreset, parseLibrary, makePreset, sameState,
    emptyLabels, emptyValues, controlIndex, loadDraft, loadLibrary, loadWorkspace, loadTheme, loadNames,
    modesFor, createMidiDecoder, decoderKey, encoderMessages, buttonValue, transportIssue, createCcSender,
    isBcrOutput, automaticPorts, productQuery, parseFirmwareReply, createBrightnessTransport, createGlobalsReader,
    decodeControllerDump, applySelectionChange, applyLearn, controlLabel } = bound
  const language = useLanguage()
  const [initial] = useState(() => initialState ? parseControllerState(initialState) : loadDraft())
  const [localTheme, setLocalTheme] = useState(loadTheme)
  const theme = themeOverride ?? localTheme
  const setTheme = (value: Theme) => { setLocalTheme(value); onAppearance?.({ theme: value }) }
  const [parameterNames, setParameterNames] = useState(loadNames)
  const [parameterOpen, setParameterOpen] = useState(0)
  const saveParameterNames = (entries: ParameterName[]) => {
    try { storage.setItem(parameterNamesKey, JSON.stringify(namesFile(entries))); setParameterNames(entries) }
    catch { setNotice('Table not saved: local storage unavailable.') }
  }
  const [localAutoZoom, setLocalAutoZoom] = useState(() => { try { return storage.getItem('bcr32-studio.auto-zoom') === 'true' } catch { return false } })
  const autoZoom=autoZoomOverride??localAutoZoom
  const setAutoZoom=(value:boolean)=>{setLocalAutoZoom(value);onAutoZoom?.(value)}
  useEffect(() => { try { storage.setItem('bcr32-studio.auto-zoom', String(autoZoom)) } catch { /* Optional preference. */ } }, [autoZoom])
  // Numbers above encoders and keys: shown unless the user turned them off.
  // Label screen above the OLED: off unless the user turned it on.
  const [nameScreen, setNameScreen] = useState(() => { try { return storage.getItem('bcr32-studio.name-screen') === 'true' } catch { return false } })
  useEffect(() => { try { storage.setItem('bcr32-studio.name-screen', String(nameScreen)) } catch { /* Optional preference. */ } }, [nameScreen])
  // Screen style of the OLED and the label screen (Config), remembered per browser.
  const [localDisplayStyle, setLocalDisplayStyle] = useState<DisplayStyle>(() => { try { const v = storage.getItem(displayStyleKey); return validDisplayStyle(v) ? v : 'ice' } catch { return 'ice' } })
  const displayStyle = displayOverride ?? localDisplayStyle
  const setDisplayStyle = (value: DisplayStyle) => { setLocalDisplayStyle(value); onAppearance?.({ displayStyle: value }) }
  useEffect(() => { try { storage.setItem(displayStyleKey, displayStyle) } catch { /* Optional preference. */ } }, [displayStyle])
  const [showNumbers, setShowNumbers] = useState(() => { try { return storage.getItem('bcr32-studio.show-numbers') !== 'false' } catch { return true } })
  useEffect(() => { try { storage.setItem('bcr32-studio.show-numbers', String(showNumbers)) } catch { /* Optional preference. */ } }, [showNumbers])
  const [tab, setTab] = useState<'control' | 'config' | 'log' | 'presets' | 'files' | 'help'>('control')
  const [toolsCollapsed, setToolsCollapsed] = useState(false)
  const [profile, setProfile] = useState<Bcr32Profile>(initial.profile)
  const profileRef = useRef(profile); profileRef.current = profile
  // Only the fields the MIDI decoder reads: a label or LED edit must not recreate it.
  const midiKey = useMemo(() => decoderKey(profile), [profile])
  const [customLabels, setCustomLabels] = useState(initial.labels)
  const [auxValues, setAuxValues] = useState(initial.values)
  const bankFormat=useMemo(()=>({decode:parseLibrary,encode:(items:readonly ControllerPreset[])=>libraryFile([...items])}),[bound])
  const bankStorage=useCallback(()=>storage,[storage]),presetBank=usePresetBank(bankStorage,presetStorageKey,bankFormat),presets=presetBank.snapshot.items
  const lockedRef=useRef(locked);lockedRef.current=locked
  const [presetId, setPresetId] = useState(() => { const id = loadWorkspace().id; return presets.some(p => p.id === id) ? id : '' })
  const [presetName, setPresetName] = useState(() => loadWorkspace().name)
  const hasPresetRef = useRef(!!presetId); hasPresetRef.current = !!presetId
  const [pdfBusy, setPdfBusy] = useState(false)
  const [bclReport, setBclReport] = useState<Unconverted[]>([])
  const bcReader = useRef<BcReader | null>(null)
  const [bcIdentity, setBcIdentity] = useState<BcIdentity | null>(null)
  const [bcNames, setBcNames] = useState<PresetName[]>([])
  const [bcSlot, setBcSlot] = useState(1)
  const [bcBusy, setBcBusy] = useState(false)
  const [bcReady, setBcReady] = useState(false)
  const [bcGlobal, setBcGlobal] = useState<Record<string, string> | null>(null)
  const [monitor] = useState(() => createMonitor())
  const [inspectorView, setInspectorView] = useState<'form' | 'text'>('form')
  const [monitorOpen, setMonitorOpen] = useState(() => { try { return storage.getItem('bcr32-studio.monitor-open') !== 'false' } catch { return true } })
  useEffect(() => { try { storage.setItem('bcr32-studio.monitor-open', String(monitorOpen)) } catch { /* Optional preference. */ } }, [monitorOpen])
  // Undo / redo per preset (src/history.ts): assignments and labels; values and the observed firmware are not history.
  const [history] = useState(() => createHistory())
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 })
  const historyKey = presetId || 'draft', historyKeyRef = useRef(historyKey), restoring = useRef<string | null>(null)
  const historyState = useMemo(() => JSON.stringify({ profile: { ...profile, device: undefined }, labels: customLabels }), [profile, customLabels])
  useEffect(() => {
    if (historyKeyRef.current !== historyKey) { historyKeyRef.current = historyKey; history.arrive(historyKey, historyState) }
    else if (restoring.current === historyState) restoring.current = null
    else history.record(historyKey, historyState, performance.now())
    setHistoryCounts(history.counts(historyKey))
  }, [historyKey, historyState])
  const stepHistory = (direction: 'undo' | 'redo') => {
    if (locked) { setNotice('Editor configuration locked'); return }
    const state = direction === 'undo' ? history.undo(historyKey) : history.redo(historyKey)
    if (state === null) { setNotice(direction === 'undo' ? 'Nothing to undo in this preset.' : 'Nothing to redo in this preset.'); return }
    const { profile: restored, labels } = JSON.parse(state) as { profile: Bcr32Profile; labels: typeof customLabels }
    restoring.current = state
    setProfile(current => ({ ...restored, device: current.device })); setCustomLabels(labels)
    setNotice(direction === 'undo' ? 'Undone.' : 'Redone.')
  }
  const stepRef = useRef(stepHistory); stepRef.current = stepHistory
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active || locked) return
      const target = event.target as HTMLElement | null
      if (!(event.metaKey || event.ctrlKey) || target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      if (key === 'z') { event.preventDefault(); stepRef.current(event.shiftKey ? 'redo' : 'undo') }
      else if (key === 'y') { event.preventDefault(); stepRef.current('redo') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, locked])
  const [activity, setActivity] = useState<Activity>(idleActivity)
  const pulseActivity = (source: Activity['source']) => setActivity(current => ({ serial: current.serial + 1, source }))
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
  // Floating display (src/FloatingDisplay.tsx): the screens drawn on a canvas shown as a picture-in-picture video.
  const floatRef = useRef<FloatingScreen | null>(null), [floatOn, setFloatOn] = useState(false)
  const floatContent = useRef<{ text: ScreenText; style: string } | null>(null)
  const [arbiter] = useState(() => createDisplayArbiter({ onChange: state => {
    setActiveControls(current => current.length === 0 && state.active.length === 0 ? current : state.active)
    const shown = state.shown
    if (shown) setScreenControl(current => selectionKey(current) === selectionKey(shown) ? current : shown)
    // Same guard as the former per-message follow (controlForChanges): single selection only, never while Learn is armed, not already
    // selected. No other memo: after a panel click on B, A turned again must re-select A (the arbiter was reset by the click).
    const settled = followSettled(state.settled, selectionRef.current, selectionsRef.current, learnArmed.current)
    if (settled) { selectionRef.current = settled; setSelection(settled); setSelections([settled]); selectionsRef.current = [settled] }
  } }))
  useEffect(() => () => arbiter.stop(), [arbiter])
  useEffect(() => () => { floatRef.current?.close() }, [])
  useEffect(() => { floatRef.current?.redraw() })
  async function toggleFloatingDisplay() {
    if (floatRef.current) { floatRef.current.close(); return }
    try {
      floatRef.current = await openFloatingDisplay(ctx => { const c = floatContent.current; if (c) drawScreens(ctx, c.text, c.style) }, () => { floatRef.current = null; setFloatOn(false) })
      setFloatOn(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }
  const [values, setValues] = useState<LiveValues>(() => Object.fromEntries(initial.values.encoders.flatMap((v, i) => v === null ? [] : [[i + 1, { value: v, source: 'local' as const }]])))
  const liveRef = useRef(values); liveRef.current = values
  const parameterLast=useRef(new Map<string,number>())
  const auxRef = useRef(auxValues); auxRef.current = auxValues
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
  const [notice, setNotice] = useState('MIDI reception available after connection; CC sending disabled. Hardware configuration locked.')
  const [brightness, setBrightness] = useState<number | null>(null)
  const [brightnessDraft, setBrightnessDraft] = useState(5)
  const [brightnessStatus, setBrightnessStatus] = useState('')
  const brightnessTransport = useRef<ReturnType<typeof createBrightnessTransport>|null>(null)
  // Read-only global settings (src/device-globals.ts): the official editor's short reads, one at a time.
  const globalsReader = useRef<ReturnType<typeof createGlobalsReader>|null>(null)
  const [deviceSettings, setDeviceSettings] = useState<GlobalResult[] | null>(null)
  const [deviceSettingsBusy, setDeviceSettingsBusy] = useState(false)
  const deviceSettingsRef = useRef(deviceSettings); deviceSettingsRef.current = deviceSettings
  const [writeStatus, setWriteStatus] = useState<Record<number, WriteStatus>>({})
  // Front-panel exports received while the editor listens (src/controller-dump.ts), newest first (all 64 presets fit).
  const [dumps, setDumps] = useState<ControllerDump[]>([])
  // Values read from the controller, as Config fields, with the time of the read (src/device-globals.ts settingsFromDevice).
  const [deviceSnapshot, setDeviceSnapshot] = useState<{ at: string; settings: Partial<ControllerSettings> } | null>(null)
  // Load the controller's settings automatically at each connection (default on, remembered per browser).
  const [autoLoadDevice, setAutoLoadDevice] = useState(() => { try { return storage.getItem('bcr32-studio.device-autoload') !== 'false' } catch { return true } })
  useEffect(() => { try { storage.setItem('bcr32-studio.device-autoload', String(autoLoadDevice)) } catch { /* Optional preference. */ } }, [autoLoadDevice])
  const autoLoadRef = useRef(autoLoadDevice); autoLoadRef.current = autoLoadDevice

  const inputs = useMemo(() => access ? Array.from(access.inputs.values()) : [], [access, portVersion])
  const outputs = useMemo(() => access ? Array.from(access.outputs.values()) : [], [access, portVersion])
  const output = outputs.find(port => port.id === outputId)
  const connectedPair = inputs.some(port => port.id === inputId && port.state === 'connected') && output?.state === 'connected'
  const brightnessEnabled = currentDevice.features.brightness && !!access?.sysexEnabled && isBcrOutput(output) && inputs.some(p=>p.id===inputId && isDevicePort(currentDevice, p))
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
  useEffect(() => { onSnapshot?.(snapshot) }, [snapshot])
  // Optional common tool adapter: routed targets only update local values, never the CC sender.
  useEffect(()=>{
    if(!parameters||!bound.instanceId)return
    const offs=(['encoders','pushes','buttons'] as const).flatMap(kind=>profile[kind].map(e=>{
      const id=`${bound.instanceId}:${kind}:${e.id}`
      return parameters.register({id,name:`${currentDevice.name} · ${bound.instanceId!.slice(0,8)} · ${kind} ${e.id}`,minimum:Math.min(e.minimum,e.maximum),maximum:Math.max(e.minimum,e.maximum),setLocal:(value,trace)=>{
        parameterLast.current.set(id,value)
        if(kind==='encoders'){liveRef.current={...liveRef.current,[e.id]:{value,source:'local'}};setValues(liveRef.current)}
        else {auxRef.current={...auxRef.current,[kind]:auxRef.current[kind].map((v,i)=>i===controlIndex(kind,e.id)?value:v)};setAuxValues(auxRef.current);setAuxSources(old=>({...old,[`${kind}:${e.id}`]:'local'}))}
        parameters.publish(id,value,trace)
      }})
    }))
    return()=>{offs.forEach(off=>off())}
  },[parameters,bound,profile])
  useEffect(()=>{
    if(!parameters||!bound.instanceId)return
    for(const kind of ['encoders','pushes','buttons'] as const)for(const e of profile[kind]){
      const id=`${bound.instanceId}:${kind}:${e.id}`,value=kind==='encoders'?values[e.id]?.value:auxValues[kind][controlIndex(kind,e.id)]
      if(value===null||value===undefined||value<Math.min(e.minimum,e.maximum)||value>Math.max(e.minimum,e.maximum)||parameterLast.current.get(id)===value)continue
      parameterLast.current.set(id,value);parameters.publish(id,value)
    }
  },[parameters,bound,profile,values,auxValues])
  const selectMany=(list:Selection[])=>{
    if(!list.length)return
    const active=list[list.length-1]
    selectionsRef.current=list;setSelections(list);selectionAnchor.current=list[0];setSelection(active);arbiter.reset();setScreenControl(active);setTab('control')
  }
  const activePreset = presets.find(p => p.id === presetId)
  // sameState serializes the whole state several times: only when values/profile change, not on log/activity renders.
  const dirty = useMemo(() => activePreset ? !sameState(activePreset, snapshot) || presetName.trim() !== activePreset.name : true, [activePreset, snapshot, presetName])
  const selectedIndex = controlIndex(selection.kind, selection.id)

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


  const stopEmission = () => { sender.current?.close(); sender.current = null; heldButton.current = null; setSendCC(false) }
  const storeLibrary = (next: ControllerPreset[]|((items:ControllerPreset[])=>ControllerPreset[])) => {
    if(lockedRef.current)throw Error('Editor configuration locked')
    presetBank.save(next)
  }
  const recallState = (state: ControllerState) => {
    stopEmission(); disarmLearn()
    setSelections([selection]);selectionsRef.current=[selection]
    setAuxSources({})
    setProfile(state.profile); setCustomLabels(state.labels); setAuxValues(state.values); setRingMode(state.ringMode)
    setValues(Object.fromEntries(state.values.encoders.flatMap((v, i) => v === null ? [] : [[i + 1, { value: v, source: 'local' as const }]])))
  }
  const recallPreset = (id: string) => {
    if (locked) { setNotice('Editor configuration locked'); return }
    const p = presets.find(p => p.id === id)
    if (!p) return
    if (dirty && !window.confirm(translate('Load this preset and replace the current draft? Unsaved changes will be replaced.', language))) return
    recallState(parseControllerState(p)); setPresetId(p.id); setPresetName(p.name)
    setNotice(`Preset “${p.name}” loaded locally. CC sending disabled; no hardware writes.`)
  }
  usePresetExchange(presetExchange,{id:bound.instanceId??`legacy-${currentDevice.id}`,moduleId:`${currentDevice.id}-editor`,stateVersion:1,name:currentDevice.name,
    capture:()=>({name:presetName,state:parseControllerState(snapshot)}),validate:parseControllerState,isLocked:()=>lockedRef.current,
    load:(value,name)=>{recallState(parseControllerState(value));setPresetId('');setPresetName(name);setNotice('Library preset loaded locally; hardware sending disabled.')}},presetSignal)
  const savePreset = (asNew = false) => {
    try {
      if ((asNew || !activePreset) && presets.length >= 500) throw new Error('Library full (500 presets)')
      const p = makePreset(snapshot, presetName, !asNew && activePreset ? activePreset.id : undefined)
      storeLibrary(items=>[...items.filter(e => e.id !== p.id), p])
      setPresetId(p.id); setPresetName(p.name)
      setNotice(`Preset “${p.name}” saved in this browser. Visual labels only.`)
    } catch (error) { setNotice(`Save failed: ${error instanceof Error ? error.message : String(error)}`) }
  }
  const importPresets = async (file: File | undefined) => {
    if (!file) return
    try {
      if(file.size>64*1024*1024)throw Error('Preset file size limit')
      const raw = JSON.parse(await file.text())
      const incoming = raw.format === 'bcr32-preset-library' ? parseLibrary(raw) : [parsePreset(raw)]
      // Imported files never silently overwrite an existing preset or load hardware state.
      const imported = incoming.map(p => ({ ...p, id: crypto.randomUUID() }))
      if (presets.length + imported.length > 500) throw new Error('Limit of 500 presets')
      storeLibrary(items=>[...items, ...imported])
      setNotice(`${imported.length} preset(s) imported into the library, without loading or MIDI sending.`)
    } catch (error) { setNotice(`Import rejected: ${error instanceof Error ? error.message : String(error)}`) }
  }
  // BCL files (B-Control models): text (.bcr/.bcf/.txt) or the same lines as SysEx (.syx). A single preset replaces the
  // draft, several go to the library; what cannot be converted is listed in Files, never guessed.
  const importBcl = async (file: File | undefined) => {
    if (!file || !currentDevice.bclModel) return
    try {
      if(file.size>bclFileLimits.bytes)throw Error('BCL file size limit exceeded')
      const bytes = new Uint8Array(await file.arrayBuffer())
      if(bytes.length>bclFileLimits.bytes)throw Error('BCL file size limit exceeded')
      const source = bytes[0] === 0xf0 ? bclLinesFromSyx(bytes) : { lines: new TextDecoder().decode(bytes).split(/\r?\n/), model: null, issues: [] }
      applyBcl(source.lines, source.issues, source.model, file.name)
    } catch (error) { setNotice(`Import rejected: ${error instanceof Error ? error.message : String(error)}`) }
  }
  // BCL lines from a file or read from the controller: one preset replaces the draft (after confirmation), several go
  // to the library. Throws on a file for another model or without preset.
  const applyBcl = (lines: string[], sourceIssues: BclIssue[], modelByte: number | null, label: string) => {
    {
      const doc = parseBcl(lines)
      const letter = doc.model ?? (modelByte === 0x14 ? 'F' : modelByte === 0x15 ? 'R' : null)
      if (letter && letter !== currentDevice.bclModel) throw new Error('File made for another controller model')
      if (!doc.presets.length) {
        if (!doc.global) throw new Error('No preset in the file')
        setBcGlobal(doc.global)
        setProfile(p => ({ ...p, parameters: { ...p.parameters, global: { protocol: 'bcl', statements: Object.entries(doc.global!).map(([k,v]) => `.${k} ${v}`) } } }))
        setNotice(`BCL global setup imported: ${label}`); return
      }
      const converted = doc.presets.map(p => ({ preset: p, ...presetToProfile(p, { ...createProfile(), ...(doc.global ? { parameters: { global: { protocol: 'bcl', statements: Object.entries(doc.global).map(([k,v]) => `.${k} ${v}`) } } } : {}) }, currentDevice.faders) }))
      const tag = (p: typeof doc.presets[number]) => doc.presets.length > 1 ? `${p.slot ? `P-${String(p.slot).padStart(2, '0')}` : 'temp'} · ` : ''
      setBclReport([...sourceIssues, ...doc.issues].map(i => ({ control: `Line ${i.line}`, reason: i.message })).concat(converted.flatMap(c => c.unconverted.map(u => ({ ...u, control: tag(c.preset) + u.control })))))
      if (converted.length === 1) {
        if (dirty && !window.confirm(translate('Importing this profile replaces the draft, its values and labels. Continue?', language))) return
        recallState({ profile: converted[0].profile, labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' })
        setPresetId(''); setPresetName(converted[0].preset.name || label)
        setNotice(`BCL preset imported: ${label}`)
        return
      }
      if (presets.length + converted.length > 500) throw new Error('Limit of 500 presets')
      const imported = converted.map(c => makePreset({ profile: c.profile, labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' }, `${tag(c.preset)}${c.preset.name || label}`.slice(0, 80)))
      storeLibrary(items=>[...items, ...imported])
      setNotice(`${imported.length} preset(s) imported into the library, without loading or MIDI sending.`)
    }
  }
  // Read a preset from the controller (read request only) and load it like a BCL file.
  const readFromDevice = async (slot: number | 'temporary') => {
    const reader = bcReader.current
    if (!reader) return
    setBcBusy(true)
    try {
      const chain = await reader.readPreset(slot)
      if (bcReader.current !== reader) return
      if (!chain.complete) throw new Error(chain.issues.at(-1) ?? 'No reply')
      applyBcl(chain.lines, chain.issues.map(message => ({ line: 0, message })), currentDevice.sysex.model, slot === 'temporary' ? `${currentDevice.name} · current preset` : `${currentDevice.name} · P-${String(slot).padStart(2, '0')}`)
    } catch (error) { setNotice(`Read failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBcBusy(false) }
  }
  // B-Control global setup (request 41, read only): shown in Config as the controller reports it.
  const readGlobalFromDevice = async () => {
    const reader = bcReader.current
    if (!reader) return
    setBcBusy(true)
    try {
      const chain = await reader.readGlobal()
      if (bcReader.current !== reader) return
      if (!chain.complete) throw new Error(chain.issues.at(-1) ?? 'No reply')
      const global = parseBcl(chain.lines).global ?? {}
      setBcGlobal(global)
      setProfile(p => ({ ...p, parameters: { ...p.parameters, global: { protocol: 'bcl', statements: Object.entries(global).map(([k,v]) => `.${k} ${v}`) } } }))
    } catch (error) { setNotice(`Read failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBcBusy(false) }
  }
  const readNamesFromDevice = async () => {
    const reader = bcReader.current
    if (!reader) return
    setBcBusy(true)
    try { const names = await reader.readNames(); if (bcReader.current === reader) setBcNames(names) } finally { setBcBusy(false) }
  }
  const exportBcl = (asSyx: boolean) => {
    if (!currentDevice.bclModel) return
    const { lines, unconverted } = profileToBcl(profile, presetName.trim() || 'MIDI Studio', currentDevice.bclModel, null, currentDevice.faders)
    setBclReport(unconverted)
    const stem = `${currentDevice.id}-${fileStem(presetName)}`
    if (asSyx) download(new Uint8Array(bclToSyx(lines, currentDevice.sysex.model)), `${stem}.syx`, 'application/octet-stream')
    else download(lines.join('\n') + '\n', `${stem}.${currentDevice.bclModel === 'F' ? 'bcf' : 'bcr'}`, 'text/plain')
    setNotice(unconverted.length ? `BCL file saved; ${unconverted.length} control(s) not converted: see the list in Files.` : 'BCL file saved.')
  }
  const exportPreset = () => {
    try { const p = makePreset(snapshot, presetName); download(JSON.stringify(p, null, 2), `bcr32-${fileStem(p.name)}.json`) }
    catch { setNotice('Enter a preset name before exporting.') }
  }
  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      const p = makePreset(snapshot, presetName)
      if (!pdfFont) pdfFont = fetch(publicAsset('fonts/NotoSans-Regular.ttf')).then(response => { if (!response.ok) throw new Error('PDF font unavailable'); return response.arrayBuffer() }).catch(error => { pdfFont = null; throw error })
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
        if (!isBcrOutput(pair.output)) setNotice(`${currentDevice.name} output unavailable: CC sending stopped, no pending values.`)
      }
      if (pair.input && pair.output && !associatedOnce.current) {
        associatedOnce.current = true
        setProfile(current => associateDefaultEncoder(current, hasPresetRef.current))
      }
      if (pair.ambiguous) setNotice(`Multiple ${currentDevice.name} ports: choose a pair; no device is selected at random.`)
    }
    return () => { access.onstatechange = null }
  }, [access, inputId, outputId])

  // Arm only a newly connected BCR output. This never enqueues preset values,
  useEffect(() => {
    if (!bindPair || !access) return
    try { bindPair(inputId, outputId) }
    catch (error) { sender.current?.close(); sender.current = null; setSendCC(false); setNotice(error instanceof Error ? error.message : String(error)) }
  }, [access, inputId, outputId, bindPair])

  // and does not undo a manual stop, preset recall or transport failure.
  useEffect(() => {
    if (!isBcrOutput(output)) { automaticEmissionPort.current = null; return }
    if (automaticEmissionPort.current === output) return
    automaticEmissionPort.current = output
    setSendCC(true)
  }, [access, output, portVersion])

  useEffect(() => {
    if (!sendCC || !isBcrOutput(output)) return
    const transport = createCcSender(bytes => {
      if (!isBcrOutput(output)) throw new Error('BCR32 output disconnected')
      output.send!(bytes)
    }, bytes => { pulseActivity('send'); monitor.push('out', bytes, 'value sent'); setEvents(current => [{ hex: `→ ${asHex(bytes)}`, text: describeMessage(bytes), note: 'value sent' }, ...current].slice(0, 12)) }, error => {
      setSendCC(false)
      setNotice(`Sending stopped: ${error instanceof Error ? error.message : String(error)}`)
    })
    sender.current = transport
    return () => { transport.close(); if (sender.current === transport) sender.current = null }
  }, [sendCC, output])

  useEffect(() => {
    const input = inputs.find((port) => port.id === inputId)
    if (!input) return
    // Decoder state (NRPN selector, 14-bit MSBs) survives edits that leave midiKey unchanged.
    const decode = createMidiDecoder(profileRef.current)
    setAuxSources({})
    // Do not combine an old input/profile MSB with a new source's LSB.
    setValues(current => Object.fromEntries(Object.entries(current).map(([id, v]) => [id, { value: v.value, source: v.source }])))
    input.onmidimessage = (event) => {
      const data = Array.from(event.data)
      monitor.push('in', data)
      // Clock (F8) and active sensing (FE) touch no React state: no activity pulse, no log line, no App render.
      if (data.length && !isSystemRealtime(data)) {
        pulseActivity('receive')
        setEvents((current) => [{ hex: asHex(data), text: describeMessage(data) }, ...current].slice(0, 12))
      }
      brightnessTransport.current?.receive(data)
      globalsReader.current?.receive(data)
      bcReader.current?.receive(data)
      const dump = decodeControllerDump(data)
      // Up to 64 presets × 8 blocks are kept; the notice counts messages instead of announcing each block.
      if (dump) setDumps(list => { const next = [dump, ...list].slice(0, 600); setNotice(dump.checksumOk ? `Front-panel export received: ${next.length} messages.` : 'Front-panel export received with a checksum error.'); return next })
      // While Learn is armed the message feeds the learn parser first and the selection does not follow MIDI,
      // so the learned parameters land on the control the user chose, not on one that already matched the CC.
      const learned = learnReceive.current(data)
      const changes = decode(data)
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
        setAuxValues(previous => {
          const next = { ...previous, pushes: [...previous.pushes], buttons: [...previous.buttons] }
          for (const change of auxChanges) {
            const { kind, id } = change.control
            if (kind === 'encoders') continue
            const e = current[kind].find(e => e.id === id)!, i = controlIndex(kind, id)
            next[kind][i] = applyChange(e, { value: next[kind][i], source: 'midi' }, change).value
          }
          auxRef.current = next
          return next
        })
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
      if (firmware) setProfile(p => p.device.firmwareObserved === firmware ? p : { ...p, device: { ...p.device, firmwareObserved: firmware } })
    }
    return () => { input.onmidimessage = null; arbiter.stop() }
  }, [inputId, inputs, midiKey])

  const setPreviewValue = (id: number, value: number) => {
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
    setNotice(enabled ? `CC sending enabled: UI gestures send values to ${currentDevice.name}, not assignments.` : 'CC sending disabled: reception and local preview only.')
  }

  const connect = async () => {
    if (connecting.current) return
    connecting.current = true
    automaticEmissionPort.current = null
    sender.current?.close(); sender.current = null; setSendCC(false)
    try {
      const { access: midi, sysexError } = await (requestAccess ?? automaticMidiAccess)()
      setAccess(midi)
      const pair = automaticPorts(midi)
      setInputId(pair.input?.id ?? '')
      setOutputId(pair.output?.id ?? '')
      if (pair.input && pair.output && !associatedOnce.current) {
        associatedOnce.current = true
        setProfile(current => associateDefaultEncoder(current, hasPresetRef.current))
      }
      setNotice(sysexError ? 'MIDI connected; browser denied SysEx. Retry after granting permission.' : pair.ambiguous ? `Multiple ${currentDevice.name} devices: choose ports; no arbitrary pairing.` : pair.input && pair.output ? `CC sending enabled: UI gestures send values to ${currentDevice.name}, not assignments.` : `MIDI allowed; waiting for ${currentDevice.name}, automatic connection when plugged in.`)
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

  // Declared after the receive effect: attach the listener before probing.
  useEffect(() => {
    const input = inputs.find(p => p.id === inputId && isDevicePort(currentDevice, p))
    if (!currentDevice.features.productProbe || !access?.sysexEnabled || !input || !isBcrOutput(output)) { probedPair.current = null; return }
    if (probedPair.current?.access === access && probedPair.current.input === input && probedPair.current.output === output) return
    probedPair.current = { access, input, output }
    try {
      output.send!(productQuery); monitor.push('out', productQuery, 'product query (read-only)')
      pulseActivity('send')
      setEvents(current => [{ hex: `→ ${asHex(productQuery)}`, text: 'automatic product/firmware probe (read-only)' }, ...current].slice(0, 12))
    } catch (error) { setNotice(`Automatic probe failed: ${error instanceof Error ? error.message : String(error)}`) }
  }, [access, inputId, inputs, output, portVersion])

  // Single validation path for the inspector and MIDI Learn: applySelectionChange, then clamp live values of the targets.
  const commitChange = (targets: Selection[], change: ControlChange) => {
    if (locked) { setNotice('Editor configuration locked'); return }
    const keys=new Set(targets.map(selectionKey))
    const next=applySelectionChange(profileRef.current,targets,change)
    profileRef.current=next // several commits in one gesture build on each other
    setProfile(next)
    setValues(current=>Object.fromEntries(Object.entries(current).map(([id,old])=>{
      if(!keys.has(selectionKey({kind:'encoders',id:Number(id)})))return [id,old]
      const e=next.encoders.find(e=>e.id===Number(id))!
      return [id,{value:old.value===null?null:Math.max(e.minimum,Math.min(e.maximum,old.value)),source:'local' as const}]
    })))
    setAuxValues(current=>({...current,...Object.fromEntries((['pushes','buttons'] as const).map(kind=>[kind,current[kind].map((v,i)=>keys.has(selectionKey({kind,id:next[kind][i].id}))&&v!==null?Math.max(next[kind][i].minimum,Math.min(next[kind][i].maximum,v)):v)]))}))
  }
  const updateSelected = (change: ControlChange) => {
    try { commitChange(selections,change) } catch(error){setNotice(error instanceof Error?error.message:String(error))}
  }
  // Drag and drop on the panel (src/control-move.ts): swap, insert or copy, with the labels; one undo step.
  const moveControls = (kind: MoveKind, from: number, to: number, mode: MoveMode) => {
    if (locked) { setNotice('Editor configuration locked'); return }
    const r = moveControl(profileRef.current, customLabels, currentDevice, kind, from, to, mode)
    if (r.profile === profileRef.current) return
    profileRef.current = r.profile; setProfile(r.profile); setCustomLabels(r.labels)
    selectUi({ kind, id: to }, {}, true)
    const pair = `${controlName({ kind, id: from })} → ${controlName({ kind, id: to })}`
    setNotice(`${mode === 'swap' ? `Swapped: ${pair}.` : mode === 'copy' ? `Copied: ${pair}.` : `Moved: ${pair}; the controls in between shifted.`}${r.notes.length ? ' ' + r.notes.join(' ') : ''}`)
  }
  // B-Control: what the selected control does to the preset's hardware settings (.fkeys, .egroups, .lock), shown
  // before it surprises on the device. Derived the same way as the BCL export (src/bcl.ts).
  const hardwareNotes = (): string[] => {
    if (!currentDevice.bclModel) return []
    const set = presetSettings(profile), notes: string[] = [], { kind, id } = selection
    const assigned = kind === 'buttons' && profile.buttons.find(b => b.id === id)?.type !== 'off'
    if (assigned && id >= 53 && id <= 56) notes.push('Programming a function key turns STORE, LEARN, EDIT and EXIT into keys in this preset (.fkeys off).')
    if (assigned && id >= 57 && id <= 60) notes.push(`Programming a group key leaves ${set.egroups} encoder group(s) in this preset (.egroups ${set.egroups}).`)
    if (assigned && (id === 63 || id === 64)) notes.push('Programming a preset key stops the preset keys from changing presets (.lock on).')
    if (kind !== 'buttons' && id <= 32 && Math.ceil(id / 8) > set.egroups) notes.push(`Encoder group ${Math.ceil(id / 8)} is not available in this preset (.egroups ${set.egroups}).`)
    return notes
  }
  // Monitor: the controls of the profile a message belongs to, and "Apply to selection" (each selected control gets
  // the message's type, channel and parameter; keys and encoders keep only the types they accept).
  const messageType = (row: MonitorRow): EncoderType | null => ({ CC: 'cc', NRPN: 'nrpn', Note: 'note', PB: 'pb', AT: 'at', PC: 'pc' } as Record<string, EncoderType>)[row.kind] ?? null
  const monitorControl = (row: MonitorRow) => {
    const type = messageType(row)
    if (!type || row.channel === null) return null
    const hits = (['encoders', 'pushes', 'buttons'] as const).flatMap(kind => profile[kind].filter(e => e.type === type && e.channel === row.channel && (type === 'pb' || type === 'pc' || (type === 'at' && row.parameter === null ? !!e.aftertouchAll : e.parameter === row.parameter))).map(e => controlLabel(kind, e.id, customLabels) === controlName({ kind, id: e.id }) ? controlName({ kind, id: e.id }) : `${controlName({ kind, id: e.id })} · ${controlLabel(kind, e.id, customLabels)}`))
    return hits.length ? hits.slice(0, 2).join(', ') + (hits.length > 2 ? ` +${hits.length - 2}` : '') : null
  }
  const applyMessage = (row: MonitorRow) => {
    const type = messageType(row)
    if (!type || row.channel === null) return
    const change: ControlChange = { type, channel: row.channel, ...(row.parameter !== null ? { parameter: row.parameter } : {}), ...(type === 'at' ? { aftertouchAll: row.parameter === null } : {}), ...(type === 'nrpn' ? { maximum: 16383 } : {}) }
    try {
      for (const s of selections) commitChange([s], change)
      setNotice(`Message applied to ${selections.length} control(s).`)
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }

  // MIDI Learn is one-shot and single-target. It only edits the local profile: no SysEx, no hardware write.
  const controlName = (s: Selection) => `${s.kind === 'encoders' ? 'Encoder' : s.kind === 'pushes' ? 'Push' : 'Button'} ${s.id}`
  const disarmLearn = () => {
    learnSession.current?.cancel(); learnSession.current = null
    learnArmed.current = false
    setLearn(current => current.active ? { active: false, status: '' } : current)
  }
  const cancelLearn = () => { disarmLearn(); setNotice('Learn cancelled: no assignment changed.') }
  const armLearn = () => {
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
    if(!brightnessEnabled||!output){brightnessTransport.current=null;return}
    const transport=createBrightnessTransport(bytes=>{
      if(!isBcrOutput(output))throw Error('BCR32 output disconnected')
      output.send!(bytes);pulseActivity('send');monitor.push('out',bytes,'LED brightness')
      setEvents(current=>[{hex:`→ ${asHex(bytes)}`,text:'LED brightness'},...current].slice(0,12))
    },state=>{setBrightness(state.value);setBrightnessDraft(state.draft);setBrightnessStatus(state.status)})
    brightnessTransport.current=transport;transport.read()
    return ()=>{transport.close();if(brightnessTransport.current===transport)brightnessTransport.current=null}
  },[access,inputId,output,brightnessEnabled,portVersion])
  useEffect(()=>{if(tab==='config'&&brightness===null)brightnessTransport.current?.read()},[tab])
  useEffect(() => {
    if (!currentDevice.features.globals || !brightnessEnabled || !output?.send) { globalsReader.current = null; return }
    const port = output, reader = createGlobalsReader(bytes => { port.send?.(bytes); monitor.push('out', bytes, 'settings read') })
    globalsReader.current = reader
    if (autoLoadRef.current) void loadDeviceSettings(reader)
    return () => { reader.close(); if (globalsReader.current === reader) globalsReader.current = null }
  }, [access, inputId, output, brightnessEnabled, portVersion])
  // Read the controller's settings and put them into the Config fields (the values stay editable; nothing is written).
  // B-Control models: a reader for read requests once SysEx is allowed and the model's ports are paired; identity first.
  useEffect(() => {
    const input = inputs.find(p => p.id === inputId && isDevicePort(currentDevice, p))
    if (!currentDevice.bclModel || !access?.sysexEnabled || !input || !isBcrOutput(output)) { bcReader.current = null; setBcReady(false); setBcIdentity(null); return }
    const port = output, reader = createBcReader(currentDevice, bytes => { port.send?.(bytes); pulseActivity('send'); monitor.push('out', bytes, 'read request') })
    bcReader.current = reader; setBcReady(true)
    void reader.identify().then(id => { if (bcReader.current === reader) setBcIdentity(id) })
    return () => { reader.close(); if (bcReader.current === reader) { bcReader.current = null; setBcReady(false) } }
  }, [access, inputId, output, portVersion])
  async function loadDeviceSettings(reader = globalsReader.current) {
    if (!reader) return
    setDeviceSettingsBusy(true)
    try {
      const results = await reader.read()
      if (globalsReader.current !== reader) return // port changed meanwhile: these results are stale
      setDeviceSettings(results)
      const fromDevice = settingsFromDevice(results)
      if (!Object.keys(fromDevice).length) return
      setDeviceSnapshot({ at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), settings: fromDevice })
      setProfile(current => ({ ...current, settings: { ...(current.settings ?? defaultSettings()), ...fromDevice } }))
    } finally { setDeviceSettingsBusy(false) }
  }
  useEffect(() => { if (autoLoadDevice && globalsReader.current && !deviceSnapshot) void loadDeviceSettings() }, [autoLoadDevice])
  // Apply one record of a front-panel export to the control it is known to describe (type, channel, parameter, range).
  function applyExportRecord(record: DumpRecord) {
    const target = knownRecords[record.index]
    if (!target) return
    setProfile(current => ({ ...current, encoders: current.encoders.map(e => e.id === target.id ? applyRecord(e, record) : e) }))
    setNotice(`Encoder ${target.id} updated from the front-panel export.`)
  }
  // Write the editor's value of one setting to the BCR32, then show what the read-back says (src/device-globals.ts).
  async function writeDeviceSetting(cmd: number) {
    const reader = globalsReader.current, value = valueOf(cmd, profileRef.current.settings ?? defaultSettings())
    if (!reader || value === null) return
    setWriteStatus(s => ({ ...s, [cmd]: 'busy' }))
    let result: { value: number | null; status: GlobalResult['status'] }
    try { result = await reader.write(cmd, value) } catch { result = { value: null, status: 'no reply' } }
    if (globalsReader.current !== reader) return
    const next = deviceSettingsRef.current?.map(r => r.cmd === cmd ? { ...r, value: result.value, status: result.status } : r) ?? null
    deviceSettingsRef.current = next; setDeviceSettings(next)
    if (next) setDeviceSnapshot(s => ({ at: s?.at ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), settings: settingsFromDevice(next) }))
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
      if (dirty && !window.confirm(translate('Importing this profile replaces the draft, its values and labels. Continue?', language))) return
      recallState({ profile: candidate, labels: emptyLabels(), values: emptyValues(), ringMode: 'bar' })
      setPresetId(''); setPresetName('Imported profile')
      setNotice(`Profile imported: ${file.name}`)
    } catch {
      setNotice('Import rejected: incompatible v1/v2 profile or invalid values.')
    }
  }

  const screenValue = screenControl.kind === 'encoders' ? { value: values[screenControl.id]?.value ?? null, source: values[screenControl.id]?.source ?? 'local' } : { value: auxValues[screenControl.kind][controlIndex(screenControl.kind, screenControl.id)], source: auxSources[`${screenControl.kind}:${screenControl.id}`] ?? 'local' }
  floatContent.current = { text: screenText(screenControl, profile[screenControl.kind].find(e => e.id === screenControl.id)!, screenValue.value, screenValue.source, controlLabel(screenControl.kind, screenControl.id, customLabels)), style: displayStyle }
  return translatedTree(<main className={`studio compact${environment ? ' embedded-editor' : ''}`} data-theme={theme} data-tools-collapsed={toolsCollapsed || undefined}
    onChangeCapture={event => { if (locked && !(event.target as HTMLElement).closest('.value-preview,.ports-fields,.config-appearance > .zoom-option,.language-icon-picker')) { event.preventDefault(); event.stopPropagation(); setNotice('Editor configuration locked') } }}
    onKeyDown={event=>{if(event.key!=='Escape')return;if(learn.active){cancelLearn();event.preventDefault()}else if(multiple||mouseMulti){setMouseMulti(false);selectUi(selection,{},true);event.preventDefault()}}}>
    {environment && <button className="editor-tools-toggle" aria-label={toolsCollapsed ? 'Show editing tools' : 'Collapse editing tools'} aria-expanded={!toolsCollapsed} title={toolsCollapsed ? 'Show editing tools' : 'Collapse editing tools'} onClick={() => setToolsCollapsed(value => !value)}><Icon name={toolsCollapsed ? 'expand' : 'collapse'} /></button>}
    <section className={`workspace${tab !== 'control' ? ' left-open' : ''}`}>
      <section className="surface" aria-label={`${currentDevice.name} encoders`}>
        {currentDevice.panel.sections ? <DevicePanel device={currentDevice} profile={profile} selection={selection} selections={selections} select={selectUi} values={values} auxValues={auxValues} customLabels={customLabels} screenControl={screenControl} screenValue={screenValue} showNumbers={showNumbers} move={locked ? undefined : moveControls} setValue={setPreviewValue} mouseMulti={mouseMulti} selectMany={selectMany} /> : <FrontPanel device={currentDevice} move={locked ? undefined : moveControls} selectMany={selectMany} mouseMulti={mouseMulti} autoZoom={autoZoom} showNumbers={showNumbers} nameScreen={nameScreen} displayStyle={displayStyle} profile={profile} screenControl={screenControl} screenValue={screenValue} setScreenValue={setScreenValue} activity={activity} customLabels={customLabels} rename={(control, name) => { if (!locked) setCustomLabels(current => ({ ...current, [control.kind]: current[control.kind].map((label, i) => i === controlIndex(control.kind, control.id) ? name : label) })) }} selection={selection} selections={selections} select={selectUi} action={setNotice} values={values} setValue={setPreviewValue} ringMode={ringMode} compact />}
      </section>

      <aside className="sidebar" aria-label="Editing and MIDI tools">
        {tools}
        <PresetStorageNotice {...presetBank}/>
        <div className="connection"><OfflineStatus /><div className="connection-state"><MidiConnectionIndicator midi={midiLease} connected={connectedPair} activity={activity} /><span className="firmware-status studio-version" data-i18n-skip>Studio v{studioVersion}</span>{profile.device.firmwareObserved && <span className="firmware-status"><span>Firmware:</span> {profile.device.firmwareObserved}</span>}{bcIdentity && <span className="firmware-status" data-i18n-skip>{bcIdentity.text}</span>}</div><MidiStatus activity={activity} input={inputs.find(p => p.id === inputId)?.name ?? null} output={output?.name ?? null} open={() => setTab('config')} /><button className="help-toggle" aria-pressed={tab === 'help'} title="Help" aria-label="Help" onClick={() => setTab(current => current === 'help' ? 'control' : 'help')} data-i18n-skip>?</button><button className="floating-toggle" aria-pressed={floatOn} disabled={!floatingSupported()} title={floatingSupported() ? 'A bare always-on-top window with the screens, movable and resizable' : 'Needs a browser with picture-in-picture (Chrome, Edge, Brave, Safari)'} onClick={() => { void toggleFloatingDisplay() }}>{floatOn ? 'Close floating display' : 'Floating display'}</button><button className="primary" hidden={!!access?.sysexEnabled} title="Retry MIDI + SysEx" onClick={() => connect()} disabled={!supportsWebMidi()}><Icon name="midi" />Retry MIDI + SysEx</button><LanguagePicker /></div>
        <button className={`cc-toggle ${sendCC ? 'enabled' : ''}`} aria-pressed={sendCC} onClick={toggleSend} disabled={!isBcrOutput(output)}><Icon name={sendCC ? 'power' : 'send'} />{sendCC ? 'CC sending on · disable' : `Send CC to ${currentDevice.name}`}</button>
        <div className="history-tools" role="group" aria-label="Undo and redo"><button onClick={() => stepHistory('undo')} disabled={!historyCounts.undo} title="Undo (Cmd/Ctrl+Z), in this preset only"><span aria-hidden="true">↶</span> Undo <span className="history-count" data-i18n-skip>{historyCounts.undo}</span></button><button onClick={() => stepHistory('redo')} disabled={!historyCounts.redo} title="Redo (Cmd/Ctrl+Shift+Z)"><span aria-hidden="true">↷</span> Redo <span className="history-count" data-i18n-skip>{historyCounts.redo}</span></button></div>
        <nav className="tool-tabs" aria-label="Editor tools">{(['control', 'presets', 'files', 'config', 'log', 'help'] as const).map((item, i) => <button key={item} aria-pressed={tab === item} title={['Control', 'Presets', 'Files', 'Config', 'Log', 'Help'][i]} onClick={() => setTab(current => current === item && item !== 'control' ? 'control' : item)}><Icon name={(['sliders', 'folder', 'import', 'gear', 'log', 'help'] as const)[i]} />{['Control', 'Presets', 'Files', 'Config', 'Log', 'Help'][i]}</button>)}</nav>
        <div className="sidebar-content">
        <div className="tool-panel">
        <section className="profile-actions preset-panel" hidden={tab !== 'presets'} aria-label="Preset management">
          <h2>Presets{dirty ? ' *' : ''}</h2>
          <EditorPresetTools items={presets.map(p=>({key:p.id,name:p.name}))} selectedKey={presetId} name={presetName} locked={locked} onName={setPresetName} onSelect={recallPreset} onSave={savePreset} onError={e=>setNotice(String(e))} onDelete={()=>{if(lockedRef.current)throw Error('Editor configuration locked');if(window.confirm(translate('Delete this local preset?',language))){storeLibrary(items=>items.filter(p=>p.id!==presetId));setPresetId('')}}}>
          {currentDevice.bclModel && <details className="protocol-options"><summary data-i18n-skip>BCL preset parameters</summary><ParameterFields schema={bclSchema} scope="preset" state={presetParameterState(profile)} change={preset => setProfile(p => ({ ...p, parameters: { ...p.parameters, preset } }))} /></details>}
          </EditorPresetTools>
        </section>
        <section className="profile-actions config-appearance" hidden={tab !== 'config'}>
          <h2>Config</h2>
          <label className="device-model">Controller model<select value={currentDevice.id} disabled={!!environment} onChange={event => chooseDevice(event.target.value)}>{Object.values(devices).map(d => <option data-i18n-skip key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          {!environment && <p className="surface-help">Changing the model reloads the editor; each model keeps its own presets.</p>}
          {currentDevice.bclModel && <div className="bc-global"><h3>{`${currentDevice.name} global setup`}</h3><p className="surface-help" data-i18n-skip>Local configuration / BCL export · no device write.</p>
            <button disabled={!bcReady || bcBusy} onClick={() => void readGlobalFromDevice()}>{`Read from the ${currentDevice.name}`}</button>
            <ParameterFields schema={bclSchema} scope="global" state={profile.parameters?.global} change={global => setProfile(p => ({ ...p, parameters: { ...p.parameters, global } }))} />
            {bcGlobal && <table className="bc-global-table"><tbody>{([['midimode', 'MIDI mode'], ['startup', 'Startup preset'], ['footsw', 'Footswitch'], ['rxch', 'Receive channel'], ['deviceid', 'Device ID'], ['txinterval', 'Transmission interval (ms)'], ['deadtime', 'Dead time (ms)']] as const).map(([key, label]) => <tr key={key}><th>{label}</th><td data-i18n-skip>{bcGlobal[key] ?? '—'}</td></tr>)}</tbody></table>}</div>}
          <div className="theme-swatches" role="group" aria-label="Controller and interface theme"><Icon name="palette" />{themes.map(t => <button key={t.id} className={`theme-swatch swatch-${t.id}`} aria-label={`Theme ${t.name}`} aria-pressed={theme === t.id} title={t.name} onClick={() => setTheme(parseTheme(t.id))}><span className="sr-only">{t.name}</span><span className="swatch-tooltip" aria-hidden="true">{t.name}</span></button>)}</div>
          <label className="zoom-option"><input type="checkbox" checked={autoZoom} onChange={event => setAutoZoom(event.target.checked)} />Zoom while adjusting</label>
          <label className="zoom-option"><input type="checkbox" checked={showNumbers} onChange={event => setShowNumbers(event.target.checked)} />Show control numbers</label>
          <label className="zoom-option"><input type="checkbox" checked={nameScreen} onChange={event => setNameScreen(event.target.checked)} />Label screen</label>
          <div className="display-styles" role="group" aria-label="Display style"><h3>Display style</h3>{displayStyles.map(s => <button key={s.id} className="display-style-option" aria-pressed={displayStyle === s.id} onClick={() => setDisplayStyle(s.id)}><DisplayPreview style={s.id} /><span>{s.name}</span></button>)}</div>
          {currentDevice.features.globals && <DeviceSettings results={deviceSettings} settings={profile.settings ?? defaultSettings()} change={(cmd, value) => setProfile(current => ({ ...current, settings: withValue(cmd, value, current.settings ?? defaultSettings()) }))} autoLoad={autoLoadDevice} setAutoLoad={setAutoLoadDevice} canRead={brightnessEnabled} busy={deviceSettingsBusy} write={cmd => { void writeDeviceSetting(cmd) }} writeStatus={writeStatus} read={() => { void loadDeviceSettings() }} reset={() => { setDeviceSnapshot(null); setProfile(current => ({ ...current, settings: defaultSettings() })) }} />}
        </section>
        <section className="profile-actions preset-panel" hidden={tab !== 'files'} aria-label="Imports and exports">
          <h2>Files</h2>
          {currentDevice.features.frontPanelExport && <ExportImport dumps={dumps} apply={applyExportRecord} save={dump => download(new Uint8Array(dump.raw), `bcr32-export-block${dump.block}.syx`, 'application/octet-stream')} saveAll={list => download(new Uint8Array([...list].reverse().flatMap(d => d.raw)), `bcr32-exports-${list.length}.syx`, 'application/octet-stream')} />}
          {currentDevice.bclModel && <div className="bcl-files bc-read"><h3>{`Read from the ${currentDevice.name}`}</h3><p className="surface-help">Read requests only: the controller sends its preset as BCL text; nothing is written to it.</p>
            <div className="preset-actions"><button disabled={!bcReady || bcBusy} onClick={() => void readFromDevice('temporary')}><Icon name="import" />Read current preset</button><button disabled={!bcReady || bcBusy} onClick={() => void readNamesFromDevice()}>Read preset names</button></div>
            <div className="preset-actions"><select aria-label="Preset slot" value={bcSlot} onChange={event => setBcSlot(Number(event.target.value))}>{Array.from({ length: currentDevice.presetSlots }, (_, i) => i + 1).map(n => <option data-i18n-skip key={n} value={n}>{`P-${String(n).padStart(2, '0')}${bcNames.find(x => x.slot === n)?.name ? ` · ${bcNames.find(x => x.slot === n)!.name}` : ''}`}</option>)}</select><button disabled={!bcReady || bcBusy} onClick={() => void readFromDevice(bcSlot)}>Read this preset</button></div></div>}
          {currentDevice.bclModel && <div className="bcl-files"><h3>BCL files</h3><p className="surface-help">Text the controller reads (.bcr, .bcf, .txt) or the same lines as SysEx (.syx). Program Change, GS/XG, MMC and custom output are not converted yet. Nothing is sent to the controller.</p>
            <div className="preset-actions"><button onClick={() => exportBcl(false)}><Icon name="export" />Export BCL text</button><button onClick={() => exportBcl(true)}><Icon name="export" />Export SysEx (.syx)</button><label className="file">Import BCL or SysEx<input type="file" accept=".bcr,.bcf,.bc2,.txt,.bcl,.syx" onChange={event => { void importBcl(event.target.files?.[0]); event.target.value = '' }} /></label></div>
            {bclReport.length > 0 && <details open className="bcl-report"><summary><span>Not converted</span> · {bclReport.length}</summary><ul data-i18n-skip>{bclReport.slice(0, 200).map((u, n) => <li key={n}>{u.control}: {u.reason}</li>)}</ul></details>}</div>}
          <ParameterTable entries={parameterNames} save={saveParameterNames} download={download} />
          <div className="preset-actions"><button onClick={exportPreset} disabled={!presetName.trim()}><Icon name="export" />Export draft JSON</button><label className="file" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}><Icon name="import" />Import preset / bank<input type="file" accept="application/json,.json" onChange={event => { void importPresets(event.target.files?.[0]); event.target.value = '' }} /></label><button onClick={() => download(JSON.stringify(libraryFile(presets), null, 2), 'bcr32-presets.json')} disabled={!presets.length}><Icon name="folder" />Export library</button></div>
          {currentDevice.features.pdfSheet && <button className="primary" onClick={exportPdf} disabled={pdfBusy || !presetName.trim()}><Icon name="print" />{pdfBusy ? 'Preparing PDF…' : 'Download A4 PDF sheet'}</button>}
          {currentDevice.features.cubase && <div className="cubase-export"><h3>Cubase · MIDI Remote</h3><p className="surface-help">Surface script for Cubase 12 and later: encoders, pushes and buttons with their exact MIDI messages. No function is assigned: map them in Cubase with the Mapping Assistant.</p><p className="surface-help" data-i18n-skip><code>MIDI Remote/{cubaseFolder}/</code></p><button onClick={exportCubase}><Icon name="export" />Export Cubase script</button></div>}
          <details><summary>Legacy profile format</summary><div className="preset-actions"><button onClick={exportProfile}><Icon name="export" />Export profile v2</button><label className="file">Import profile v1/v2<input type="file" accept="application/json" onChange={event => { void importProfile(event.target.files?.[0]); event.target.value = '' }} /></label></div></details>
        </section>
    <section className="lower">
      <section className="ports" hidden={tab !== 'config'}>
        {currentDevice.features.studioConfig && <StudioConfig deviceSnapshot={deviceSnapshot} profile={profile} update={change=>setProfile(current=>({...current,settings:{...(current.settings??defaultSettings()),...change}}))} select={s=>{selectUi(s,{},true);setTab('control')}} brightness={brightness} draft={brightnessDraft} setDraft={n=>brightnessTransport.current?.set(n)} brightnessEnabled={brightnessEnabled} brightnessStatus={brightnessStatus} />}
        <div className="section-heading"><div><p className="eyebrow">WEB MIDI TRANSPORT</p><h2>Connection and probe</h2></div><span>{access?.sysexEnabled ? 'SysEx allowed' : 'SysEx not granted'}</span></div>
        <div className="fields ports-fields"><label>Input<select value={inputId} onChange={(event) => { setInputId(event.target.value); if (environment) changeOutput('') }}><option value="">Choose…</option>{inputs.map((port) => <option key={port.id} value={port.id}>{environment ? `${port.name ?? 'MIDI'} · ${port.id}` : port.name ?? port.id}</option>)}</select></label>
          <label>Output<select value={outputId} onChange={(event) => changeOutput(event.target.value)}><option value="">Choose…</option>{outputs.map((port) => <option key={port.id} value={port.id}>{environment ? `${port.name ?? 'MIDI'} · ${port.id}` : port.name ?? port.id}</option>)}</select></label>
          </div>
      </section>
      {tab === 'help' && <HelpPanel />}
      <section className="log" hidden={tab !== 'log'}><p className="eyebrow">MIDI LOG</p><h2>Recent messages</h2><ol>{events.length ? events.map((event, index) => <li key={`${event.hex}-${index}`}>{event.hex} · {event.text}{event.note && <span> · {event.note}</span>}</li>) : <li>No messages received.</li>}</ol></section>
    </section>
        </div>
        <section className="sidebar-meta">
          <p className="sidebar-notice" role="status">{notice}</p>
        </section>
      <section className={`inspector${currentDevice.bclModel && selections.length === 1 && inspectorView === 'text' ? ' text-mode' : ''}`} aria-label={`Edit ${selection.kind} ${selected.id}`}>
        <ControlSearch device={currentDevice} profile={profile} labels={customLabels} selection={selection} select={s=>selectUi(s,{},true)} />
        <p className="eyebrow">{selection.kind === 'buttons' ? 'PROGRAMMABLE BUTTON' : 'SELECTED ENCODER'}</p>
        <h2>{selection.kind === 'buttons' ? `Button ${selected.id}` : currentDevice.faders && selected.id >= currentDevice.faders.first ? `Fader ${selected.id - currentDevice.faders.first + 1}` : `Encoder ${selected.id}`}</h2>
        {currentDevice.bclModel && selections.length === 1 && <div className="action-tabs inspector-view" role="group" aria-label="Inspector view"><button aria-pressed={inspectorView === 'form'} onClick={() => setInspectorView('form')}>Form</button><button aria-pressed={inspectorView === 'text'} onClick={() => setInspectorView('text')}>BCL text</button></div>}
        {currentDevice.bclModel && selections.length === 1 && inspectorView === 'text' && <BclText model={currentDevice.bclModel} faders={currentDevice.faders} selection={selection} config={selected} profile={profile} presetName={presetName} apply={encoder => { const { id: _id, ...fields } = encoder; try { commitChange([selection], { ...fields, parameterOff: undefined, minimumOff: undefined }) } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) } }} />}
        {activeControls.length>0&&<ol className="activity-strip" aria-label="Active controls">{activeControls.slice(0,4).map(a=>{const value=a.control.kind==='encoders'?values[a.control.id]?.value:auxValues[a.control.kind][controlIndex(a.control.kind,a.control.id)];const source=a.control.kind==='encoders'?values[a.control.id]?.source:auxSources[`${a.control.kind}:${a.control.id}`];const percent=Math.round(a.share*100);return <li key={selectionKey(a.control)}><button aria-pressed={selectionKey(a.control)===selectionKey(selection)} onClick={()=>selectUi(a.control,{},true)}><span>{controlName(a.control)}</span><output>{value??'—'}</output><small>{source==='relative'?'relative estimate':source==='midi'?'MIDI received':'local preview'}</small><span className="activity-share" title={`${percent}% of pulses`}><span style={{width:`${percent}%`}} /></span></button></li>})}</ol>}
        <div className="selection-tools"><span>Selection · {selections.length}</span><button aria-pressed={mouseMulti} onClick={()=>setMouseMulti(current=>!current)}>Multi-select</button><button onClick={()=>{const list=profile[selection.kind].map(e=>({kind:selection.kind,id:e.id}));setSelections(list);selectionsRef.current=list}}>All</button>{(multiple||mouseMulti)&&<button onClick={()=>{setMouseMulti(false);selectUi(selection,{},true)}}>Single</button>}<button aria-pressed={learn.active} className="learn-toggle" onClick={toggleLearn}>Learn</button>{mouseMulti?<small>Click: add / remove</small>:<small data-i18n-skip>Cmd/Ctrl + click · Shift + click</small>}</div>
        {hardwareNotes().map(note => <p key={note} className="surface-help hardware-note" role="note">{note}</p>)}
        {learn.active&&<p className="surface-help learn-status" role="status">Learn · {learn.status}</p>}
        {mouseMulti&&<p className="surface-help">Drag on the background: rectangle selection.</p>}
        {is14Bit(selected) && <p className="surface-help">{modeText[selected.mode]} · 14 bits · {selected.type === 'nrpn' ? 'Data Entry CC 6 + 38' : `CC ${selected.parameter} + ${selected.parameter + 32}`}.</p>}
        {selected.type !== 'off' && transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' }) && <p className="surface-help" role="status">{transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' })}</p>}
        <label>Visual label<input maxLength={48} placeholder={multiple?'Mixed / batch label':'Default printed name'} value={sharedField(selections.map(s=>customLabels[s.kind][controlIndex(s.kind,s.id)]))} onChange={event => setCustomLabels(current => ({ ...current,...Object.fromEntries((['encoders','pushes','buttons'] as const).map(kind=>[kind,current[kind].map((label,i)=>selectedKeys.has(selectionKey({kind,id:profile[kind][i].id}))?cleanLabel(event.target.value):label)])) }))} /></label>
        <label className="zoom-option" data-i18n-skip><input type="checkbox" checked={selected.display !== false} onChange={e=>updateSelected({display:e.target.checked})} />Display On/Off</label>
        {selection.kind !== 'buttons' && profile.pushes.some(p => p.id === selection.id) && <div className="action-tabs"><button aria-pressed={selection.kind === 'encoders'} onClick={() => selectUi({ ...selection, kind: 'encoders' },{},true)}><Icon name="rotate" />Rotation</button><button aria-pressed={selection.kind === 'pushes'} onClick={() => selectUi({ ...selection, kind: 'pushes' },{},true)}><Icon name="push" />Push</button></div>}
        <p className="muted">{sendCC ? 'CC values sent · assignments unchanged.' : 'Receive / local preview · CC sending disabled.'}</p>
        {selection.kind === 'encoders' && <section className="value-preview">
          <label>Value · {values[selected.id]?.source === 'relative' ? 'relative estimate' : values[selected.id]?.source === 'midi' ? 'MIDI received' : sendCC ? 'UI adjustment' : 'local preview'}<output>{values[selected.id]?.value ?? '—'}</output>
            <input aria-label="Encoder value" type="range" min={selected.minimum} max={selected.maximum} value={values[selected.id]?.value ?? selected.minimum} onChange={event => setPreviewValue(selected.id, Number(event.target.value))} /></label>
          {isRelative(selected) && <div className="action-tabs"><button onClick={() => setPreviewValue(selected.id, (values[selected.id]?.value ?? selected.minimum) - 1)}>−1</button><button onClick={() => setPreviewValue(selected.id, (values[selected.id]?.value ?? selected.minimum) + 1)}>+1</button></div>}
          <p className="surface-help">{isRelative(selected) ? 'Relative: local reference, not hardware position. Up to 256 increments per sent gesture.' : 'Receive: matching channel and CC/NRPN parameter.'} Sending only when enabled; no configuration writes.</p>
        </section>}
        {selection.kind !== 'encoders' && <section className="value-preview"><label>Value · {auxSources[`${selection.kind}:${selection.id}`] === 'midi' ? 'MIDI received' : sendCC ? 'UI adjustment' : 'local preview'}<output>{auxValues[selection.kind][selectedIndex] ?? '—'}</output><input aria-label="Local button or push value" type="range" min={selected.minimum} max={selected.maximum} value={auxValues[selection.kind][selectedIndex] ?? selected.minimum} onChange={event => setAuxValue(selection, Number(event.target.value))} /></label>
          <button onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); pressSelected(true) }} onPointerUp={() => pressSelected(false)} onPointerCancel={() => pressSelected(false)}
            onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) pressSelected(true) } }} onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); pressSelected(false) } }}
            onBlur={() => { if (selected.mode === 'momentary') pressSelected(false) }}><Icon name="push" />Test press / release</button>
          <p className="surface-help">{selected.mode === 'momentary' ? 'Tog Off: maximum on press, minimum on release.' : selected.mode === 'toggle' ? 'Tog On: alternate maximum and minimum on each press.' : 'Inc: add the step on each press, clamped to the range.'} Clicking the panel only selects a control.</p>
        </section>}
        {!!selectedRotations.length && (!currentDevice.ringModes || selectedRotations.some(e=>currentDevice.ringModes!(e.selection.id).length>1)) && <label>LED ring<select value={batchLed} onChange={event=>updateSelected({ledMode:event.target.value as LedMode})}>{batchLed===''&&<option value="" disabled>Mixed</option>}{ledModes.filter(mode=>!currentDevice.ringModes||selectedRotations.every(e=>currentDevice.ringModes!(e.selection.id).includes(mode))).map(mode=><option data-i18n-skip key={mode} value={mode}>{ledModeLabel[mode]}</option>)}</select></label>}
        <div className="fields two"><label>Type<select value={batchType} onChange={(event) => updateSelected({ type: event.target.value as EncoderType })}>
          {batchType===''&&<option value="" disabled>Mixed</option>}{Array.from(new Set([...(multiple?[]:[selected.type]),...commonTypes])).map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
        </select></label>
        <label>Mode<select disabled={!commonModes.length} value={batchMode} onChange={(event) => updateSelected({ mode: event.target.value as EncoderMode })}>
          {batchMode===''&&<option value="" disabled>Mixed</option>}{Array.from(new Set([...(multiple?[]:[selected.mode]), ...commonModes])).map((mode) => <option key={mode} value={mode}>{selection.kind !== 'encoders' && mode === 'inc_dec' ? 'Inc' : modeText[mode]}</option>)}
        </select></label></div>
        {selected.type !== 'mmc' && <div className="fields two"><label>Channel<input type="number" min="1" max="16" value={selected.channel} onChange={(event) => updateSelected({ channel: Number(event.target.value) })} /></label>
          <label>{selected.type === 'pc' ? 'Bank number' : selected.type === 'note' ? 'Note number' : 'CC / Parameter'}<input disabled={multiple} title={multiple?'Parameter: individual editing only':undefined} type="number" min="0" max={selection.kind === 'encoders' ? parameterLimit(selected) : 127} value={selected.parameter} onClick={() => setParameterOpen(n => n + 1)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setParameterOpen(n => n + 1) } }} onChange={(event) => updateSelected({ parameter: Number(event.target.value) })} /></label></div>}
        {selected.type !== 'mmc' && !multiple && <ParameterPicker config={selected} entries={parameterNames} save={saveParameterNames} choose={parameter => updateSelected({ parameter })} openSignal={parameterOpen} />}
        {selected.type === 'at' && selection.kind !== 'encoders' && <label className="zoom-option" data-i18n-skip><input disabled={multiple} type="checkbox" checked={!!selected.aftertouchAll} onChange={e=>updateSelected({aftertouchAll:e.target.checked})} />Aftertouch: All</label>}
        {selected.type === 'cc' && selection.kind === 'encoders' && <label className="zoom-option" data-i18n-skip><input disabled={multiple} type="checkbox" checked={!!selected.parameterOff} onChange={e=>updateSelected({parameterOff:e.target.checked})} />Parameter Off</label>}
        {selected.type === 'pc' && selection.kind === 'encoders' && <label className="zoom-option" data-i18n-skip><input type="checkbox" checked={!!selected.minimumOff} onChange={e=>updateSelected({minimumOff:e.target.checked})} />Minimum Off</label>}
        {selected.type === 'mmc' && (()=>{const m=selected.mmc??{deviceId:'all' as const,command:'Play' as const,locate:[0,0,0,0],frameRate:'off' as const};const update=(change:Partial<typeof m>)=>updateSelected({mmc:change});return <div className="mmc-config" data-i18n-skip>
          <label>MMC Device ID<select value={m.deviceId} onChange={e=>update({deviceId:e.target.value==='all'?'all':Number(e.target.value)})}><option value="all">All</option>{Array.from({length:127},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label>
          <label>MMC command<select disabled={multiple} value={m.command} onChange={e=>update({command:e.target.value as typeof m.command})}>{mmcCommands.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Frame rate<select value={m.frameRate} onChange={e=>update({frameRate:e.target.value as typeof m.frameRate})}>{['off','24','25','30','30d'].map(v=><option key={v}>{v}</option>)}</select></label>
          {[0,1].map(i=><label className="zoom-option" key={i}><input type="checkbox" checked={m.locateOff?.[i]??false} onChange={e=>update({locateOff:[0,1].map(j=>j===i?e.target.checked:m.locateOff?.[j]??false)})} />{i===0?'HH:MM':'SS:FF'} Off</label>)}
          <div className="fields two">{['HH','MM','SS','FF'].map((v,i)=><label key={v}>{v}<input disabled={m.locateOff?.[Math.floor(i/2)]??false} type="number" min="0" max="127" value={m.locate[i]} onChange={e=>update({locate:m.locate.map((n,j)=>j===i?Math.max(0,Math.min(127,Math.round(Number(e.target.value)||0))):n)})} /></label>)}</div>
        </div>})()}
        {selected.type !== 'mmc' && <div className="fields two"><label>Minimum<input type="number" min="0" max={valueLimit(selected)} value={selected.minimum} onChange={(event) => updateSelected({ minimum: Number(event.target.value) })} /></label>
          <label>{selected.type === 'note' ? 'Velocity' : selected.type === 'pc' ? 'Program maximum' : 'Maximum'}<input type="number" min="0" max={valueLimit(selected)} value={selected.maximum} onChange={(event) => updateSelected({ maximum: Number(event.target.value) })} /></label></div>}
        {selection.kind !== 'encoders' && selected.mode === 'inc_dec' && <label>Step per press<input type="number" min="-127" max="127" value={selected.increment ?? 1} onChange={event => updateSelected({ increment: Number(event.target.value) })} /></label>}
        {currentDevice.bclModel && !multiple && <details className="protocol-options" open><summary data-i18n-skip>BCL parameters</summary><BclParameters key={`${selection.kind}:${selection.id}`} config={selected} capabilities={currentDevice.faders && selection.id >= currentDevice.faders.first + (currentDevice.faders.physicalCount ?? currentDevice.faders.count) ? [] : ['motor']} scope={selection.kind !== 'encoders' ? 'button' : currentDevice.faders && selection.id >= currentDevice.faders.first ? 'fader' : 'encoder'} change={encoder => { const { id: _id, ...fields } = encoder; commitChange([selection], fields) }} /></details>}
      </section>

        </div>
      </aside>
    </section>
    <details className="console" open={monitorOpen} onToggle={event => setMonitorOpen(event.currentTarget.open)}>
      <summary>MIDI monitor</summary>
      <MidiMonitor monitor={monitor} control={monitorControl} canApply={selections.length > 0} apply={applyMessage} />
    </details>
  </main>, language)
}

export default App
