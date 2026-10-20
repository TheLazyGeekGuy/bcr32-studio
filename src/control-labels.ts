import type {DeviceDefinition} from './device-definition'
import type {ControlGroup,VisualLabels} from './presets'

/** Explicit-model label lookup, usable without mounting or importing a panel. */
export function controlLabelFor(device:DeviceDefinition,kind:ControlGroup,id:number,labels:VisualLabels){
  const index=kind==='buttons'?device.controls.buttonIds.indexOf(id):id-1
  return labels[kind][index]?.trim()||device.printedName(kind,id)
}
