import {saveRecoverableDraft,type DraftStorage} from './editor-host/draft-storage'

/** The module owns the payload codec; the host owns neither MIDI nor a second session. */
export type PresetBankCodec<T>=(value:unknown)=>T[]
export interface PresetBankFormat<T>{decode:PresetBankCodec<T>;encode:(items:readonly T[])=>unknown}
export type PresetBankAdapter<T>=PresetBankCodec<T>|PresetBankFormat<T>
export function presetBankCodec<T>(entry:(value:unknown)=>T,limit:number):PresetBankCodec<T>{
 if(!Number.isInteger(limit)||limit<1)throw Error('Invalid preset limit')
 return value=>{if(!Array.isArray(value)||value.length>limit)throw Error(`Invalid preset bank (maximum ${limit})`);return value.map(entry)}
}
export interface PresetBankSnapshot<T>{items:T[];error:string|null;recoveryKey:string|null}
/** Synchronous explicit-operation repository. No timers, global storage, listeners or hardware effects.
 * Compare-before-write detects observed stale writers, not an atomic cross-tab transaction.
 */
export function createPresetRepository<T>(storage:()=>DraftStorage,key:string,codec:PresetBankAdapter<T>,now=()=>Date.now()){
 const decode=typeof codec==='function'?codec:codec.decode,encode=typeof codec==='function'?(items:readonly T[])=>items:codec.encode
 let expected:string|null|undefined,items:T[]=[],error:string|null=null,recoveryKey:string|null=null,recoveredOriginal:string|undefined
 const clone=(value:readonly T[])=>decode(JSON.parse(JSON.stringify(encode(value))))
 const snapshot=():PresetBankSnapshot<T>=>({items:clone(items),error,recoveryKey})
 const read=()=>{
  expected=undefined;items=[];error=null
  try{expected=storage().getItem(key);items=expected===null?clone([]):decode(JSON.parse(expected))}
  catch(e){error=`Preset bank unavailable: ${String(e)}`}
  return snapshot()
 }
 const save=(next:readonly T[]|((current:T[])=>readonly T[]))=>{
  try{
   const normalized=clone(typeof next==='function'?next(clone(items)):next),json=JSON.stringify(encode(normalized)),backend=storage()
   // A failed initial read is not evidence that the bank was empty.
   if(expected===undefined)throw Error('Read the preset bank successfully before saving')
   if(backend.getItem(key)!==expected)throw Error('Preset bank changed elsewhere; reload it before saving')
   const original=expected,recovery=saveRecoverableDraft(backend,key,json,decode,now,expected)
   if(recovery){recoveryKey=recovery;recoveredOriginal=original??undefined}
   if(backend.getItem(key)!==json)throw Error('Preset bank write could not be verified; reload before retrying')
   expected=json;items=normalized;error=null
   return snapshot()
  }catch(e){error=String(e);throw e}
 }
 return {read,save,getSnapshot:snapshot,original:()=>recoveredOriginal??expected}
}
