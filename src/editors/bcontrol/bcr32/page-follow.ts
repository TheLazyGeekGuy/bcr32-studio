import {decodeControllerDump} from './controller-dump'
import {decodeZaqBlock} from './zaquencer'
import {midiFrame} from './firmware-codec'

export type EditorPage='controller'|'sequencer'
// ControlTribe1.12.4 ExportCurrentPage, physically compared in CTRL/ZQR on1.0.3.
// Advances the export cursor, never selects a page or writes a preset.
export const currentPageQuery=()=>midiFrame(8)
export function pageFromExport(bytes:readonly number[]):EditorPage|null{
  if(bytes.length!==273||bytes[4]!==127||bytes[8]!==2||bytes[11]>7)return null
  const controller=decodeControllerDump(bytes)
  if(controller?.checksumOk)return 'controller'
  return decodeZaqBlock(bytes)?'sequencer':null
}
/** One bounded query per second while idle. No page writes, replay or fabricated mode. */
export function createPageFollower({ready,send,changed,interval=1000,timeout=800}:{ready:()=>boolean;send:(bytes:number[])=>void;changed:(page:EditorPage)=>void;interval?:number;timeout?:number}){
  let closed=false,pending=false,last:EditorPage|undefined,deadline:ReturnType<typeof setTimeout>|undefined,quietUntil=0
  const cancel=()=>{pending=false;if(deadline)clearTimeout(deadline);deadline=undefined}
  const tick=()=>{
    if(closed||pending||!ready()||Date.now()<quietUntil)return
    pending=true;deadline=setTimeout(cancel,timeout)
    try{send(currentPageQuery())}catch{cancel()}
  }
  const timer=setInterval(tick,interval)
  return {
    receive(bytes:number[]){
      if(closed||!pending||!ready())return false
      const page=pageFromExport(bytes);if(!page)return false
      cancel();if(page!==last){last=page;changed(page)}
      return true
    },
    requested(page:EditorPage){cancel();last=page;quietUntil=Date.now()+interval},
    close(){closed=true;clearInterval(timer);cancel()},
  }
}
