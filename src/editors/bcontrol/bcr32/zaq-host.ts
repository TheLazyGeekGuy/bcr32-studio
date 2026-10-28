/** BCR32 1.0.3 Zaq host protocol. Provenance and capture hashes: docs/BCR32-PROTOCOL-1.0.3.md.
 * No persistent writes, transport or legacy command 07 are exposed here. Hardware page changes are explicit.
 * This codec does not acquire MIDI ports; the caller supplies the existing instance transport.
 */
import { integer, isFrame, midiFrame, pack7, unpack7 } from './firmware-codec'
import { patchStep, readStep } from './zaquencer'

export const hostLanes = ['note', 'velocity', 'rest', 'delay', 'gate', 'alpha', 'beta', 'voices', 'mask'] as const
export type HostLane = typeof hostLanes[number]
export const supportsZaqHost = (firmware: string | null | undefined) => firmware === '1.0.3'
// Native lane editor field 7 is a Chord code (0..55), not an editable 16-bit voice mask.
const bounds: Record<HostLane, readonly [number, number]> = { note: [0,127], velocity: [0,127], rest: [0,1], delay: [-5,5], gate: [0,15], alpha: [-1,127], beta: [-1,127], voices: [0,55], mask: [0,1] }
const i = (v: number, lo: number, hi: number) => integer(v,lo,hi)
const unpack = (wire: readonly number[]) => {try{return unpack7(wire)}catch{return null}}
export function readHostLane(track: number, field: number) { return midiFrame(0x45,[1,i(track,0,3),i(field,0,8)]) }
export function writeHostStep(track: number, step: number, field: number, value: number) {
  i(field,0,8); const [lo,hi] = bounds[hostLanes[field]]; i(value,lo,hi)
  const word = value & 0xffff
  return midiFrame(0x44,[2,i(track,0,3),i(step,0,31),field,...pack7([word >>> 8,word & 255])])
}
export const readHostState = () => midiFrame(0x48,[0])
// Hardware comparisons on 2026-10-28: byte 0 = running, byte 2 = selected track.
// Neither changes the identity of a snapshot containing all four tracks.
export const sameHostPatternContext = (a: readonly number[],b: readonly number[]) => a.length===5&&b.length===5&&[1,3,4].every(n=>a[n]===b[n])
// Native SendZaquencerPageMode / SendControllerPageMode (ControlTribe 1.12.4).
// These switch the hardware page; they are not queries or persistent STORE operations.
export const hostPage = (page: 'controller' | 'sequencer') => midiFrame(page==='sequencer'?0x0b:0x0c)
export const isHostPage = (b: readonly number[]) => isFrame(b)&&b[4]===127&&b.length===8&&[0x0b,0x0c].includes(b[6])
export function isZaqHostQuery(b: readonly number[]) {
  return isFrame(b) && b[4] === 127 && ((b.length === 9 && b[6] === 0x48 && b[7] === 0) ||
    (b.length === 11 && b[6] === 0x45 && b[7] === 1 && b[8] < 4 && b[9] < 9))
}
export function isZaqHostWrite(b: readonly number[]) {
  if (!isFrame(b) || b[4] !== 127 || b.length !== 15 || b[6] !== 0x44 || b[7] !== 2 || b[8] > 3 || b[9] > 31 || b[10] > 8) return false
  const raw = unpack(b.slice(11,14)); if (!raw || raw.length !== 2) return false
  let value = raw[0] * 256 + raw[1]; const lane = hostLanes[b[10]]
  if (lane !== 'voices' && value > 32767) value -= 65536
  const [lo,hi] = bounds[lane]; return value >= lo && value <= hi && JSON.stringify(b) === JSON.stringify(writeHostStep(b[8],b[9],b[10],value))
}
export type HostReply = { command: number; operation: number; track?: number; step?: number; field?: number; status: number; values: number[] }
export function parseHostReply(b: readonly number[], device: number): HostReply | null {
  if (device === 127 || !isFrame(b) || b[4] !== device) return null
  if (b[6] === 0x48 && b.length === 16 && b[7] === 0 && b[8] === 0) {
    const values = unpack(b.slice(9,-1)); return values?.length === 5 ? {command:0x48,operation:0,status:0,values} : null
  }
  if (b[6] === 0x45 && b.length === 86 && b[7] === 1 && b[8] < 4 && b[9] < 9 && b[10] === 0) {
    const raw = unpack(b.slice(11,-1)); if (!raw || raw.length !== 64) return null
    const values = Array.from({length:32},(_,n) => {const v = raw[n*2]*256+raw[n*2+1]; return v > 32767 ? v-65536 : v})
    return {command:0x45,operation:1,track:b[8],field:b[9],status:0,values}
  }
  if (b[6] === 0x44 && b.length === 16 && b[7] === 2 && b[8] < 4 && b[9] < 32 && b[10] < 9 && b[11] < 2) {
    const raw = unpack(b.slice(12,-1)); if (!raw || raw.length !== 2) return null
    const v = raw[0]*256+raw[1]
    return {command:0x44,operation:2,track:b[8],step:b[9],field:b[10],status:b[11],values:[v > 32767 ? v-65536 : v]}
  }
  return null
}
export function applyHostLane(data: readonly number[], track: number, field: number, values: readonly number[]) {
  i(track,0,3);i(field,0,8);if (values.length !== 32) throw Error('Expected 32 host values')
  const lane = hostLanes[field], [lo,hi] = bounds[lane]
  let next = [...data]
  values.forEach((value,step) => {
    if (lane === 'voices') value &= 0xffff
    // Keep unknown legacy Chord words losslessly on reads; never grant writes outside native 0..55.
    i(value,lo,lane==='voices'?65535:hi)
    const local = lane === 'rest' || lane === 'mask' ? Boolean(value) : (lane === 'alpha' || lane === 'beta') && value === -1 ? 255 : value
    next = patchStep(next,track,step,{[lane]:local})
  })
  return next
}
export function changedHostSteps(before: readonly number[], after: readonly number[]) {
  const changes: {track:number;step:number;field:number;value:number}[] = []
  for (let track=0;track<4;track++) for (let step=0;step<32;step++) {
    const a=readStep(before,track,step),b=readStep(after,track,step)
    hostLanes.forEach((lane,field) => {if(a[lane]!==b[lane]) {const raw=b[lane];const value=typeof raw === 'boolean' ? Number(raw) : (lane==='alpha'||lane==='beta') && raw===255 ? -1 : raw;writeHostStep(track,step,field,value);changes.push({track,step,field,value})}})
  }
  return changes
}

