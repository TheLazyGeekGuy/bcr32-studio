import {useEffect,useRef,useState} from 'react'
import {translate,useLanguage} from '../i18n'

export function InstanceNameDialog({initial,model,submit,cancel}:{initial:string;model:string;submit:(name:string)=>void|Promise<void>;cancel:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),[name,setName]=useState(initial),[error,setError]=useState('')
  const language=useLanguage(),t=(text:string)=>translate(text,language)
  const [busy,setBusy]=useState(false),mounted=useRef(false)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current!.showModal();input.current?.focus();input.current?.select();return()=>{ref.current?.close();previous?.focus()}},[])
  return <dialog ref={ref} className="ew-name-dialog" aria-labelledby="ew-name-title" aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)cancel()}}>
    <form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);try{await submit(name.trim())}catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e))}finally{if(mounted.current)setBusy(false)}}}>
      <h2 id="ew-name-title">{t('New editor instance')}</h2><p data-i18n-skip>{model}</p>
      <label>{t('Tab name')}<input ref={input} value={name} required disabled={busy} maxLength={80} onChange={event=>{setName(event.target.value);setError('')}}/></label>
      {error&&<p role="alert">{t(error)}</p>}
      <footer><button type="button" disabled={busy} onClick={cancel}>{t('Cancel')}</button><button type="submit" disabled={busy}>{busy?'…':t('Create instance')}</button></footer>
    </form>
  </dialog>
}
