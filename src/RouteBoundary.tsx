import {Component,useEffect,useState,type ErrorInfo,type ReactNode} from 'react'
import {translate,useLanguage} from './i18n'
import {applyOfflineUpdate,getOfflineState,subscribeOffline} from './offline'

/** Last-resort screen: says what failed and offers the only action that can work (a waiting build, or a reload). */
export function RouteError({error}:{error?:unknown}){
  const language=useLanguage(),t=(s:string)=>translate(s,language)
  const [waiting,setWaiting]=useState(()=>getOfflineState().waiting)
  useEffect(()=>subscribeOffline(()=>setWaiting(getOfflineState().waiting)),[])
  const detail=error instanceof Error?error.message:error===undefined?'':String(error)
  return <div role="alert" className="route-error">
    <p>{t('Editor unavailable')}</p>
    {waiting&&<p>{t('A new version is available.')}</p>}
    {detail&&<p><small data-i18n-skip>{detail}</small></p>}
    <button onClick={applyOfflineUpdate}>{t(waiting?'Update and reload':'Retry editor')}</button>
  </div>
}
export class RouteBoundary extends Component<{children:ReactNode},{error:unknown;failed:boolean}>{
  state={error:undefined as unknown,failed:false}
  static getDerivedStateFromError(error:unknown){return {error,failed:true}}
  componentDidCatch(error:unknown,info:ErrorInfo){console.error('MIDI Studio: editor failed to load',error,info.componentStack)}
  render(){return this.state.failed?<RouteError error={this.state.error}/>:this.props.children}
}
