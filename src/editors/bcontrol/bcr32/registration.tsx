import {deploymentStorage} from '../../../deployment-storage'
import type {EditorViewRegistration,EditorViewContext,EditorViewProps} from '../../../editor-host/view-contract'
import type {MidiAuthorization,MidiOperation} from '../../../editor-host/midi-broker'
import {createMidiViewAccess} from '../../../editor-host/midi-view-access'
import {createEditorEnvironment} from '../../../editor-environment'
import {bcr32} from '../../../device-bcr32'
import {usePresentationSettings} from '../../../editor-host/PresentationTools'
import {createMonitor} from '../../../midi-monitor'
import {parseControllerState} from './presets'
import {automaticPorts,isControllerPort} from './auto-midi'
import {isFrame,isFirmwareRead,midiFrame,integer} from './firmware-codec'
import {supportsCustomProgram} from './custom-program-transfer'
import {supportsPresetStorage} from './preset-store'
import {parseFirmwareReply} from './web-midi'
import {plannedOperation,validateEditBuffer,validateQuery} from './host-policy'
import {isZaqHostQuery,isZaqHostWrite,isHostPage,supportsZaqHost} from './zaq-host'
import Workbench from './Workbench'
import './workbench.css'

export function createWorkbenchBridge(context:EditorViewContext){
 let help:(()=>void)|undefined,midiSettings:(()=>void)|undefined
 let disposed=false,locked=false
 let identity:{firmware:string;device:number}|null=null
 const monitor=createMonitor()
 let prepared:{frames:number[][];cursor:number;grant:MidiAuthorization;generation:number;program:boolean}|null=null
 const grants=new Map<MidiOperation,MidiAuthorization>()
 const revokePrepared=()=>{if(prepared)context.broker.revoke(prepared.grant);prepared=null}
 const offState=context.lease.onState(()=>{identity=null;revokePrepared();for(const grant of grants.values())context.broker.revoke(grant);grants.clear()})
 const offRx=context.lease.subscribe(packet=>{monitor.push('in',packet.bytes);const firmware=parseFirmwareReply(packet.bytes);if(firmware)identity={firmware,device:packet.bytes[4]}})
 const midi=createMidiViewAccess(context.id,bcr32,context.access,context.broker,context.lease,{
  matchesPort:isControllerPort,
  send(bytes){
   if(disposed)throw Error('BCR32 view disposed')
   const state=context.lease.getState()
   if(!state.connected)throw Error('BCR32 is disconnected')
   let operation:MidiOperation='value',grant:MidiAuthorization|undefined
   if(bytes[0]===240){
    if(supportsZaqHost(identity?.firmware)&&isHostPage(bytes)){if(locked)throw Error('BCR32 page change refused while locked');operation='edit-buffer'}
    else if(validateQuery(bytes)){if(isFirmwareRead(bytes)&&(!identity||!['1.0.2','1.0.3'].includes(identity.firmware)))throw Error('Live firmware 1.0.2/1.0.3 required for indexed/preset reads');if(isZaqHostQuery(bytes)&&!supportsZaqHost(identity?.firmware))throw Error('Live firmware 1.0.3 required for sequencer reads');operation='query'}
    else if(isFrame(bytes)&&bytes[6]===32){
     if(!identity||!prepared||(prepared.program?!supportsCustomProgram(identity.firmware):!supportsPresetStorage(identity.firmware))||bytes[4]!==identity.device||locked||state.generation!==prepared.generation||JSON.stringify(bytes)!==JSON.stringify(prepared.frames[prepared.cursor]))throw Error('BCR32 BCL job is not prepared or is stale')
     operation=prepared.grant.operation;grant=prepared.grant
    }else if(!locked&&supportsZaqHost(identity?.firmware)&&isZaqHostWrite(bytes))operation='edit-buffer'
    else if(!locked&&identity?.firmware==='1.0.2'&&bytes[4]===identity.device&&validateEditBuffer(bytes))operation='edit-buffer'
    else throw Error('BCR32 output refused by module policy')
   }
   if(!grant){grant=grants.get(operation);if(!grant){grant=context.broker.authorize(context.id,operation);grants.set(operation,grant)}}
   context.lease.send([bytes],grant)
   if(bytes[0]===240&&bytes[6]===32&&prepared)prepared.cursor++
   monitor.push('out',bytes)
  },
 })
 return {monitor,access:midi.access,setHelp(open:(()=>void)|undefined){help=open},openHelp(){help?.()},
  setMidiSettings(open:(()=>void)|undefined){midiSettings=open},openMidiSettings(){midiSettings?.()},
  setLocked(value:boolean){locked=value;if(value)revokePrepared()},
  async request(){const result=await context.request();if(disposed)throw Error('BCR32 view disposed');midi.refresh();const pair=automaticPorts(midi.access);if(pair.input&&pair.output)midi.bind(pair.input.id,pair.output.id);return {access:midi.access,sysexError:result.sysexError}},
  bind(input:string,output:string){midi.bind(input,output)},
  refresh:midi.refresh,
  setProgramTypeOff(index:number){
   if(disposed||locked||!identity||!supportsCustomProgram(identity.firmware)||prepared)throw Error('Custom program Type OFF unavailable')
   integer(index,0,81)
   const bytes=midiFrame(0x31,[index,0],identity.device),grant=context.broker.authorize(context.id,'edit-buffer')
   try{context.lease.send([bytes],grant);monitor.push('out',bytes)}finally{context.broker.revoke(grant)}
  },
  authorizeTransfer(frames:number[][]){
   const program=!!frames[1]&&/^\$(encoder|button) /.test(String.fromCharCode(...frames[1].slice(9,-1)))
   if(disposed||locked||prepared||!identity||(program?!supportsCustomProgram(identity.firmware):!supportsPresetStorage(identity.firmware)))throw Error('BCR32 transfer unavailable')
   if(frames.some(b=>b[4]!==identity!.device))throw Error('Transfer device ID differs from the live controller')
   const operation=plannedOperation(frames),generation=context.lease.getState().generation
   const job={frames:frames.map(b=>[...b]),cursor:0,grant:context.broker.authorize(context.id,operation),generation,program};prepared=job
   return ()=>{context.broker.revoke(job.grant);if(prepared===job)prepared=null}
  },
  dispose(){if(disposed)return;disposed=true;help=undefined;midiSettings=undefined;revokePrepared();offRx();offState();midi.close();grants.forEach(g=>context.broker.revoke(g));grants.clear();monitor.dispose()},
 }
}
function MountedWorkbench({context,bridge,storage,initial,...props}:EditorViewProps&{context:EditorViewContext;bridge:ReturnType<typeof createWorkbenchBridge>;storage:ReturnType<typeof createEditorEnvironment>['storage'];initial:ReturnType<typeof parseControllerState>}){
 const inherited=usePresentationSettings(props.presentation)
 bridge.setLocked(props.locked)
 return <div className="bcr32-workbench" data-bcr32-instance={context.id} data-theme={props.appearance.theme}>
  <Workbench storage={storage} initialState={initial} instanceId={context.id} locked={props.locked} active={props.active}
   requestAccess={bridge.request} bindPair={bridge.bind} onSnapshot={props.checkpoint}
   themeOverride={props.appearance.theme} displayOverride={props.appearance.displayStyle} onAppearance={props.onAppearance}
   autoZoomOverride={inherited.settings.activeZoom} onAutoZoom={value=>props.presentation?.set({activeZoom:value})}
   parameters={context.parameters} presetsExchange={context.presets} signal={context.lifecycle?.signal} presentation={props.presentation} onHelpReady={bridge.setHelp} onMidiSettingsReady={bridge.setMidiSettings} monitor={bridge.monitor} authorizeTransfer={bridge.authorizeTransfer} setProgramTypeOff={bridge.setProgramTypeOff}/>
 </div>
}
export const bcr32View:EditorViewRegistration={
 moduleId:'bcr32-editor',viewVersion:1,presentation:{manufacturer:'Behringer',model:'BCR32',preview:{src:'/editor-previews/bcr32.svg',width:1717,height:1440,kind:'schematic'}},
 matchesPort:isControllerPort,
 loadInitial(id){const env=createEditorEnvironment(bcr32,id);env.seedLegacy();return parseControllerState(env.loadDraft())},
 create(context){
  const env=createEditorEnvironment(bcr32,context.id),bridge=createWorkbenchBridge(context)
  env.seedLegacy()
  for(const key of ['bcr32-studio.controller-autoread','bcr32-studio.assignment-live','bcr32-studio.preset-cache']){
   try{if(env.storage.getItem(key)===null){const legacy=deploymentStorage().getItem(key);if(legacy!==null)env.storage.setItem(key,legacy)}}catch{/* Preference migration is optional; originals remain intact. */}
  }
  const initial=parseControllerState(context.initial)
  const off=context.lifecycle?.onDispose(bridge.dispose)
  return {render:props=><MountedWorkbench {...props} context={context} bridge={bridge} storage={env.storage} initial={initial}/>,openDocumentation:bridge.openHelp,openMidiSettings:bridge.openMidiSettings,refresh:bridge.refresh,dispose(){off?.();bridge.dispose()}}
 },
}
