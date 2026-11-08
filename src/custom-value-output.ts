import {evaluateAssignment,parseCustomAssignment} from './bcl-tx'

/** Evaluate source again at the output boundary; imported descriptors are not permissions. */
export function customValueMessages(source:string,value:number):number[][] {
  const program=parseCustomAssignment(source)
  const messages=evaluateAssignment(program,value)
  if(!messages.length||messages.length>4||messages.some(b=>b.length>256))throw Error('Custom value output supports up to four SysEx messages of 256 bytes')
  return messages
}

export type CustomValueGesture={key:string;source:string;value:number}
export function createCustomValueQueue(send:(gesture:CustomValueGesture)=>void,failed:(error:unknown)=>void,interval=33){
  const latest=new Map<string,CustomValueGesture>(),ordered:CustomValueGesture[]=[]
  let timer:ReturnType<typeof setTimeout>|null=null,closed=false
  const cancel=()=>{latest.clear();ordered.length=0;if(timer!==null)clearTimeout(timer);timer=null}
  const flush=()=>{
    timer=null
    const rotations=[...latest.values()].slice(0,4)
    for(const gesture of rotations)latest.delete(gesture.key)
    const batch=[...rotations,...ordered.splice(0,4)]
    for(const gesture of batch){if(closed)break;try{send(gesture)}catch(error){closed=true;cancel();failed(error);break}}
    if(!closed&&(ordered.length||latest.size))timer=setTimeout(flush,interval)
  }
  return {
    enqueue(gesture:CustomValueGesture,keepOrder=false){
      if(closed)return
      // Fail before changing the UI queue; no unsupported program can become raw output.
      customValueMessages(gesture.source,gesture.value)
      if(!gesture.key||gesture.key.length>100)throw Error('Invalid custom control key')
      if(keepOrder){if(ordered.length>=128){closed=true;cancel();failed(Error('Custom value queue full; sending stopped'));return}ordered.push({...gesture})}
      else{if(!latest.has(gesture.key)&&latest.size>=128)throw Error('Too many custom value controls');latest.set(gesture.key,{...gesture})}
      timer??=setTimeout(flush,interval)
    },
    cancel,
    close(){closed=true;cancel()},
  }
}
