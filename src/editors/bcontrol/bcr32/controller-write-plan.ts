// Offline preparation only. This module has no sender, timer, browser access or automatic activation.
// Static field shapes: docs/firmware-1.0.2-command-map.json. Physical setter validation remains pending.
import { integer, midiFrame, pack7, targetFields, targetQuery, type TargetField } from './firmware-codec'
import { controllerTargets, type TargetSnapshot } from './controller-read'

export function planControllerFieldWrite(snapshot: TargetSnapshot, field: TargetField, value: number, device: number) {
  const target = controllerTargets[snapshot.index], original = snapshot.fields[field]
  if (!target || !targetFields.includes(field) || !original || original.sentinel || original.index !== snapshot.index || original.field !== field) throw Error('A known original field is required')
  integer(device, 0, 126) // No broadcast writes; this must be the ID observed on the selected controller.
  const type = snapshot.fields.type?.raw
  if (type === undefined || !Number.isInteger(type) || type < 0 || type > (target.kind === 'encoders' ? 6 : 7)) throw Error('Unsupported assignment type')
  const wide = ['parameter', 'value1', 'value2'].includes(field) || field === 'option' && snapshot.index < 50
  const encode = (raw: number) => midiFrame(0x31 + targetFields.indexOf(field), [snapshot.index, ...(wide ? pack7([integer(raw, 0, 65535) >> 8, raw & 255]) : [integer(raw, 0, 127)])], device)
  // Preparing bytes is not permission to send them or proof of a volatile/persistent effect.
  return { index: snapshot.index, field, device, original: original.raw, proposed: value,
    write: encode(value), verify: targetQuery(snapshot.index, field), restore: encode(original.raw),
    hardwareValidated: false as const, sends: false as const }
}
