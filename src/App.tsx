import { useEffect, useMemo, useRef, useState } from 'react'
import { version as studioVersion } from '../package.json'
import { createProfile, parseProfile, valueLimit, parameterLimit, is14Bit, isRelative, modesFor, typesFor, mmcCommands, defaultSettings, type Bcr32Profile, type Encoder, type EncoderMode, type EncoderType } from './profile'
import { FrontPanel, type Selection, type LiveValues } from './FrontPanel'
import { encoderMessages, createCcSender, isBcrOutput } from './cc-transport'
import { asHex, describeMessage, isSystemRealtime, parseFirmwareReply, productQuery, supportsWebMidi, type MidiAccess, type MidiPort } from './web-midi'
import { associateDefaultEncoder, automaticMidiAccess, automaticPorts } from './auto-midi'
import { loadTheme, parseTheme, themes, themeStorageKey } from './themes'
import { Icon } from './Icon'
import { ledModes, ledModeLabel, type LedMode } from './led-modes'
import { LanguagePicker, translatedTree, useLanguage, translate } from './i18n'
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

const storageKey = 'bcr32-studio.profile.v1'
// Log lines keep hex and description apart so translatedTree can translate the description alone.
type LogLine = { hex: string; text: string; note?: string }
// Fetched once per page; the PDF export used to reload the 556 KB font on every export.
let pdfFont: Promise<ArrayBuffer> | null = null
const workspaceKey = 'bcr32-studio.workspace.v1'

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

