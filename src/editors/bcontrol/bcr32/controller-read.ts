import { createTargetReader, targetFields, type TargetField, type TargetValue } from './firmware-codec'
import { modesFor, parseProfile, rotationModes, type Bcr32Profile, type Encoder, type EncoderType } from './profile'
import { ledModes } from './led-modes'
import {parseBcl} from '../../../bcl-document'
import {parseCustomAssignment} from '../../../bcl-tx'

// Target order from the 1.0.2 parameter inventory. Panel IDs are deliberately separate.
export const controllerGroups = ['buttons', 'pushes', 'footswitches', 'encoders'] as const
export type ControllerGroup = typeof controllerGroups[number]
export type ControllerTarget = { index: number; group: ControllerGroup; kind: 'buttons' | 'pushes' | 'encoders'; id: number }
export const controllerTargets: ControllerTarget[] = Array.from({ length: 82 }, (_, index) => index < 16
  ? { index, group: 'buttons', kind: 'buttons', id: index + 5 }
  : index < 48 ? { index, group: 'pushes', kind: 'pushes', id: index - 15 }
    : index < 50 ? { index, group: 'footswitches', kind: 'buttons', id: index + 26 }
      : { index, group: 'encoders', kind: 'encoders', id: index - 49 })
export type TargetSnapshot = { index: number; fields: Partial<Record<TargetField, TargetValue>>; emptyFields?: TargetField[] }
export type ControllerReadState = { status: 'idle' | 'reading' | 'complete' | 'cancelled' | 'no reply' | 'failed'; done: number; total: number; received: number; targets: TargetSnapshot[] }
export const emptyControllerRead = (): ControllerReadState => ({ status: 'idle', done: 0, total: 0, received: 0, targets: [] })

// Only known controller GETs; sequential, paced, cancellable, and stops after three missing replies.
// No sequencer commands, preset recall, unknown command scan or automatic retry.
export function createControllerReader(send: (bytes: number[]) => void, changed: (state: ControllerReadState) => void, timeout = 1200, pace = 15, replyDevice = 127) {
  const reader = createTargetReader(send, timeout, replyDevice)
  let closed = false, running = false
  let state = emptyControllerRead()
  const publish = () => changed({ ...state, targets: state.targets.map(t => ({ ...t, fields: { ...t.fields }, emptyFields: [...(t.emptyFields ?? [])] })) })
  return {
    receive: reader.receive,
    async read(groups: readonly ControllerGroup[] = controllerGroups) {
      if (closed || running) return state
      running = true
      state = { ...emptyControllerRead(), status: 'reading', total: controllerTargets.filter(t => groups.includes(t.group)).length * targetFields.length }
      publish()
      let missing = 0
      try {
        for (const target of controllerTargets.filter(t => groups.includes(t.group))) {
          const snapshot: TargetSnapshot = { index: target.index, fields: {} }
          state.targets.push(snapshot)
          for (const field of targetFields) {
            if (closed) { state.status = 'cancelled'; return state }
            const result = await reader.read(target.index, field)
            if (closed || result.status === 'cancelled') { state.status = 'cancelled'; return state }
            state.done++
            if (result.value) { snapshot.fields[field] = result.value; state.received++; missing = 0 }
            else if (result.status === 'empty') { (snapshot.emptyFields ??= []).push(field); state.received++; missing = 0 }
            else missing++
            publish()
            if (missing >= 3) { state.status = 'no reply'; return state }
            if (pace > 0) await new Promise(resolve => setTimeout(resolve, pace))
          }
        }
        state.status = state.received === state.total ? 'complete' : 'no reply'
        return state
      } catch { state.status = closed ? 'cancelled' : 'failed'; return state }
      finally { running = false; publish() }
    },
    close() { closed = true; reader.close() },
  }
}

