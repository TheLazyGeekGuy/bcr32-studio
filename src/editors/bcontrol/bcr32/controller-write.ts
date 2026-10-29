import { createTargetReader, isFrame, targetReply, targetFields, type TargetField, type TargetValue } from './firmware-codec'
import { planControllerFieldWrite } from './controller-write-plan'
import { controllerTargets, type TargetSnapshot } from './controller-read'
import { rotationModes, type Encoder } from './profile'
import { ledModes } from './led-modes'

// CC/NRPN encoder assignments plus an explicit Type OFF (0) for indexed controller targets.
// No globals, preset recall, STORE, BCL, sequencer or firmware operations enter this transport.
export function encoderWireFields(encoder: Encoder): Record<TargetField, number> {
  if(encoder.customAssignment)throw Error('Custom programs cannot enter the standard assignment writer')
  if (!['cc', 'nrpn'].includes(encoder.type) || encoder.parameterOff || encoder.minimumOff || encoder.aftertouchAll || encoder.mmc) throw Error('Live assignment writes support CC/NRPN encoders only')
  const mode = rotationModes.indexOf(encoder.mode), option = ledModes.indexOf(encoder.ledMode === 'dot' ? '1dot_in' : encoder.ledMode ?? 'bar')
  if (mode < 0 || option < 0) throw Error('Unsupported encoder mode')
  return { type: encoder.type === 'cc' ? 2 : 3, channel: encoder.channel - 1, parameter: encoder.parameter, value1: encoder.minimum, value2: encoder.maximum, mode, option, display: encoder.display === false ? 0 : 1 }
}
export type AssignmentWriteState = { status: 'idle' | 'pending' | 'writing' | 'confirmed' | 'failed' | 'cancelled'; queued: number; index?: number; field?: TargetField; value?: number }
export function isEncoderAssignmentWrite(bytes: readonly number[], device: number) {
  if (device === 127 || !isFrame(bytes) || bytes[4] !== device || bytes[7] < 0 || bytes[7] > 81) return false
  const reply = targetReply(bytes)
  if (!reply || reply.sentinel) return false
  if (reply.field === 'type' && reply.raw === 0) return true
  if (bytes[7] < 50) return false
  const max = { type: 3, channel: 15, parameter: 16383, value1: 16383, value2: 16383, mode: 8, option: 11, display: 1 }[reply.field]
  return reply.raw <= max && (reply.field !== 'type' || [2, 3].includes(reply.raw))
}
export function createAssignmentWriter(send: (bytes: number[]) => void, device: number, changed: (state: AssignmentWriteState) => void, confirmed: (value: TargetValue) => void, debounce = 120, settle = 160, timeout = 1200) {
  const reader = createTargetReader(send, timeout, device)
  const queue = new Map<string, { snapshot: TargetSnapshot; field: TargetField; value: number }>()
  let closed = false, running = false, timer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null, settleResolve: (() => void) | null = null
  const publish = (status: AssignmentWriteState['status'], job?: { snapshot: TargetSnapshot; field: TargetField; value: number }) => changed({ status, queued: queue.size, ...(job ? { index: job.snapshot.index, field: job.field, value: job.value } : {}) })
  function validate(job: { snapshot: TargetSnapshot; field: TargetField; value: number }) {
    const { snapshot, field, value } = job
    if (closed) throw Error('Assignment writer closed')
    const disabling = field === 'type' && value === 0
    if (!disabling && (controllerTargets[snapshot.index]?.kind !== 'encoders' || ![0, 2, 3].includes(snapshot.fields.type?.raw ?? -1) || field === 'type' && ![2, 3].includes(value))) throw Error('Live assignment writes support CC/NRPN encoders and Type OFF only')
    if (!isEncoderAssignmentWrite(planControllerFieldWrite(snapshot, field, value, device).write, device)) throw Error('Unsupported assignment value')
  }
  function enqueueBatch(jobs: { snapshot: TargetSnapshot; field: TargetField; value: number }[]) {
    jobs.forEach(validate)
    const disabled = new Set(jobs.filter(j=>j.field==='type'&&j.value===0).map(j=>j.snapshot.index))
    const keys = new Set([...queue].filter(([,job])=>!disabled.has(job.snapshot.index)).map(([key])=>key).concat(jobs.map(j => `${j.snapshot.index}:${j.field}`)))
    if (keys.size > 256) throw Error('Assignment write queue full')
    for (const job of jobs) {
      if(job.field==='type'&&job.value===0)for(const [key,pending] of queue)if(pending.snapshot.index===job.snapshot.index)queue.delete(key)
      const key=`${job.snapshot.index}:${job.field}`;queue.delete(key);queue.set(key,job)
    }
    // OFF takes the next available slot, ahead of unrelated queued edits. An in-flight readback finishes first.
    const ordered=[...queue].sort(([,a],[,b])=>Number(b.field==='type'&&b.value===0)-Number(a.field==='type'&&a.value===0))
    queue.clear();for(const [key,job] of ordered)queue.set(key,job)
    if (jobs.length) { publish('pending'); schedule(jobs.some(j=>j.field==='type'&&j.value===0)?0:debounce) }
  }
  const schedule = (delay:number) => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void flush() }, delay) }
  async function flush() {
    if (closed || running || !queue.size) return
    running = true
    try {
      while (!closed && queue.size) {
        const [key, job] = queue.entries().next().value!
        queue.delete(key)
        const plan = planControllerFieldWrite(job.snapshot, job.field, job.value, device)
        publish('writing', job)
        send(plan.write)
        // Ignore the immediate setter response; confirmation must follow an independent GET.
        await new Promise<void>(resolve => { settleResolve = resolve; settleTimer = setTimeout(() => { settleTimer = null; settleResolve = null; resolve() }, settle) })
        if (closed) break
        const result = await reader.read(job.snapshot.index, job.field)
        if (closed) break
        if (!result.value || result.value.raw !== job.value) { queue.clear(); publish('failed', job); return }
        confirmed(result.value)
        publish(queue.size ? 'pending' : 'confirmed', job)
      }
    } catch { if (!closed) { queue.clear(); publish('failed') } }
    finally { running = false }
  }
  return {
    receive: reader.receive,
    enqueue(snapshot: TargetSnapshot, field: TargetField, value: number) {
      enqueueBatch([{ snapshot, field, value }])
    },
    enqueueBatch,
    close() {
      closed = true; queue.clear(); if (timer) clearTimeout(timer)
      if (settleTimer) clearTimeout(settleTimer); settleTimer = null; settleResolve?.(); settleResolve = null
      reader.close(); publish('cancelled')
    },
  }
}

