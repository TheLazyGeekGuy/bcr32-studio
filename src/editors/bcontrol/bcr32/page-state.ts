/** Firmware1.0.3 only. Paired physical CTRL/ZQR captures: work item #36.
 * Observes availability of the existing48/00 state read, never export08.
 * Exact02 refusal in CTRL and a valid five-byte state in ZQR are qualified
 * only for this firmware. No timeout/other error implies a hardware mode.
 */
import {createZaqHost,type HostReply} from './zaq-host'
import type {EditorPage} from './page-follow'

export function createPageState(options:{
  firmware:string;device:number;send:(bytes:number[])=>void;
  canPoll:()=>boolean;onPage:(page:EditorPage)=>void;now?:()=>number;timeout?:number;
}) {
  if(options.firmware!=='1.0.3')throw Error('Page state requires qualified firmware1.0.3')
  const now=options.now??(()=>performance.now())
  const client=createZaqHost(options.send,options.device,options.timeout)
  let closed=false,generation=0,pending:Promise<HostReply>|null=null,lastAttempt=-Infinity,quietUntil=0
  let candidate:EditorPage|null=null,candidateAt=0,confirmed:EditorPage|null=null
  const reset=()=>{candidate=null;candidateAt=0}
  const observe=(reply:HostReply)=>{
    const page:EditorPage|null=reply.command===0x48&&reply.operation===0
      ?reply.status===2&&reply.values.length===0?'controller'
        :reply.status===0&&reply.values.length===5&&[0,1].includes(reply.values[0])?'sequencer':null
      :null
    if(!page){reset();return}
    if(page!==candidate){candidate=page;candidateAt=now();return}
    // Two independent replies separated by at least500ms; not two consumers of one promise.
    if(now()-candidateAt>=500&&page!==confirmed&&options.canPoll()){confirmed=page;options.onPage(page)}
  }
  const state=()=>{
    if(closed)return Promise.reject(Error('Page state session closed'))
    if(pending)return pending
    const epoch=generation;lastAttempt=now()
    const exchange=client.stateReply().then(reply=>{
      if(!closed&&epoch===generation&&now()>=quietUntil)observe(reply)
      return reply
    },error=>{if(epoch===generation){reset();quietUntil=now()+1500}throw error})
    pending=exchange
    void exchange.finally(()=>{if(pending===exchange)pending=null}).catch(()=>{})
    return exchange
  }
  return {
    state,
    receive:(bytes:readonly number[])=>{if(!closed)client.receive(bytes)},
    tick:()=>{if(!closed&&!pending&&now()>=quietUntil&&now()-lastAttempt>=1000&&options.canPoll())void state().catch(()=>{})},
    // A user page action invalidates observations already in flight and leaves time for hardware to settle.
    manual:()=>{generation++;reset();confirmed=null;quietUntil=now()+1500},
    close:()=>{closed=true;generation++;reset();client.close()},
  }
}
