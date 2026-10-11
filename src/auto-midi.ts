import { requestMidiAccess, type MidiAccess, type MidiPort } from './web-midi'
import type { Bcr32Profile } from './profile'

const bcrPorts = (ports: Map<string, MidiPort>) => Array.from(ports.values()).filter(p => p.state === 'connected' && /BCR[- ]?32/i.test(p.name ?? ''))
export function automaticPorts(access: MidiAccess, inputId = '', outputId = '') {
  const inputs = bcrPorts(access.inputs), outputs = bcrPorts(access.outputs)
  const input = inputs.find(p => p.id === inputId) ?? (inputs.length === 1 ? inputs[0] : undefined)
  const output = outputs.find(p => p.id === outputId) ?? (outputs.length === 1 ? outputs[0] : undefined)
  return { input, output, ambiguous: !input && inputs.length > 1 || !output && outputs.length > 1 }
}
export async function automaticMidiAccess(request = requestMidiAccess) {
  try { return { access: await request(true), sysexError: null } }
  catch (error) {
    // A SysEx refusal must not disable standard CC reception.
    return { access: await request(false), sysexError: error instanceof Error ? error.message : String(error) }
  }
}
export function associateDefaultEncoder(profile: Bcr32Profile, hasPreset: boolean): Bcr32Profile {
  // Starting point when nothing is configured yet: encoder 1 on CC 16, channel 1. A default, NOT a mapping read from the device.
  const e = profile.encoders[0]
  if (hasPreset || e.type !== 'off' || e.mode !== 'absolute' || e.channel !== 1 || e.parameter !== 0 || e.minimum !== 0 || e.maximum !== 127) return profile
  return { ...profile, encoders: profile.encoders.map(e => e.id === 1 ? { ...e, type: 'cc', channel: 1, parameter: 16, minimum: 0, maximum: 127, mode: 'absolute' } : e) }
}
