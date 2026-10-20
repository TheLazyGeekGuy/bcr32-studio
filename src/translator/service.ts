import type {MidiBroker} from '../editor-host/midi-broker'
import type {MidiAccess} from '../web-midi'
import {createTranslator,hex,type TranslationEvent,type TranslationResult} from './core'
import {emptyProject,validateProject,type TranslationProject} from './model'
import {createParameterBus,type ParameterBus} from './parameters'
import {learnMidi,type LearnedMidi} from './learn'
import {portAllowed,portOptions} from './ports'
export interface TranslatorState {project:TranslationProject;armed:boolean;error:string|null;logs:string[];received:number;sent:number;learning:string|null;learned:(LearnedMidi&{ruleId:string;source:string;inputId:string;portName:string})|null}
export function createTranslatorService(broker:MidiBroker,access:MidiAccess,parameters:ParameterBus=createParameterBus()){
  let project=emptyProject(),engine=createTranslator(project),armed=false,epoch=0,error:string|null=null,logs:string[]=[],received=0,sent=0,disposed=false,budgetStart=0,budgetBytes=0,budgetMessages=0
  const client=broker.createRoutingClient('translator',message=>{armed=false;error=message;engine.reset();log(message)}),listeners=new Set<()=>void>()
  let timer:ReturnType<typeof setTimeout>|undefined
  const notify=()=>{if(timer===undefined&&!disposed)timer=setTimeout(()=>{timer=undefined;listeners.forEach(f=>{try{f()}catch{/* observer isolation */}})},33)}
  const log=(s:string)=>{logs=[...logs.slice(-99),s.slice(0,500)];notify()}
  let learning:string|null=null,learned:TranslatorState['learned']=null,learnTimer:ReturnType<typeof setTimeout>|undefined
  const learnClient=broker.createRoutingClient('translator-learn',message=>{cancelLearn();error=message;notify()})
  const cancelLearn=()=>{learning=null;if(learnTimer!==undefined)clearTimeout(learnTimer);learnTimer=undefined;learnClient.disarm();notify()}
  const stop=()=>{cancelLearn();epoch++;armed=false;client.disarm();engine.reset();notify()}
  const portId=(direction:'input'|'output',alias:string)=>{if(!alias.startsWith('port:'))throw Error('Expected a MIDI port alias');const name=alias.slice(5),map=direction==='input'?access.inputs:access.outputs;const matches=[...map.values()].filter(p=>p.state==='connected'&&(p.id===name||p.name===name));if(matches.length!==1)throw Error(`Missing or ambiguous ${direction}: ${name}`);if(!portAllowed(access,direction,matches[0].id,project.ports))throw Error('MIDI port excluded by project filters: '+name);return matches[0].id}
  let outputs=new Map<string,string>()
  const handle=(event:TranslationEvent):TranslationResult=>{
    if(!armed)return {effects:[],matched:[],errors:[]};const revision=epoch;received++;const result=engine.process(event)
    try{
      client.check();const now=performance.now();if(now-budgetStart>1000){budgetStart=now;budgetBytes=0;budgetMessages=0}
      const bytes=result.effects.reduce((n,e)=>n+e.bytes.length,0);if(budgetBytes+bytes>65536||budgetMessages+result.effects.length>2048)throw Error('Translator per-second budget exceeded')
      budgetBytes+=bytes;budgetMessages+=result.effects.length
      if(result.errors.length)throw Error(result.errors.map(e=>e.ruleId+': '+e.message).join('; '))
      for(const effect of result.effects){if(!armed||revision!==epoch)throw Error('Translator disarmed during delivery');if(effect.target.startsWith('parameter:')){parameters.setLocal(effect.target.slice(10),effect.value!,effect.trace);log(`${effect.ruleId} → ${effect.target} = ${effect.value}`)}else{const id=outputs.get(effect.target);if(!id)throw Error('Unbound output alias');client.send(id,effect.bytes);log(`${effect.ruleId} → ${effect.target}: ${hex(effect.bytes)}`)}sent++}
    }catch(e){error=String(e);log(`Stopped; output may be partial. ${error}`);stop()}
    notify();return result
  }
  const offParameters=parameters.subscribe(e=>handle({source:'parameter:'+e.id,bytes:[],value:e.value,trace:e.trace}))
  const offCatalog=parameters.onEndpointChange(id=>{const target='parameter:'+id;if(armed&&project.rules.some(r=>r.enabled&&(r.sources.includes(target)||r.outputs.some(o=>o.target===target)))){error='Parameter endpoints changed; review the rules and rearm';log(error);stop()}})
  return {parameters,getSnapshot:():TranslatorState=>({project:validateProject(project),armed,error,logs:[...logs],received,sent,learning,learned:learned?{...learned,bytes:[...learned.bytes],processing:[...learned.processing]}:null}),
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
    configure(value:unknown){if(disposed)throw Error('Translator disposed');const next=validateProject(value);stop();learned=null;project=next;engine=createTranslator(project);error=null;notify()},
    cancelLearn,
    startLearn(ruleId:string){
      if(disposed)throw Error('Translator disposed')
      const rule=project.rules.find(r=>r.id===ruleId);if(!rule||rule.unsupported?.length)throw Error('Choose a supported rule first.')
      stop();error=null;learned=null
      const inputs=[...access.inputs.values()].filter(p=>p.state==='connected'&&portAllowed(access,'input',p.id,project.ports))
      if(!inputs.length)throw Error(project.ports?.inputs!=null?'No MIDI input matches the port filter.':'Connect a MIDI input first.')
      try{learning=ruleId;learnClient.arm(inputs.map(p=>p.id),[],false,(inputId,bytes)=>{
        const capture=learnMidi(bytes);if(!capture||learning!==ruleId)return
        const port=access.inputs.get(inputId);if(!port||port.state!=='connected')return
        const name=port.name||port.id,source=portOptions(access,'input').find(p=>p.portId===inputId)?.id
        if(!source)return
        // Replace the input association only; output authorization is never inferred from an input.
        try{const next=validateProject({...project,rules:project.rules.map(r=>r.id===ruleId?{...r,sources:[source],incoming:capture.incoming,rules:[...capture.processing,...(r.rules[0]==='value=lsb+(msb<<7)'?r.rules.slice(1):r.rules)]}:r)})
          cancelLearn();project=next;engine=createTranslator(project);learned={...capture,ruleId,source,inputId,portName:name};log(`Learn: ${name} · ${capture.description} · ${hex(bytes)}`)
        }catch(e){cancelLearn();error=String(e);notify()}
      });learnTimer=setTimeout(()=>{cancelLearn();error='MIDI Learn timed out.';notify()},30000);notify()
      }catch(e){cancelLearn();error=String(e);notify();throw e}
    },
    arm(allowSysex:boolean){if(disposed)throw Error('Translator disposed');stop();error=null;outputs=new Map();const inputAliases=new Map<string,string[]>(),inputIds=new Set<string>(),outputIds=new Set<string>()
      try{const enabled=project.rules.filter(r=>r.enabled);if(!enabled.length)throw Error('Enable a translator rule first')
        for(const rule of enabled){if(!rule.sources.length||!rule.outputs.length)throw Error('Rule needs sources and destinations');for(const source of rule.sources){if(source.startsWith('parameter:')){if(!parameters.list().some(p=>'parameter:'+p.id===source))throw Error('Unknown source parameter');continue}const id=portId('input',source);inputIds.add(id);const aliases=[...new Set([...(inputAliases.get(id)??[]),source])];if(aliases.length>1)throw Error('Use a single alias per physical input to avoid duplicate translations');inputAliases.set(id,aliases)}for(const o of rule.outputs){if(o.target.startsWith('parameter:')){if(!parameters.list().some(p=>'parameter:'+p.id===o.target))throw Error('Unknown target parameter');continue}const id=portId('output',o.target);outputs.set(o.target,id);outputIds.add(id)}}
        client.arm([...inputIds],[...outputIds],allowSysex,(id,bytes)=>{for(const source of inputAliases.get(id)??[])handle({source,bytes})});budgetStart=performance.now();budgetBytes=0;budgetMessages=0;armed=true;log('Armed · no startup messages sent')
      }catch(e){error=String(e);stop();throw e}
    },stop,handle,
    dispose(){if(disposed)return;stop();disposed=true;client.close();learnClient.close();offParameters();offCatalog();if(timer!==undefined)clearTimeout(timer);listeners.clear()}}
}
export type TranslatorService=ReturnType<typeof createTranslatorService>
