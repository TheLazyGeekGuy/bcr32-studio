import {evaluate,type Variables} from './expression'
import {validateProject,type TranslationProject} from './model'
import {validMidiMessage} from '../midi-message'
export const validMessage=validMidiMessage
export interface TranslationEvent {source:string;bytes:number[];value?:number;trace?:string[]}
export interface TranslationEffect {ruleId:string;target:string;bytes:number[];value?:number;trace:string[]}
export interface TranslationResult {effects:TranslationEffect[];matched:string[];errors:{ruleId:string;message:string}[]}
export const hex=(b:readonly number[])=>b.map(v=>v.toString(16).padStart(2,'0').toUpperCase()).join(' ')
export function templateTokens(s:string){const tokens=s.match(/\{[^{}]+\}|[0-9a-f]{2}/gi)??[];if(tokens.join('').toLowerCase()!==s.replace(/\s/g,'').toLowerCase()||tokens.length>16384)throw Error('Invalid MIDI template');return tokens}
function match(pattern:string,b:number[],vars:Variables){const captures:Variables=Object.create(null),tokens=templateTokens(pattern);if(tokens.length!==b.length)return false;for(let i=0;i<tokens.length;i++){const t=tokens[i];if(t[0]==='{'){const key=t.slice(1,-1);if(!/^[a-z][a-z0-9_]*$/i.test(key)||['__proto__','constructor','prototype'].includes(key))throw Error('Incoming fields must be variable names');if(Object.hasOwn(captures,key)&&captures[key]!==b[i])return false;captures[key]=b[i]}else if(parseInt(t,16)!==b[i])return false}Object.assign(vars,captures);return true}
export function renderMessage(template:string,vars:Variables){const bytes=templateTokens(template).map(t=>t[0]==='{'?evaluate(t.slice(1,-1),vars):parseInt(t,16));if(!validMessage(bytes))throw Error('Template produced invalid MIDI bytes; values are not coerced');return bytes}
function program(lines:string[],vars:Variables,eventBudget:{remaining:number}){
  const labels=new Map<string,number>();lines.forEach((l,i)=>{if(l.startsWith('label:')){if(labels.has(l.slice(6)))throw Error('Duplicate label');labels.set(l.slice(6),i)}})
  let ip=0,budget=1024
  while(ip<lines.length){if(--budget<0||--eventBudget.remaining<0)throw Error('Rule/event instruction budget exceeded');let line=lines[ip++].trim();if(!line||line.startsWith('//')||line.startsWith('label:'))continue
    const condition=line.match(/^if\s*\((.+)\)\s*(.+)$/);if(condition){if(!evaluate(condition[1],vars))continue;line=condition[2]}
    if(line==='execute')return true;if(line==='noexecute')return false
    if(line.startsWith('goto:')){const next=labels.get(line.slice(5));if(next===undefined)throw Error('Unknown label');ip=next;continue}
    const assignment=line.match(/^([a-z][a-z0-9_]*)\s*=\s*(.+)$/i);if(!assignment||['__proto__','constructor','prototype'].includes(assignment[1]))throw Error('Unsupported rule statement')
    vars[assignment[1]]=evaluate(assignment[2],vars)
  }
  return true
}
export function createTranslator(value:unknown){
  const project=validateProject(value);let globals:Variables=Object.create(null)
  return {project,reset(){globals=Object.create(null)},process(event:TranslationEvent):TranslationResult{
    const result:TranslationResult={effects:[],matched:[],errors:[]}
    const eventBudget={remaining:8192}
    if(event.value===undefined?!validMessage(event.bytes):!Number.isInteger(event.value)){result.errors.push({ruleId:'',message:'Invalid translator input'});return result}
    if((event.trace?.length??0)>=8){result.errors.push({ruleId:'',message:'Translation hop limit exceeded'});return result}
    for(const r of project.rules){if(!r.enabled||r.unsupported?.length||!r.sources.includes(event.source)||event.trace?.includes(r.id))continue
      const vars:Variables=Object.assign(Object.create(null),globals)
      if(eventBudget.remaining<=0){result.errors.push({ruleId:r.id,message:'Event instruction budget exceeded'});break}
      try{if(event.value!==undefined){if(r.incoming!=='value')continue;vars.value=event.value}else if(!match(r.incoming,event.bytes,vars))continue;result.matched.push(r.id);if(!program(r.rules,vars,eventBudget))continue
        // Validate the entire rule's output before exposing any effect. Multi-port delivery is still not atomic.
        const effects=r.outputs.map(o=>({ruleId:r.id,target:o.target,...(o.target.startsWith('parameter:')?{bytes:[],value:evaluate(o.message,vars)}:{bytes:renderMessage(o.message,vars)}),trace:[...(event.trace??[]),r.id]}))
        if(result.effects.length+effects.length>1024)throw Error('Translation output budget exceeded')
        if([...result.effects,...effects].reduce((sum,e)=>sum+e.bytes.length,0)>65536)throw Error('Translation byte budget exceeded')
        for(const [key,v]of Object.entries(vars))if(/^[g-n][a-z0-9]$/.test(key))globals[key]=v
        result.effects.push(...effects);if(r.stop)break
      }catch(e){result.errors.push({ruleId:r.id,message:String(e)})}
    }
    return result
  }}
}
export function simulate(project:TranslationProject,event:TranslationEvent){return createTranslator(project).process(event)}
