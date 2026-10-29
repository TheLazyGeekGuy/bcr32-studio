import { is14Bit, isRelative, parameterLimit, valueLimit, type Encoder } from './profile'
import { relativeWords } from './controller-midi'
import type { MidiPort } from './web-midi'
import { currentDevice } from './devices'
import { isDevicePort, type DeviceDefinition } from './device-definition'
import { gsAssignment, voiceMessages, validVoiceMessage } from './bcontrol-voice'

export function isBcrOutput(port?: MidiPort, device: DeviceDefinition = currentDevice): port is MidiPort {
  return !!port?.send && isDevicePort(device, port)
}
export function encoderCC(encoder: Encoder, value: number): number[] | null {
  if(encoder.customAssignment)return null
  if (encoder.type !== 'cc' || encoder.mode !== 'absolute' || !Number.isFinite(value) ||
    !Number.isInteger(encoder.channel) || encoder.channel < 1 || encoder.channel > 16 ||
    !Number.isInteger(encoder.parameter) || encoder.parameter < 0 || encoder.parameter > 127 ||
    ![encoder.minimum, encoder.maximum].every(n => Number.isInteger(n) && n >= 0 && n <= 127) || encoder.minimum > encoder.maximum) return null
  return [0xb0 | (encoder.channel - 1), encoder.parameter, Math.max(encoder.minimum, Math.min(encoder.maximum, Math.round(value)))]
}

export function encoderMessages(encoder: Encoder, value: number, previous?: number, device: DeviceDefinition = currentDevice): number[][] | null {
  if(encoder.customAssignment)return null
  if (encoder.parameterState?.opaque) return null
  if (device.protocol === 'bcl' && encoder.type === 'gs') {
    const assignment = gsAssignment(encoder)
    return assignment ? encoderMessages(assignment, value, previous, device) : null
  }
  if (device.protocol === 'bcl' && ['note','pc','pb','at'].includes(encoder.type)) return voiceMessages(encoder, Math.max(encoder.minimum,Math.min(encoder.maximum,value)))
  if (encoder.type === 'cc' && encoder.parameterOff) return null
  if (!['cc', 'nrpn'].includes(encoder.type) || !Number.isFinite(value) ||
    !Number.isInteger(encoder.channel) || encoder.channel < 1 || encoder.channel > 16 ||
    !Number.isInteger(encoder.parameter) || encoder.parameter < 0 || encoder.parameter > parameterLimit(encoder) || encoder.type === 'nrpn' && encoder.parameter === 16383 ||
    ![encoder.minimum, encoder.maximum].every(n => Number.isInteger(n) && n >= 0 && n <= valueLimit(encoder)) || encoder.minimum > encoder.maximum ||
    encoder.type === 'cc' && (is14Bit(encoder) && encoder.parameter > 31 || encoder.mode === 'inc_dec')) return null
  const v = Math.max(encoder.minimum, Math.min(encoder.maximum, Math.round(value)))
  const status = 0xb0 | (encoder.channel - 1)
  const prefix = encoder.type === 'nrpn' ? [[status, 99, encoder.parameter >> 7], [status, 98, encoder.parameter & 127]] : []
  const base = encoder.type === 'nrpn' ? 6 : encoder.parameter
  if (isRelative(encoder)) {
    if (previous === undefined || !Number.isFinite(previous)) return null
    const delta = v - Math.round(previous)
    if (encoder.mode === 'inc_dec') {
      if (Math.abs(delta) > 256) return null
      return Array.from({ length: Math.abs(delta) }, () => [...prefix, [status, delta > 0 ? 96 : 97, 1]]).flat()
    }
    const words = relativeWords(encoder, delta, device)
    return words ? words.flatMap(word => [...prefix, ...is14Bit(encoder) ? [[status, base, word >> 7], [status, base + 32, word & 127]] : [[status, base, word]]]) : null
  }
  return [...prefix, ...is14Bit(encoder) ? [[status, base, v >> 7], [status, base + 32, v & 127]] : [[status, base, v]]]
}