// Metadata differs from the legacy binary-dump hypothesis, especially NOTE/AT/GS/MMC.
// Unrepresentable types (including custom SysEx 8), ALL channels and sentinels stay raw.
export function assignmentFromRead(previous: Encoder, snapshot: TargetSnapshot): Encoder | null {
  const f = snapshot.fields, target = controllerTargets[snapshot.index]
  // Native Type OFF may still carry .tx. Only working-preset BCL can disambiguate it.
  if(previous.customAssignment && (f.type?.raw===0 || f.type?.raw===8))return null
  // An explicit OFF type disables an old local assignment, while retaining its dormant local fields.
  if (target && f.type?.raw === 0 && targetFields.every(key => !!f[key] || snapshot.emptyFields?.includes(key))) return { ...previous, type: 'off' }
  if (!target || !f.type || f.type.sentinel) return null
  const rotation = target.kind === 'encoders'
  const types: EncoderType[] = rotation ? ['off', 'pc', 'cc', 'nrpn', 'pb', 'at', 'gs'] : ['off', 'pc', 'cc', 'nrpn', 'note', 'at', 'gs', 'mmc']
  const type = types[f.type!.raw]
  // PC uses the parameter slot for an optional bank. The controller returns F5A5 for bank Off.
  const bankOff = type === 'pc' && !!f.parameter?.sentinel
  if (targetFields.some(key => !f[key] || f[key]!.sentinel && !(key === 'parameter' && bankOff))) return null
  if (!type || type === 'mmc' || f.channel!.raw > 15 || ![0, 1].includes(f.display!.raw)) return null
  const mode = rotation ? rotationModes[f.mode!.raw] : (['toggle', 'momentary', 'inc_dec'] as const)[f.mode!.raw]
  if (!mode || !modesFor(type, rotation).includes(mode)) return null
  if (rotation && !ledModes[f.option!.raw]) return null
  const { mmc: _mmc, customAssignment: _custom, fallbackType: _fallback, ...base } = previous
  const next: Encoder = { ...base, type, channel: f.channel!.raw + 1, parameter: bankOff ? 0 : f.parameter!.raw, minimum: f.value1!.raw, maximum: f.value2!.raw, mode,
    display: !!f.display!.raw, bankOff, parameterOff: false, minimumOff: false, aftertouchAll: false,
    ...(rotation ? { ledMode: ledModes[f.option!.raw] } : { increment: f.option!.signed }) }
  if (!rotation) {
    next.buttonValues = [f.value1!.raw, f.value2!.raw]
    next.minimum = Math.min(...next.buttonValues); next.maximum = Math.max(...next.buttonValues)
  }
  if (!Number.isInteger(next.parameter) || next.parameter < 0 || next.parameter > (type === 'nrpn' ? 16383 : 127)) return null
  const limit = ['abs_14', 'r1_14', 'r2_14', 'r3_14'].includes(mode) ? 16383 : 127
  if (next.minimum > next.maximum || next.minimum < 0 || next.maximum > limit || (!rotation && Math.abs(next.increment ?? 0) > 127)) return null
  return next
}

// A local edit made while reading wins. Raw replies remain available independently.
export function mergeControllerRead(current: Bcr32Profile, baseline: Bcr32Profile, snapshots: TargetSnapshot[]) {
  let next = current, applied = 0
  for (const snapshot of snapshots) {
    const target = controllerTargets[snapshot.index]
    if (!target) continue
    const old = current[target.kind].find(e => e.id === target.id), before = baseline[target.kind].find(e => e.id === target.id)
    if (!old || JSON.stringify(old) !== JSON.stringify(before)) continue
    const assignment = assignmentFromRead(old, snapshot)
    if (!assignment) continue
    const candidate = { ...next, [target.kind]: next[target.kind].map(e => e.id === target.id ? assignment : e) }
    try { next = parseProfile(candidate); applied++ } catch { /* Preserve incompatible originals. */ }
  }
  return { profile: next, applied }
}

/** Reconcile .tx from a complete current-preset GET, never from a stored slot or a partial fragment.
 * Indexed reads are authoritative for standard fields. The native BCL source resolves Type OFF/.tx
 * without mistaking a stale local custom draft for the current hardware assignment.
 */
export function mergeWorkingPrograms(current:Bcr32Profile,baseline:Bcr32Profile,text:string,snapshots:TargetSnapshot[]){
  const lines=text.split(/\r?\n/),doc=parseBcl(text)
  if(lines[0]!=='$rev BCR32'||lines[1]!=='$preset'||lines.at(-1)!=='$end'||doc.modelId!=='bcr32'||doc.issues.length||doc.presets.length!==1||doc.global||doc.presets[0].slot!==null)throw Error('Complete current BCR32 preset required for assignment synchronization')
  let next=current,applied=0
  for(const target of controllerTargets){
    if(!snapshots.some(snapshot=>snapshot.index===target.index))continue
    const old=current[target.kind].find(e=>e.id===target.id),before=baseline[target.kind].find(e=>e.id===target.id)
    if(!old||JSON.stringify(old)!==JSON.stringify(before))continue
    const kind=target.kind==='encoders'?'encoder':'button',id=target.kind==='encoders'?target.id:target.index+1
    const element=doc.presets[0].elements.find(e=>e.kind===kind&&e.id===id)
    if(!element)continue // Absence is not proof of OFF.
    let assignment:Encoder|null=null
    if(element.custom){
      try{const program=parseCustomAssignment((element.sourceLines??[]).join('\n'));assignment={...old,type:program.kind==='custom-sysex'?'sysex':'bcl',fallbackType:old.fallbackType??(old.type==='sysex'||old.type==='bcl'?'off':old.type),customAssignment:program}}catch{continue}
    }else if(old.customAssignment){
      const {customAssignment:_custom,fallbackType,...rest}=old
      const standard={...rest,type:fallbackType??'off'} as Encoder
      const snapshot=snapshots.find(s=>s.index===target.index)
      if(snapshot)assignment=assignmentFromRead(standard,snapshot)
    }
    if(!assignment)continue
    try{next=parseProfile({...next,[target.kind]:next[target.kind].map(e=>e.id===target.id?assignment!:e)});applied++}catch{/* Keep incompatible originals and their raw source. */}
  }
  return {profile:next,applied}
}