export function changedEncoderFields(before: Encoder, after: Encoder) {
  if(before.customAssignment||after.customAssignment||['sysex','bcl'].includes(before.type)||['sysex','bcl'].includes(after.type))throw Error('Custom BCL/SysEx is local-only; standard assignment writes are refused')
  if(after.type==='off')return before.type==='off'?[]:[{field:'type' as const,value:0}]
  if(before.type==='off'){const next=encoderWireFields(after);return [...targetFields.filter(f=>f!=='type'),'type' as const].map(field=>({field,value:next[field]}))}
  const old = encoderWireFields(before), next = encoderWireFields(after)
  return targetFields.filter(field => old[field] !== next[field]).map(field => ({ field, value: next[field] }))
}

/** OFF is only the Type field: dormant channel, ranges, mode and LED fields must remain untouched. */
export function changedControllerFields(before:Encoder,after:Encoder,snapshot:TargetSnapshot){
 if(before.customAssignment||after.customAssignment||['sysex','bcl'].includes(before.type)||['sysex','bcl'].includes(after.type))throw Error('Custom BCL/SysEx must not be converted to a standard or OFF write')
 if(!controllerTargets[snapshot.index])throw Error('Unknown controller target')
 if(after.type==='off')return before.type==='off'?[]:[{field:'type' as const,value:0}]
 if(controllerTargets[snapshot.index].kind!=='encoders')throw Error('Live button/push assignment edits support Type OFF only')
 return changedEncoderFields(before,after)
}
