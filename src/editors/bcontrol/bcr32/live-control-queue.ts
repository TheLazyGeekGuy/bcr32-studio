import type {ProgramTarget} from './custom-program'
import type {Encoder} from './profile'
/** Latest pending edit per physical target; one verified transaction at a time. No retries or reconnect replay. */
export function createLiveControlQueue({ready,write,changed}:{ready:()=>boolean;write:(target:ProgramTarget,control:Encoder)=>Promise<void>;changed:(status:'pending'|'writing'|'confirmed'|'failed',target?:ProgramTarget,error?:string)=>void},delay=250){
 const queue=new Map<string,{target:ProgramTarget;control:Encoder}>();let timer:ReturnType<typeof setTimeout>|undefined,running=false,closed=false
 const cancel=()=>{queue.clear();if(timer)clearTimeout(timer);timer=undefined}
 const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=undefined;void flush()},delay)}
 async function flush(){
  if(closed||running||!queue.size)return
  if(!ready()){cancel();changed('failed',undefined,'Assignment remains local: live hardware unavailable');return}
  const [key,job]=queue.entries().next().value!;queue.delete(key);running=true;changed('writing',job.target)
  try{await write(job.target,job.control);if(!closed)changed('confirmed',job.target)}catch(error){cancel();if(!closed)changed('failed',job.target,error instanceof Error?error.message:String(error))}
  finally{running=false;if(!closed&&queue.size)schedule()}
 }
 return {enqueue(target:ProgramTarget,control:Encoder){if(closed)throw Error('Assignment queue closed');if(queue.size>=82&&!queue.has(`${target.kind}:${target.id}`))throw Error('Assignment queue full');queue.set(`${target.kind}:${target.id}`,{target:{...target},control:structuredClone(control)});changed('pending',target);schedule()},cancel,close(){closed=true;cancel()}}
}
