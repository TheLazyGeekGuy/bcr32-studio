import { buttonValues, type Bcr32Profile, type ControllerSettings, type Encoder } from './profile'
import type { Change } from './controller-midi'

export const controllerRoutes = ['Off', 'MIDI A', 'MIDI B', 'MIDI A & B', 'USB', 'USB & MIDI A', 'USB & MIDI B', 'USB & MIDI A & B']
export function routingFromBcl(text: string): Partial<ControllerSettings> | null {
  const lines = text.split('\n').map(l => l.trim())
  if (lines[0] !== '$rev BCR32' || !lines.includes('$global') || lines.at(-1) !== '$end') return null
  const ports = lines.filter(l => /^\.ctrlout\b/.test(l))
  if (ports.length !== 1) return null
  const tokens = ['off', 'a', 'b', 'ab', 'u', 'ua', 'ub', 'uab']
  const index = tokens.indexOf(ports[0].slice(8).trim().toLowerCase())
  if (index < 0) return null
  const result: Partial<ControllerSettings> = { outputRouting: controllerRoutes[index] }
  const mode = lines.find(l => l.startsWith('.opmode '))?.slice(8)
  if (mode === 'usb' || mode === 'stdl' || mode === 'mixed') result.operationMode = mode
  const feet = [1, 2].map(i => lines.find(l => l.startsWith(`.footsw${i} `))?.split(/\s+/)[1])
  if (feet.every(v => v === 'ctrl' || v === 'zaq')) result.footswitchModes = feet as ControllerSettings['footswitchModes']
  return result
}
export function activeButtonValue(config: Encoder, value: number | null | undefined) {
  const [on, off] = buttonValues(config)
  return config.type !== 'off' && ['toggle', 'momentary'].includes(config.mode) && value != null && on !== off && value === on
}
export type IndicatorReadings = {
  outputRouting: string | null
  routeSource?: 'bcl' | 'indexed'
  midiInput: boolean | null
  feet: [boolean | null, boolean | null]
}
export const unknownIndicators: IndicatorReadings = { outputRouting: null, midiInput: null, feet: [null, null] }

// The combined USB endpoint has no DIN-origin/egress telemetry. DIN pulses are routing
// estimates for channel messages, never proof of electrical traffic. SysEx is USB only.
export function activityPorts(data: number[], direction: 'send' | 'receive', readings: IndicatorReadings, changes: Change[] = []) {
  if (!data.length) return []
  const ports = [5]
  const channelMessage = data[0] >= 0x80 && data[0] < 0xf0
  if (!channelMessage) return ports
  const controllerMessage = changes.length > 0
  const routed = direction === 'send' || controllerMessage
  if (routed && readings.outputRouting?.split(/\W+/).includes('A')) ports.push(1)
  if (routed && readings.outputRouting?.split(/\W+/).includes('B')) ports.push(2)
  // Only an unmatched channel message can be a candidate for the configured DIN input;
  // a decoded panel control must not falsely flash MIDI IN.
  if (direction === 'receive' && !controllerMessage && readings.midiInput === true) ports.push(0)
  for (const i of [0, 1]) if (direction === 'receive' && changes.some(c => c.control.kind === 'buttons' && c.control.id === 74 + i)) ports.push(3 + i)
  return ports
}

// Preserve MIDI state when an unrelated assignment changes. Invalidate only a control
// whose own decoding/value semantics changed; reconnects are cleared separately.
export function retainControlSources<T>(sources: Record<string, T>, before: Bcr32Profile, after: Bcr32Profile): Record<string, T> {
  const signature = (e: Encoder | undefined) => e && JSON.stringify([e.type, e.channel, e.parameter, e.mode, e.minimum, e.maximum, e.parameterOff, buttonValues(e)])
  return Object.fromEntries(Object.entries(sources).filter(([key]) => {
    const [kind, id] = key.split(':')
    if (kind !== 'buttons' && kind !== 'pushes') return false
    return signature(before[kind].find(e => e.id === +id)) === signature(after[kind].find(e => e.id === +id))
  }))
}
