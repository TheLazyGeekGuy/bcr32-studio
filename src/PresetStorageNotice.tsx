import type {PresetBankSnapshot} from './preset-storage'
import {translate,useLanguage} from './i18n'
/** No storage access in this presenter; technical diagnostics remain verbatim. */
export function PresetStorageNotice({snapshot,reload,original}:{snapshot:PresetBankSnapshot<unknown>;reload:()=>void;original:()=>string|null|undefined}){
 const language=useLanguage(),t=(text:string)=>translate(text,language)
 if(!snapshot.error&&!snapshot.recoveryKey)return null
 return <aside aria-label="Preset storage status" role="status">
  {snapshot.error&&<p>{snapshot.error}</p>}
  {snapshot.recoveryKey&&<p>{t('Original preset bank preserved in a recovery copy.')} <code>{snapshot.recoveryKey}</code></p>}
  {snapshot.error&&<button onClick={reload}>{t('Reload preset bank')}</button>}
  <button disabled={original()==null} onClick={()=>{
   const raw=original();if(raw==null)return
   const url=URL.createObjectURL(new Blob([raw],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='midi-studio-original-preset-bank.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }}>{t('Export original preset bank')}</button>
 </aside>
}
