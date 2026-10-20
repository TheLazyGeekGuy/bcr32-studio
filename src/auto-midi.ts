import type { MidiAccess, MidiPort } from './web-midi'
export {automaticMidiAccess} from './midi-permission'
import type { Bcr32Profile } from './profile'
import { currentDevice } from './devices'
import { isDevicePort, type DeviceDefinition } from './device-definition'

const bcrPorts = (ports: Map<string, MidiPort>, device: DeviceDefinition) => Array.from(ports.values()).filter(p => isDevicePort(device, p))
export function automaticPorts(access: MidiAccess, inputId = '', outputId = '', device: DeviceDefinition = currentDevice) {
  const inputs = bcrPorts(access.inputs, device), outputs = bcrPorts(access.outputs, device)
  const input = inputs.find(p => p.id === inputId) ?? (inputs.length === 1 ? inputs[0] : undefined)
  const output = outputs.find(p => p.id === outputId) ?? (outputs.length === 1 ? outputs[0] : undefined)
  return { input, output, ambiguous: !input && inputs.length > 1 || !output && outputs.length > 1 }
}
export function associateDefaultEncoder(profile: Bcr32Profile, hasPreset: boolean): Bcr32Profile {
  // Starting point when nothing is configured yet: encoder 1 on CC 16, channel 1. A default, NOT a mapping read from the device.
  const e = profile.encoders[0]
  if (hasPreset || e.type !== 'off' || e.mode !== 'absolute' || e.channel !== 1 || e.parameter !== 0 || e.minimum !== 0 || e.maximum !== 127) return profile
  return { ...profile, encoders: profile.encoders.map(e => e.id === 1 ? { ...e, type: 'cc', channel: 1, parameter: 16, minimum: 0, maximum: 127, mode: 'absolute' } : e) }
}
