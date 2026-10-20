/** Injected synchronous storage; no ambient browser access or import-time side effects. */
export interface DraftStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export function saveRecoverableDraft(storage:DraftStorage,key:string,next:string,validate:(value:unknown)=>unknown,now=()=>Date.now(),expectedOriginal?:string|null):string|null{
 validate(JSON.parse(next)) // Invalid replacement cannot mutate storage.
 const original=storage.getItem(key)
 if(expectedOriginal!==undefined&&original!==expectedOriginal)throw Error('Stored data changed before save; original not replaced')
 let recovery:string|null=null
 if(original!==null){
  let invalid=false;try{validate(JSON.parse(original))}catch{invalid=true}
  if(invalid){
   const base=`${key}.invalid.${now()}`;recovery=base
   let suffix=0;while(storage.getItem(recovery)!==null){if(++suffix>1000)throw Error('Draft recovery key budget exceeded');recovery=`${base}.${suffix}`}
   storage.setItem(recovery,original)
   if(storage.getItem(recovery)!==original)throw Error('Draft backup could not be verified; original not replaced')
  }
 }
 // Detect a competing writer observed during backup. This is not a cross-tab atomic transaction.
 if(storage.getItem(key)!==original)throw Error('Draft changed during save; original not replaced')
 storage.setItem(key,next)
 return recovery
}
