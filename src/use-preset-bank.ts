import {useMemo,useState} from 'react'
import {createPresetRepository,type PresetBankAdapter,type PresetBankSnapshot} from './preset-storage'
import type {DraftStorage} from './editor-host/draft-storage'
/** Stable codecs/keys scope a bank to one mounted instance. Storage acquisition may itself throw. */
export function usePresetBank<T>(storage:()=>DraftStorage,key:string,decode:PresetBankAdapter<T>){
 const repository=useMemo(()=>createPresetRepository(storage,key,decode),[storage,key,decode])
 const [loaded,setLoaded]=useState(()=>({repository,snapshot:repository.read()}))
 let snapshot:PresetBankSnapshot<T>=loaded.snapshot
 if(loaded.repository!==repository){snapshot=repository.read();setLoaded({repository,snapshot})}
 return {snapshot,
  save(next:readonly T[]|((items:T[])=>readonly T[])){try{return repository.save(next).items}finally{setLoaded({repository,snapshot:repository.getSnapshot()})}},
  reload(){setLoaded({repository,snapshot:repository.read()})},original:repository.original}
}
