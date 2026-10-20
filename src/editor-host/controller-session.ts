import type { DeviceDefinition } from '../device-definition'
import { createProfile } from '../profile'
import { cleanLabel, controlIndex, emptyLabels, emptyValues, parseControllerState, type ControllerState } from '../presets'
import { applyChange, createMidiDecoder, decoderKey, type Control } from '../controller-midi'
import { createCcSender, encoderMessages } from '../cc-transport'
import { createHistory } from '../history'
import type { MidiAuthorization } from './midi-broker'
import type { ControllerSnapshot, EditorContext, EditorSession, EditorAction } from './contracts'
import type {ControlActivity} from './interaction-feedback'

// One factory invocation = one draft/history/decoder/queue. Explicit model never changes the legacy page singleton.
export function createControllerSession(device: DeviceDefinition, context: EditorContext, restored?: unknown): EditorSession {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  let state: ControllerState = restored === undefined
    ? { profile: createProfile(device), labels: emptyLabels(device), values: emptyValues(device), ringMode: 'bar' }
    : parseControllerState(restored, device)
  let selection: Control | null = null, locked = false, sending = false, disposed = false, lastError: string | null = null
  let activeControl: Control | null = null
  let activity:ControlActivity|null=null
  const describeActivity=(control:Control,source:ControlActivity['source'])=>{
    const i=controlIndex(control.kind,control.id,device)
    activity={controlId:`${control.kind}:${control.id}`,label:state.labels[control.kind][i]||device.printedName(control.kind,control.id),value:state.values[control.kind][i],source}
  }
  let valueSources: Record<string, 'local' | 'midi' | 'relative'> = {}
  let key = decoderKey(state.profile, device), decode = createMidiDecoder(state.profile, device)
  let authorization: MidiAuthorization | null = null
  const subscribers = new Set<() => void>(), history = createHistory()
  const config = () => JSON.stringify({ profile: state.profile, labels: state.labels, ringMode: state.ringMode })
  history.arrive('draft', config())
  const notify = () => { for (const fn of subscribers) { try { fn() } catch { /* observer isolation */ } } }
  const ensure = () => { if (disposed) throw Error('Editor session disposed') }
  const indexFor = (c: Control) => {
    const index = controlIndex(c.kind, c.id, device)
    if (!['encoders', 'pushes', 'buttons'].includes(c.kind) || index < 0 || !state.profile[c.kind]?.[index] || state.profile[c.kind][index].id !== c.id) throw Error('Unknown editor control')
    return index
  }
  const refreshDecoder = () => {
    const next = decoderKey(state.profile, device)
    if (next !== key) { key = next; decode = createMidiDecoder(state.profile, device) }
  }
  let sender = newSender()
  function newSender() {
    // Capture the grant when this queue is created; stale queues can never borrow a future connection's token.
    const grant = authorization
    return createCcSender(bytes => {
      if (!grant || !sending || disposed) throw Error('Value sending disabled')
      context.midi.send([bytes], grant)
    }, () => {}, error => { lastError = error instanceof Error ? error.message : String(error); sending = false; notify() }, 33, device)
  }
  const stopSending = () => { sending = false; authorization = null; sender.close(); sender = newSender() }
  const offState = context.midi.onState(() => {
    stopSending();activity=null; decode = createMidiDecoder(state.profile, device); notify()
  })
  const offInput = context.midi.subscribe(packet => {
    if (disposed) return
    const changes = decode(packet.bytes)
    for (const change of changes) {
      const i = indexFor(change.control), e = state.profile[change.control.kind][i]
      const next = applyChange(e, { value: state.values[change.control.kind][i], source: 'midi' }, change)
      state.values[change.control.kind][i] = next.value
      valueSources[`${change.control.kind}:${change.control.id}`] = next.source
      activeControl = { ...change.control }
      describeActivity(change.control,'hardware')
    }
    if (changes.length) notify() // reception is never enqueued for output, even in a locked/background editor
  })
  const session = {
    getSnapshot(): ControllerSnapshot { return clone({ state, selection, activeControl, activity, valueSources, locked, sending, history: history.counts('draft'), lastError }) },
    subscribe(fn: () => void) { ensure(); subscribers.add(fn); return () => { subscribers.delete(fn) } },
    dispatch(raw: unknown) {
      ensure()
      if (!raw || typeof raw !== 'object' || !['select','value','configure','label','replace','undo','redo'].includes((raw as EditorAction).type)) throw Error('Unknown controller action')
      const action = raw as EditorAction
      if (action.type === 'select') { if (action.control) indexFor(action.control); selection = action.control ? { ...action.control } : null;if(selection)describeActivity(selection,'selection');else activity=null; notify(); return }
      if (action.type === 'value') {
        const i = indexFor(action.control), e = state.profile[action.control.kind][i]
        if (!Number.isInteger(action.value) || action.value < e.minimum || action.value > e.maximum || e.type === 'off') throw Error('Invalid value gesture')
        const previous = state.values[action.control.kind][i], messages = encoderMessages(e, action.value, previous ?? undefined, device)
        state.values[action.control.kind][i] = action.value
        valueSources[`${action.control.kind}:${action.control.id}`] = 'local'
        activeControl = { ...action.control }
        describeActivity(action.control,'ui')
        if (sending && messages) {
          if (e.mode === 'absolute' && action.control.kind === 'encoders') sender.enqueueMessages(messages)
          else sender.enqueueOrdered(messages)
        }
        notify(); return
      }
      if (locked) throw Error('Editor configuration locked')
      if (action.type === 'undo' || action.type === 'redo') {
        const saved = history[action.type]('draft')
        if (saved) { stopSending(); state = parseControllerState({ ...state, ...JSON.parse(saved), values: emptyValues(device) }, device); valueSources = {}; activeControl = null;activity=null; refreshDecoder() }
        notify(); return
      }
      let next = clone(state)
      if (action.type === 'replace') {
        next = parseControllerState(action.state, device); stopSending(); valueSources = {}; activeControl = null
      } else {
        const i = indexFor(action.control)
        if (action.type === 'configure') {
          if (action.patch.id !== undefined && action.patch.id !== action.control.id) throw Error('Cannot change a control ID')
          next.profile[action.control.kind][i] = { ...next.profile[action.control.kind][i], ...action.patch }
          // Old values may exceed a newly reduced range/mode. Mark unknown, do not manufacture hardware feedback.
          next.values[action.control.kind][i] = null
          stopSending() // queued messages encoded under an old assignment cannot escape after an edit
        } else next.labels[action.control.kind][i] = cleanLabel(action.value)
        next = parseControllerState(next, device)
      }
      state = next;activity=null; refreshDecoder(); history.record('draft', config(), context.now()); lastError = null; notify()
    },
    serialize() { ensure(); return clone(state) },
    setLocked(value: boolean) { ensure(); if (typeof value !== 'boolean') throw Error('Invalid lock'); locked = value; notify() },
    setSending(enabled: boolean, grant?: MidiAuthorization) {
      ensure(); if (typeof enabled !== 'boolean' || enabled && !grant) throw Error('Host authorization is required to enable sending')
      stopSending()
      if (enabled) { authorization = grant!; sending = true; sender.close(); sender = newSender() }
      notify()
    },
    dispose() { if (disposed) return; disposed = true; stopSending(); offInput(); offState(); context.midi.dispose(); subscribers.clear() },
  }
  return session
}
export type ControllerSession = ReturnType<typeof createControllerSession>
