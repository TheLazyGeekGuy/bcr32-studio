import type { DeviceDefinition } from '../device-definition'
import { isDevicePort } from '../device-definition'
import { automaticPorts } from '../auto-midi'
import type { MidiAccess, MidiPort } from '../web-midi'
import type { MidiAuthorization, MidiBroker, MidiLease } from './midi-broker'

// A legacy editor sees familiar Web-MIDI-shaped ports, but never the physical handlers/senders.
// The broker remains the sole physical listener and exclusive output owner.
export function createMidiViewAccess(owner: string, device: DeviceDefinition, shared: MidiAccess, broker: MidiBroker, lease: MidiLease, options?: {matchesPort?:(port:MidiPort)=>boolean;send?:(bytes:number[])=>void}) {
  const view: MidiAccess = { sysexEnabled: shared.sysexEnabled, inputs: new Map(), outputs: new Map(), onstatechange: null }
  let disposed = false, queued = false, signature = '', lastGeneration = -1
  const inputCache = new Map<string, MidiPort>(), outputCache = new Map<string, MidiPort>()
  const grants = new Map<string, MidiAuthorization>()
  const physicalIds = new WeakMap<MidiPort, number>(); let lastPhysicalId = 0
  const physicalId = (p: MidiPort) => { if (!physicalIds.has(p)) physicalIds.set(p, ++lastPhysicalId); return physicalIds.get(p) }
  function refresh() {
    if (disposed) return
    const state = lease.getState()
    const inputPorts = [...shared.inputs.values()].filter(p => isDevicePort(device, p) && (!options?.matchesPort || options.matchesPort(p)) && broker.available('input', p.id, owner))
    const outputPorts = [...shared.outputs.values()].filter(p => isDevicePort(device, p) && (!options?.matchesPort || options.matchesPort(p)) && broker.available('output', p.id, owner))
    const next = JSON.stringify([shared.sysexEnabled, state.generation, inputPorts.map(p => [p.id,p.state,physicalId(p)]),outputPorts.map(p => [p.id,p.state,physicalId(p)])])
    if (next === signature) return
    if (lastGeneration !== state.generation) { inputCache.forEach(p => { p.onmidimessage = null }); lastGeneration = state.generation }
    signature = next; view.sysexEnabled = shared.sysexEnabled
    const inputs = new Map<string, MidiPort>(), outputs = new Map<string, MidiPort>()
    for (const p of inputPorts) {
      let wrapper = inputCache.get(p.id)
      if (!wrapper) { wrapper = { id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state, onmidimessage: null }; inputCache.set(p.id, wrapper) }
      wrapper.state = p.state; inputs.set(p.id, wrapper)
    }
    for (const p of outputPorts) {
      const generation = state.generation, cacheKey = `${p.id}:${generation}:${physicalId(p)}`
      let wrapper = outputCache.get(cacheKey)
      if (!wrapper) {
        wrapper = { id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state, onmidimessage: null, send(bytes) {
          const current = lease.getState()
          if (disposed || !current.connected || current.generation !== generation || current.binding?.outputId !== p.id) throw Error('Editor MIDI binding changed; pending output cancelled')
          if(options?.send){options.send(bytes);return}
          const operation = bytes[0] !== 240 ? 'value' : bytes.length === 9 && device.id === 'bcr32' && bytes[6] === 64 ? 'brightness' : 'query'
          const key = `${generation}:${operation}`
          let grant = grants.get(key)
          if (!grant) { grant = broker.authorize(owner, operation); grants.set(key, grant) }
          lease.send([bytes], grant)
        } }
        outputCache.set(cacheKey, wrapper)
      }
      outputs.set(p.id, wrapper)
    }
    view.inputs = inputs; view.outputs = outputs; view.onstatechange?.()
    // Drop obsolete sender wrappers/grants; external closures remain invalidated by generation checks.
    for (const key of outputCache.keys()) if (!key.includes(`:${state.generation}:`)) outputCache.delete(key)
    for (const [key, grant] of grants) if (!key.startsWith(`${state.generation}:`)) { broker.revoke(grant); grants.delete(key) }
  }
  const schedule = () => { if (!queued && !disposed) { queued = true; queueMicrotask(() => { queued = false; refresh() }) } }
  const offState = lease.onState(schedule)
  const offBroker = broker.subscribe(schedule)
  const offInput = lease.subscribe(packet => { if (!disposed) view.inputs.get(packet.inputId)?.onmidimessage?.({ data: new Uint8Array(packet.bytes) }) })
  refresh()
  return {
    access: view, refresh,
    bind(inputId: string, outputId: string) {
      if (disposed) throw Error('Editor MIDI access closed')
      const state = lease.getState()
      if (state.connected && state.binding?.inputId === inputId && state.binding.outputId === outputId) return
      if (!inputId || !outputId) { if (state.connected) lease.release(); refresh(); return }
      lease.bind({ inputId, outputId }); refresh()
    },
    autoBind() {
      refresh(); const pair = automaticPorts(view, '', '', device)
      if (pair.input && pair.output) { try { this.bind(pair.input.id, pair.output.id) } catch { /* An existing instance owns it: no takeover. */ } }
      return view
    },
    close() { if (disposed) return; disposed = true; offState(); offBroker(); offInput(); grants.forEach(g => broker.revoke(g)); grants.clear(); inputCache.clear(); outputCache.clear(); view.onstatechange = null },
  }
}