// Coalesce rapid gestures per channel/CC; incoming MIDI never enters this queue.
export function createCcSender(send: (bytes: number[]) => void, sent: (bytes: number[]) => void, failed: (error: unknown) => void, interval = 33, device: DeviceDefinition = currentDevice) {
  const validMessages = (messages: number[][]) => messages.every(bytes => device.protocol === 'bcl' ? validVoiceMessage(bytes) : bytes.length === 3 && bytes.every(n => Number.isInteger(n)) && bytes[0] >= 0xb0 && bytes[0] <= 0xbf && bytes[1] >= 0 && bytes[1] <= 127 && bytes[2] >= 0 && bytes[2] <= 127)
  const queue = new Map<string, number[][]>()
  const ordered: number[][][] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  const flush = () => {
    timer = null
    // At most four ordered units per tick, with each CC14/NRPN unit intact.
    const messages = [...Array.from(queue.values()).flat(), ...ordered.splice(0, 4).flat()]
    queue.clear()
    for (const message of messages) {
      if (closed) break
      try { send(message); sent(message) } catch (error) { closed = true; failed(error); break }
    }
    if (!closed && ordered.length) timer = setTimeout(flush, interval)
  }
  const enqueueMessages = (messages: number[][]) => {
      if (closed || !messages.length || messages.length > 4 || !validMessages(messages)) return
      const ccOnly = messages.every(b => (b[0] & 0xf0) === 0xb0)
      if (ccOnly && messages.length === 2 && (messages[0][1] > 31 || messages[1][0] !== messages[0][0] || messages[1][1] !== messages[0][1] + 32)) return
      if (ccOnly && messages.length >= 3 && (messages[0][1] !== 99 || messages[1][1] !== 98 || messages[2][1] !== 6 || messages.some(b => b[0] !== messages[0][0]) || messages.length === 4 && messages[3][1] !== 38)) return
      const bytes = messages[0]
      const last = messages.at(-1)!
      const key = !ccOnly ? `voice:${last[0]}:${[0xc0,0xd0,0xe0].includes(last[0]&0xf0) ? 0 : last[1]}` : messages.length >= 3 ? `${bytes[0]}:NRPN:${bytes[2]}:${messages[1][2]}` : `${bytes[0]}:${bytes[1]}`
      queue.set(key, messages.map(b => [...b]))
      timer ??= setTimeout(flush, interval)
  }
  return {
    enqueue(bytes: number[]) { enqueueMessages([bytes]) },
    enqueueMessages,
    enqueueOrdered(messages: number[][]) {
      if (closed || !messages.length || !validMessages(messages)) return
      if (ordered.reduce((n, group) => n + group.length, 0) + messages.length > 4096) { closed = true; queue.clear(); ordered.length = 0; failed(new Error('Relative MIDI queue too long: sending stopped.')); return }
      for (let i = 0; i < messages.length;) {
        const b = messages[i]
        const nrpn = b[1] === 99 && messages[i + 1]?.[1] === 98 && messages[i + 1][0] === b[0]
        const pair = !nrpn && b[1] <= 31 && messages[i + 1]?.[1] === b[1] + 32 && messages[i + 1][0] === b[0]
        const bankProgram = pair && b[1] === 0 && messages[i + 2]?.[0] === (0xc0 | (b[0] & 15))
        const count = bankProgram ? 3 : nrpn ? messages[i + 2]?.[1] === 6 && messages[i + 3]?.[1] === 38 ? 4 : 3 : pair ? 2 : 1
        ordered.push(messages.slice(i, i + count).map(b => [...b])); i += count
      }
      timer ??= setTimeout(flush, interval)
    },
    close() { closed = true; queue.clear(); ordered.length = 0; if (timer !== null) clearTimeout(timer); timer = null },
  }
}