function App() {
  const language = useLanguage()
  const [initial] = useState(loadDraft)
  const [theme, setTheme] = useState(loadTheme)
  const [parameterNames, setParameterNames] = useState(loadNames)
  const [parameterOpen, setParameterOpen] = useState(0)
  const saveParameterNames = (entries: ParameterName[]) => {
    try { window.localStorage.setItem(parameterNamesKey, JSON.stringify(namesFile(entries))); setParameterNames(entries) }
    catch { setNotice('Table not saved: local storage unavailable.') }
  }
  const [autoZoom, setAutoZoom] = useState(() => { try { return window.localStorage.getItem('bcr32-studio.auto-zoom') === 'true' } catch { return false } })
  useEffect(() => { try { window.localStorage.setItem('bcr32-studio.auto-zoom', String(autoZoom)) } catch { /* Optional preference. */ } }, [autoZoom])
  const [tab, setTab] = useState<'control' | 'config' | 'log' | 'presets' | 'files'>('control')
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
  const [values, setValues] = useState<LiveValues>(() => Object.fromEntries(initial.values.encoders.flatMap((v, i) => v === null ? [] : [[i + 1, { value: v, source: 'local' as const }]])))
  const liveRef = useRef(values); liveRef.current = values
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

  const inputs = useMemo(() => access ? Array.from(access.inputs.values()) : [], [access, portVersion])
  const outputs = useMemo(() => access ? Array.from(access.outputs.values()) : [], [access, portVersion])
  const output = outputs.find(port => port.id === outputId)
  const brightnessEnabled = !!access?.sysexEnabled && isBcrOutput(output) && inputs.some(p=>p.id===inputId && p.state==='connected' && /BCR[- ]?32/i.test(p.name??''))
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
    try { window.localStorage.setItem(draftStorageKey, JSON.stringify(draft)) }
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
    try { window.localStorage.setItem(workspaceKey, JSON.stringify({ id: presetId, name: presetName })) } catch { /* Preset export remains available. */ }
  }, [presetId, presetName])
  useEffect(() => {
    try { window.localStorage.setItem(themeStorageKey, theme) } catch { /* Theme remains usable without local storage. */ }
  }, [theme])


  const stopEmission = () => { sender.current?.close(); sender.current = null; heldButton.current = null; setSendCC(false) }
  const storeLibrary = (next: ControllerPreset[]) => {
    // Persist before updating state: a quota error must not pretend the save succeeded.
    window.localStorage.setItem(presetStorageKey, JSON.stringify(libraryFile(next)))
    setPresets(next)
  }
  const recallState = (state: ControllerState) => {
    stopEmission(); disarmLearn()
    setSelections([selection]);selectionsRef.current=[selection]
    setAuxSources({})
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
      if (!pdfFont) pdfFont = fetch('/fonts/NotoSans-Regular.ttf').then(response => { if (!response.ok) throw new Error('PDF font unavailable'); return response.arrayBuffer() }).catch(error => { pdfFont = null; throw error })
      const { presetPdf } = await import('./preset-pdf')
      const bytes = await presetPdf(p, new Uint8Array((await pdfFont).slice(0)))
      download(bytes.buffer as ArrayBuffer, `bcr32-${fileStem(p.name)}-A4.pdf`, 'application/pdf')
      setNotice('A4 PDF downloaded: panel and current draft assignments. Reduced sheet, not a 1:1 template.')
    } catch (error) { setNotice(`PDF failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setPdfBusy(false) }
  }

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(profile)) } catch { /* Draft persistence reports errors above. */ }
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
    if (!sendCC || !isBcrOutput(output)) return
    const transport = createCcSender(bytes => {
      if (!isBcrOutput(output)) throw new Error('BCR32 output disconnected')
      output.send!(bytes)
    }, bytes => { pulseActivity('send'); setEvents(current => [{ hex: `→ ${asHex(bytes)}`, text: describeMessage(bytes), note: 'value sent' }, ...current].slice(0, 12)) }, error => {
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
      // Clock (F8) and active sensing (FE) touch no React state: no activity pulse, no log line, no App render.
      if (data.length && !isSystemRealtime(data)) {
        pulseActivity('receive')
        setEvents((current) => [{ hex: asHex(data), text: describeMessage(data) }, ...current].slice(0, 12))
      }
      brightnessTransport.current?.receive(data)
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
    setNotice(enabled ? 'CC sending enabled: UI gestures send values to BCR32, not assignments.' : 'CC sending disabled: reception and local preview only.')
  }

  const connect = async () => {
    if (connecting.current) return
    connecting.current = true
    automaticEmissionPort.current = null
    sender.current?.close(); sender.current = null; setSendCC(false)
    try {
      const { access: midi, sysexError } = await automaticMidiAccess()
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

  // Declared after the receive effect: attach the listener before probing.
  useEffect(() => {
    const input = inputs.find(p => p.id === inputId && p.state === 'connected' && /BCR[- ]?32/i.test(p.name ?? ''))
    if (!access?.sysexEnabled || !input || !isBcrOutput(output)) { probedPair.current = null; return }
    if (probedPair.current?.access === access && probedPair.current.input === input && probedPair.current.output === output) return
    probedPair.current = { access, input, output }
    try {
      output.send!(productQuery)
      pulseActivity('send')
      setEvents(current => [{ hex: `→ ${asHex(productQuery)}`, text: 'automatic product/firmware probe (read-only)' }, ...current].slice(0, 12))
    } catch (error) { setNotice(`Automatic probe failed: ${error instanceof Error ? error.message : String(error)}`) }
  }, [access, inputId, inputs, output, portVersion])

  // Single validation path for the inspector and MIDI Learn: applySelectionChange, then clamp live values of the targets.
  const commitChange = (targets: Selection[], change: ControlChange) => {
    const keys=new Set(targets.map(selectionKey))
    const next=applySelectionChange(profileRef.current,targets,change)
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
      output.send!(bytes);pulseActivity('send')
      setEvents(current=>[{hex:`→ ${asHex(bytes)}`,text:'LED brightness'},...current].slice(0,12))
    },state=>{setBrightness(state.value);setBrightnessDraft(state.draft);setBrightnessStatus(state.status)})
    brightnessTransport.current=transport;transport.read()
    return ()=>{transport.close();if(brightnessTransport.current===transport)brightnessTransport.current=null}
  },[access,inputId,output,brightnessEnabled,portVersion])
  useEffect(()=>{if(tab==='config'&&brightness===null)brightnessTransport.current?.read()},[tab])

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

  return translatedTree(<main className="studio compact" data-theme={theme} onKeyDown={event=>{if(event.key!=='Escape')return;if(learn.active){cancelLearn();event.preventDefault()}else if(multiple||mouseMulti){setMouseMulti(false);selectUi(selection,{},true);event.preventDefault()}}}>
    <section className="workspace">
      <section className="surface" aria-label="BCR-32 encoders">
        <FrontPanel selectMany={selectMany} mouseMulti={mouseMulti} autoZoom={autoZoom} profile={profile} screenControl={screenControl} screenValue={screenControl.kind === 'encoders' ? { value: values[screenControl.id]?.value ?? null, source: values[screenControl.id]?.source ?? 'local' } : { value: auxValues[screenControl.kind][controlIndex(screenControl.kind, screenControl.id)], source: auxSources[`${screenControl.kind}:${screenControl.id}`] ?? 'local' }} setScreenValue={setScreenValue} activity={activity} customLabels={customLabels} rename={(control, name) => setCustomLabels(current => ({ ...current, [control.kind]: current[control.kind].map((label, i) => i === controlIndex(control.kind, control.id) ? name : label) }))} selection={selection} selections={selections} select={selectUi} action={setNotice} values={values} setValue={setPreviewValue} ringMode={ringMode} compact />
      </section>

      <aside className="sidebar" aria-label="Editing and MIDI tools">
        <div className="connection"><div className="connection-state"><span className={access ? 'status live' : 'status'}>{access ? 'MIDI ready' : 'automatic connection'}</span><span className="firmware-status studio-version" data-i18n-skip>Studio v{studioVersion}</span>{profile.device.firmwareObserved && <span className="firmware-status"><span>Firmware:</span> {profile.device.firmwareObserved}</span>}</div><button className="primary" hidden={!!access?.sysexEnabled} onClick={() => connect()} disabled={!supportsWebMidi()}><Icon name="midi" />Retry MIDI + SysEx</button><LanguagePicker /></div>
        <button className={`cc-toggle ${sendCC ? 'enabled' : ''}`} aria-pressed={sendCC} onClick={toggleSend} disabled={!isBcrOutput(output)}><Icon name={sendCC ? 'power' : 'send'} />{sendCC ? 'CC sending on · disable' : 'Send CC to BCR32'}</button>
        <nav className="tool-tabs" aria-label="Editor tools">{(['control', 'presets', 'files', 'config', 'log'] as const).map((item, i) => <button key={item} aria-pressed={tab === item} title={['Control', 'Presets', 'Files', 'Config', 'Log'][i]} onClick={() => setTab(item)}><Icon name={(['sliders', 'folder', 'import', 'sliders', 'log'] as const)[i]} />{['Control', 'Presets', 'Files', 'Config', 'Log'][i]}</button>)}</nav>
        <div className="sidebar-content">
        <section className="profile-actions preset-panel" hidden={tab !== 'presets'} aria-label="Preset management">
          <h2>Presets{dirty ? ' *' : ''}</h2>
          <select aria-label="Load preset" value={presetId} onChange={event => recallPreset(event.target.value)}><option value="">Draft · choose a preset</option>{presets.map(p => <option data-i18n-skip key={p.id} value={p.id}>{p.name}</option>)}</select>
          <label>Preset name<input maxLength={80} value={presetName} onChange={event => setPresetName(event.target.value.replace(/[\u0000-\u001f\u007f]/g, ' '))} /></label>
          <div className="preset-actions"><button className="primary" onClick={() => savePreset()} disabled={!presetName.trim()}><Icon name="save" />{activePreset ? 'Save / rename' : 'Create preset'}</button><button onClick={() => savePreset(true)} disabled={!presetName.trim()}><Icon name="copy" />Save as new</button></div>
        </section>
        <section className="profile-actions config-appearance" hidden={tab !== 'config'}>
          <h2>Config</h2>
          <div className="theme-swatches" role="group" aria-label="Controller and interface theme"><Icon name="palette" />{themes.map(t => <button key={t.id} className={`theme-swatch swatch-${t.id}`} aria-label={`Theme ${t.name}`} aria-pressed={theme === t.id} title={t.name} onClick={() => setTheme(parseTheme(t.id))}><span className="sr-only">{t.name}</span><span className="swatch-tooltip" aria-hidden="true">{t.name}</span></button>)}</div>
          <label className="zoom-option"><input type="checkbox" checked={autoZoom} onChange={event => setAutoZoom(event.target.checked)} />Zoom while adjusting</label>
        </section>
        <section className="profile-actions preset-panel" hidden={tab !== 'files'} aria-label="Imports and exports">
          <h2>Files</h2>
          <ParameterTable entries={parameterNames} save={saveParameterNames} download={download} />
          <div className="preset-actions"><button onClick={exportPreset} disabled={!presetName.trim()}><Icon name="export" />Export draft JSON</button><label className="file" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}><Icon name="import" />Import preset / bank<input type="file" accept="application/json,.json" onChange={event => { void importPresets(event.target.files?.[0]); event.target.value = '' }} /></label><button onClick={() => download(JSON.stringify(libraryFile(presets), null, 2), 'bcr32-presets.json')} disabled={!presets.length}><Icon name="folder" />Export library</button></div>
          <button className="primary" onClick={exportPdf} disabled={pdfBusy || !presetName.trim()}><Icon name="print" />{pdfBusy ? 'Preparing PDF…' : 'Download A4 PDF sheet'}</button>
          <div className="cubase-export"><h3>Cubase · MIDI Remote</h3><p className="surface-help">Surface script for Cubase 12 and later: encoders, pushes and buttons with their exact MIDI messages. No function is assigned: map them in Cubase with the Mapping Assistant.</p><p className="surface-help" data-i18n-skip><code>MIDI Remote/{cubaseFolder}/</code></p><button onClick={exportCubase}><Icon name="export" />Export Cubase script</button></div>
          <details><summary>Legacy profile format</summary><div className="preset-actions"><button onClick={exportProfile}><Icon name="export" />Export profile v2</button><label className="file">Import profile v1/v2<input type="file" accept="application/json" onChange={event => { void importProfile(event.target.files?.[0]); event.target.value = '' }} /></label></div></details>
        </section>
        <section className="sidebar-meta">
          <p className="sidebar-notice" role="status">{notice}</p>
        </section>
      <section className="inspector" hidden={tab !== 'control'} aria-label={`Edit ${selection.kind} ${selected.id}`}>
        <ControlSearch profile={profile} labels={customLabels} selection={selection} select={s=>selectUi(s,{},true)} />
        <p className="eyebrow">{selection.kind === 'buttons' ? 'PROGRAMMABLE BUTTON' : 'SELECTED ENCODER'}</p>
        <h2>{selection.kind === 'buttons' ? 'Button' : 'Encoder'} {selected.id}</h2>
        {activeControls.length>0&&<ol className="activity-strip" aria-label="Active controls">{activeControls.slice(0,4).map(a=>{const value=a.control.kind==='encoders'?values[a.control.id]?.value:auxValues[a.control.kind][controlIndex(a.control.kind,a.control.id)];const source=a.control.kind==='encoders'?values[a.control.id]?.source:auxSources[`${a.control.kind}:${a.control.id}`];const percent=Math.round(a.share*100);return <li key={selectionKey(a.control)}><button aria-pressed={selectionKey(a.control)===selectionKey(selection)} onClick={()=>selectUi(a.control,{},true)}><span>{controlName(a.control)}</span><output>{value??'—'}</output><small>{source==='relative'?'relative estimate':source==='midi'?'MIDI received':'local preview'}</small><span className="activity-share" title={`${percent}% of pulses`}><span style={{width:`${percent}%`}} /></span></button></li>})}</ol>}
        <div className="selection-tools"><span>Selection · {selections.length}</span><button aria-pressed={mouseMulti} onClick={()=>setMouseMulti(current=>!current)}>Multi-select</button><button onClick={()=>{const list=profile[selection.kind].map(e=>({kind:selection.kind,id:e.id}));setSelections(list);selectionsRef.current=list}}>All</button>{(multiple||mouseMulti)&&<button onClick={()=>{setMouseMulti(false);selectUi(selection,{},true)}}>Single</button>}<button aria-pressed={learn.active} className="learn-toggle" onClick={toggleLearn}>Learn</button>{mouseMulti?<small>Click: add / remove</small>:<small data-i18n-skip>Cmd/Ctrl + click · Shift + click</small>}</div>
        {learn.active&&<p className="surface-help learn-status" role="status">Learn · {learn.status}</p>}
        {mouseMulti&&<p className="surface-help">Drag on the background: rectangle selection.</p>}
        {is14Bit(selected) && <p className="surface-help">{modeText[selected.mode]} · 14 bits · {selected.type === 'nrpn' ? 'Data Entry CC 6 + 38' : `CC ${selected.parameter} + ${selected.parameter + 32}`}.</p>}
        {selected.type !== 'off' && transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' }) && <p className="surface-help" role="status">{transportIssue(selection.kind === 'encoders' ? selected : { ...selected, mode: 'absolute' })}</p>}
        <label>Visual label<input maxLength={48} placeholder={multiple?'Mixed / batch label':'Default printed name'} value={sharedField(selections.map(s=>customLabels[s.kind][controlIndex(s.kind,s.id)]))} onChange={event => setCustomLabels(current => ({ ...current,...Object.fromEntries((['encoders','pushes','buttons'] as const).map(kind=>[kind,current[kind].map((label,i)=>selectedKeys.has(selectionKey({kind,id:profile[kind][i].id}))?cleanLabel(event.target.value):label)])) }))} /></label>
        <label className="zoom-option" data-i18n-skip><input type="checkbox" checked={selected.display !== false} onChange={e=>updateSelected({display:e.target.checked})} />Display On/Off</label>
        {selection.kind !== 'buttons' && <div className="action-tabs"><button aria-pressed={selection.kind === 'encoders'} onClick={() => selectUi({ ...selection, kind: 'encoders' },{},true)}><Icon name="rotate" />Rotation</button><button aria-pressed={selection.kind === 'pushes'} onClick={() => selectUi({ ...selection, kind: 'pushes' },{},true)}><Icon name="push" />Push</button></div>}
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
        {!!selectedRotations.length && <label>LED ring<select value={batchLed} onChange={event=>updateSelected({ledMode:event.target.value as LedMode})}>{batchLed===''&&<option value="" disabled>Mixed</option>}{ledModes.map(mode=><option data-i18n-skip key={mode} value={mode}>{ledModeLabel[mode]}</option>)}</select></label>}
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
      </section>

    <section className="lower">
      <section className="ports" hidden={tab !== 'config'}>
        <StudioConfig profile={profile} update={change=>setProfile(current=>({...current,settings:{...(current.settings??defaultSettings()),...change}}))} select={s=>{selectUi(s,{},true);setTab('control')}} brightness={brightness} draft={brightnessDraft} setDraft={n=>brightnessTransport.current?.set(n)} brightnessEnabled={brightnessEnabled} brightnessStatus={brightnessStatus} />
        <div className="section-heading"><div><p className="eyebrow">WEB MIDI TRANSPORT</p><h2>Connection and probe</h2></div><span>{access?.sysexEnabled ? 'SysEx allowed' : 'SysEx not granted'}</span></div>
        <div className="fields ports-fields"><label>Input<select value={inputId} onChange={(event) => setInputId(event.target.value)}><option value="">Choose…</option>{inputs.map((port) => <option key={port.id} value={port.id}>{port.name ?? port.id}</option>)}</select></label>
          <label>Output<select value={outputId} onChange={(event) => changeOutput(event.target.value)}><option value="">Choose…</option>{outputs.map((port) => <option key={port.id} value={port.id}>{port.name ?? port.id}</option>)}</select></label>
          </div>
      </section>
      <section className="log" hidden={tab !== 'log'}><p className="eyebrow">MIDI LOG</p><h2>Recent messages</h2><ol>{events.length ? events.map((event, index) => <li key={`${event.hex}-${index}`}>{event.hex} · {event.text}{event.note && <span> · {event.note}</span>}</li>) : <li>No messages received.</li>}</ol></section>
    </section>
        </div>
      </aside>
    </section>
  </main>, language)
}

export default App
