import {useEffect,useState} from 'react'
import {applyOfflineUpdate,getOfflineState,subscribeOffline} from './offline'
import {translate,useLanguage} from './i18n'
export function OfflineStatus(){
  const [state,setState]=useState(getOfflineState),language=useLanguage()
  useEffect(()=>{const refresh=()=>setState(getOfflineState()),off=subscribeOffline(refresh);refresh();return off},[])
  if(!state.supported)return null
  const label=state.waiting?'New version available':!state.online?(state.ready?'Offline · editor available':'Offline cache is not ready.'):state.ready?'Editor available offline':state.failed?'Offline cache unavailable':'Preparing offline access…'
  return <span className="offline-status" role="status" aria-label={translate(label,language)} title={translate(label,language)} data-ready={state.ready} data-online={state.online}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v12H4zM9 21h6M12 17v4"/>{state.ready&&<path d="m8 10 3 3 5-6"/>}</svg>{!state.online&&<small>{translate('Offline',language)}</small>}{state.waiting&&state.online&&<small className="offline-new">{translate('New version available',language)}</small>}{state.waiting&&state.online&&<button type="button" className="offline-update" onClick={applyOfflineUpdate} title={translate('Reloads the page: finish any MIDI transfer first.',language)}>{translate('Update and reload',language)}</button>}</span>
}