/** Single-flight exchange. Queries never retry; cancellation and disconnect settle pending work.
 * No acknowledgement from another device, an outgoing echo, or a different selector can settle it.
 */
export function createZaqHost(send: (bytes: number[]) => void, device: number, timeout = 1500) {
  i(device,0,126)
  let closed=false, pending: {matches:(r:HostReply)=>boolean;resolve:(r:HostReply)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>} | null=null
  const request = (bytes: number[], matches: (r:HostReply)=>boolean) => new Promise<HostReply>((resolve,reject) => {
    if(closed || pending){reject(Error(closed?'Sequencer session closed':'Sequencer transfer busy'));return}
    let received=0,lastHeader='none'
    const timer=setTimeout(()=>{pending=null;reject(Error(`Sequencer response timeout · command ${bytes[6].toString(16).toUpperCase()} · device ${device} · RX ${received} · last ${lastHeader}`))},timeout)
    pending={matches,resolve,reject,timer}
    diagnostics=bytes=>{received++;lastHeader=bytes.slice(4,11).map(v=>v.toString(16).padStart(2,'0')).join(' ')}
    try {send(bytes)} catch(e) {clearTimeout(timer);pending=null;reject(e instanceof Error?e:Error(String(e)))}
  })
  let diagnostics: (bytes:readonly number[])=>void=()=>{}
  return {
    receive(bytes: readonly number[]) {if(pending&&bytes[0]===240)diagnostics(bytes);const r=parseHostReply(bytes,device);if(!r||!pending||!pending.matches(r))return;const p=pending;pending=null;clearTimeout(p.timer);p.resolve(r)},
    enterSequencer() {if(closed||pending)throw Error('Sequencer transfer busy');send(hostPage('sequencer'))},
    readLane(track:number,field:number) {return request(readHostLane(track,field),r=>r.command===0x45&&r.track===track&&r.field===field)},
    state() {return request(readHostState(),r=>r.command===0x48)},
    write(track:number,step:number,field:number,value:number) {return request(writeHostStep(track,step,field,value),r=>r.command===0x44&&r.track===track&&r.step===step&&r.field===field)},
    close() {closed=true;if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(Error('Sequencer session cancelled'))}},
  }
}
