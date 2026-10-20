import { currentDevice } from './devices'
import { sysexHeader, type DeviceDefinition } from './device-definition'

const prefix = sysexHeader(currentDevice)
export const brightnessQuery = [...prefix, 0x40, 0xf7]
export function brightnessWrite(value: number, device: DeviceDefinition = currentDevice) {
  const prefix = sysexHeader(device)
  if (!Number.isInteger(value) || value < 0 || value > 15) throw Error('LED brightness: 0–15')
  return [...prefix, 0x40, value, 0xf7]
}
export function brightnessReply(bytes: number[], device: DeviceDefinition = currentDevice) {
  const prefix = sysexHeader(device)
  return bytes.length === 9 && prefix.every((v, i) => bytes[i] === v) && bytes[6] === 0x40 && Number.isInteger(bytes[7]) && bytes[7] >= 0 && bytes[7] <= 15 && bytes[8] === 0xf7 ? bytes[7] : null
}

export type BrightnessState = { value: number | null; draft: number; busy: boolean; status: string }
// One outstanding read-back, latest slider choice only; never sends STORE.
export function createBrightnessTransport(send: (bytes:number[])=>void, changed:(state:BrightnessState)=>void, debounceMs=80, timeoutMs=2000, device: DeviceDefinition = currentDevice) {
  const brightnessQuery = [...sysexHeader(device), 0x40, 0xf7]
  let closed=false, value:number|null=null, draft=5, status='', pending:{target?:number;timer:ReturnType<typeof setTimeout>}|null=null
  let queued:number|undefined, flushTimer:ReturnType<typeof setTimeout>|null=null, retryTimer:ReturnType<typeof setTimeout>|null=null, retries=0
  const publish=()=>changed({value,draft,busy:!!pending,status})
  const cancelQueued=()=>{queued=undefined;if(flushTimer)clearTimeout(flushTimer);flushTimer=null}
  const request=(target?:number)=>{
    if(closed||pending)return
    pending={target,timer:setTimeout(()=>{
      pending=null;cancelQueued();value=null;status='Read-back timeout · hardware state unknown.';publish()
      if(retries++<2)retryTimer=setTimeout(()=>{retryTimer=null;request()},300)
    },timeoutMs)}
    status='Waiting for read-back…';publish()
    try {if(target!==undefined)send(brightnessWrite(target, device));send(brightnessQuery)}
    catch(error){clearTimeout(pending?.timer);pending=null;cancelQueued();value=null;status=error instanceof Error?error.message:String(error);publish()}
  }
  const flush=()=>{
    flushTimer=null
    if(closed||pending||queued===undefined)return
    const target=queued;queued=undefined
    if(target!==value)request(target)
    else publish()
  }
  const schedule=()=>{if(flushTimer)clearTimeout(flushTimer);flushTimer=setTimeout(flush,debounceMs)}
  return {
    read(){if(!closed&&!pending&&queued===undefined){retries=0;if(retryTimer)clearTimeout(retryTimer);retryTimer=null;request()}},
    set(next:number){brightnessWrite(next, device);if(closed||value===null)return;draft=next;queued=next;publish();schedule()},
    receive(bytes:number[]){
      const observed=brightnessReply(bytes, device)
      if(closed||observed===null)return false
      const target=pending?.target;if(pending)clearTimeout(pending.timer);pending=null;retries=0
      if(retryTimer)clearTimeout(retryTimer);retryTimer=null
      value=observed;if(queued===undefined)draft=observed
      // Catalog keys: StudioConfig translates the status at render.
      status=target===undefined?'Brightness read from device.':target===observed?'Brightness confirmed · immediate effect, no STORE.':'Read-back mismatch · displayed value is the hardware response.'
      publish();if(queued!==undefined&&!flushTimer)schedule()
      return true
    },
    close(){closed=true;if(pending)clearTimeout(pending.timer);pending=null;cancelQueued();if(retryTimer)clearTimeout(retryTimer);retryTimer=null},
  }
}
