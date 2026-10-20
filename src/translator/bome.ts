import {emptyProject,validateProject,type TranslationRule,type TranslationProject} from './model'
import {templateTokens} from './core'
export interface BomeReport {project:TranslationProject;warnings:string[]}
const decode=(s:string)=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
function ports(s:string){if(!s)return [];if(!s.startsWith('MIDA'))throw Error('Unsupported port encoding');let i=8;const count=parseInt(s.slice(4,8),16),names:string[]=[];if(!Number.isInteger(count)||count>32)throw Error('Invalid port count');for(let n=0;n<count;n++){const len=parseInt(s.slice(i,i+4),16);i+=4;if(!Number.isInteger(len)||len<1||i+len>s.length)throw Error('Invalid port length');names.push(s.slice(i,i+len));i+=len}if(i!==s.length)throw Error('Trailing port data');return names}
const raw=(s:string)=>{if(!s||!/^(?:[0-9A-F]{2}|[a-z][a-z0-9])+$/.test(s))throw Error('Unsupported raw MIDI encoding');return (s.match(/[0-9A-F]{2}|[a-z][a-z0-9]/g)??[]).map(t=>/^[0-9A-F]{2}$/.test(t)?t:`{${t}}`).join(' ')}
function message(s:string,direction:'Incoming'|'Outgoing'): {message:string;ports:string[]}{
  if(s.startsWith('MID1')){const rest=s.slice(4);if(rest.startsWith('MIDD')){const len=parseInt(rest.slice(4,8),16);if(!Number.isInteger(len))throw Error('Invalid description');return {message:raw(rest.slice(8+len)),ports:[]}}return {message:raw(rest),ports:[]}}
  if(!s.startsWith('MID3'))throw Error(`Unsupported ${direction} action`)
  const xml=s.slice(4);if(xml.includes('<!')||xml.length>32768)throw Error('Invalid MIDI XML')
  const root=xml.match(new RegExp(`^<${direction} Action="MIDI">([\\s\\S]*)</${direction}>$`));if(!root)throw Error('Unsupported MIDI XML root')
  let body=root[1].replace(/<Description>[^<]*<\/Description>/g,'');const selected:string[]=[]
  body=body.replace(/<Ports>((?:<Port>[^<]*<\/Port>)+)<\/Ports>/g,(_all,items:string)=>{for(const p of items.matchAll(/<Port>([^<]*)<\/Port>/g))selected.push(decode(p[1]));return ''})
  const simple=body.match(/^<Simple Type="(ControlChange|NoteOn|NoteOff|ProgramChange|PitchBend|ChannelPressure|PolyPressure)">(.+)<\/Simple>$/)
  if(!simple)throw Error('Unsupported structured MIDI action')
  if(simple[1]==='PitchBend')throw Error('Structured Pitch Bend semantics require a dedicated converter; use raw MIDI')
  const fields:Record<string,string>={};let remaining=simple[2]
  remaining=remaining.replace(/<(Channel|Value1|Value2) ((?:[A-Za-z0-9]+="[^"]*"\s*)+)\/>/g,(_all,key:string,attrs:string)=>{
    const a:Record<string,string>={};for(const m of attrs.matchAll(/([A-Za-z0-9]+)="([^"]*)"/g))a[m[1]]=m[2]
    if(fields[key]||Object.keys(a).some(k=>!['num','var','Type'].includes(k)))throw Error('Unsupported MIDI field')
    if(a.Type==='Any')fields[key]='{'+(key==='Channel'?'channel':key==='Value1'?'parameter':'value')+'}'
    else if(a.var&&(!a.Type||a.Type==='SetVar')&&/^[a-z][a-z0-9]$/.test(a.var))fields[key]=`{${a.var}}`
    else if(a.num&&!a.Type&&/^(?:0x[0-9a-f]+|\d+)$/i.test(a.num))fields[key]=String(Number(a.num))
    else throw Error('Unsupported MIDI field constraints');return ''
  })
  if(remaining)throw Error('Unrecognized MIDI fields')
  const status=({ControlChange:176,NoteOn:144,NoteOff:128,ProgramChange:192,PitchBend:224,ChannelPressure:208,PolyPressure:160} as Record<string,number>)[simple[1]]
  const channel=fields.Channel;if(channel===undefined)throw Error('Missing channel')
  // A wildcard channel is captured as the complete status byte; numeric channels are zero-based.
  let start:string
  if(channel[0]==='{'){if(direction==='Outgoing')start=`{${status}+(${channel.slice(1,-1)}&15)}`;else start='{status}'}else {const n=Number(channel);if(n<0||n>15)throw Error('Invalid channel');start=(status+n).toString(16).toUpperCase()}
  const count=[192,208].includes(status)?1:2,parts=[start]
  for(let i=1;i<=count;i++){const field=fields[`Value${i}`];if(field===undefined)throw Error('Missing MIDI field');parts.push(field[0]==='{'?field:Number(field).toString(16).padStart(2,'0').toUpperCase())}
  return {message:parts.join(' '),ports:selected}
}
function options(s:string){
  const match=s.match(/^Actv(0[01])Stop(0[01])OutO00(?:StMa([0-9A-F]{8})(.*))?$/s);if(!match)throw Error('Unsupported options, timing or rule encoding')
  const count=match[3]?parseInt(match[3],16):0;let body=match[4]??'';const lines:string[]=[]
  for(let i=0;i<count;i++){
    if(body.startsWith('label')){const len=parseInt(body.slice(5,9),16);if(!Number.isInteger(len)||body.length<9+len)throw Error('Invalid rule length');const label=body.slice(9,9+len);body=body.slice(9+len);if(label.startsWith('__cmt>'))lines.push('//'+label.slice(6));else throw Error('Unsupported label/log statement')}
    else {const statement=body.match(/^(?:if\([^)]*\)(?:execute|noexecute)|execute|noexecute|[a-z][a-z0-9]=(?:(?![a-z][a-z0-9]=|label|if\()[a-z0-9x+*/%&|^~!<>=(). \-])+)/i);if(!statement)throw Error('Unsupported rule statement');lines.push(statement[0]);body=body.slice(statement[0].length)}
  }
  if(body)throw Error('Trailing rules');return {enabled:match[1]==='01',stop:match[2]==='01',lines}
}
export function importBome(text:string):BomeReport{
  if(text.length>2000000)throw Error('Bome project too large')
  const sections=new Map<string,Record<string,string>>();let current:Record<string,string>|undefined
  for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){if(!line.trim()||line.startsWith(';'))continue;const h=line.match(/^\[([^\]]+)\]$/);if(h){if(sections.has(h[1]))throw Error('Duplicate Bome section');current=Object.create(null);sections.set(h[1],current!);continue}const kv=line.match(/^([^=]+)=(.*)$/);if(!current||!kv||Object.hasOwn(current,kv[1]))throw Error('Invalid Bome INI');current[kv[1]]=kv[2]}
  if(!sections.has('Project'))throw Error('Missing Bome Project')
  const project=emptyProject(),warnings:string[]=[];project.name='Imported Bome project'
  const defaults=sections.get('Project')!;let defaultIn:string[]=[],defaultOut:string[]=[]
  if(defaults.Version!=='2')throw Error('Unsupported Bome project version')
  try{defaultIn=ports(defaults.DefaultInPorts??'');defaultOut=ports(defaults.DefaultOutPorts??'')}catch(e){warnings.push(String(e))}
  for(const [section,p]of sections){if(!/^Preset\.\d+$/.test(section))continue
    const indexes=Object.keys(p).filter(k=>/^Incoming\d+$/.test(k)).map(k=>Number(k.slice(8))).sort((a,b)=>a-b)
    for(const index of indexes){const r:TranslationRule={id:`bome-${section.slice(7)}-${index}`,name:(p[`Name${index}`]??`Translator ${index}`).slice(0,120),enabled:false,sources:[],incoming:'',rules:[],outputs:[],stop:false,original:JSON.stringify({section,preset:p.Name,active:p.Active,incoming:p[`Incoming${index}`],outgoing:p[`Outgoing${index}`],options:p[`Options${index}`]})}
      try{const input=message(p[`Incoming${index}`],'Incoming'),output=message(p[`Outgoing${index}`],'Outgoing'),o=options(p[`Options${index}`]??'');r.incoming=input.message;r.rules=o.lines;r.stop=o.stop
        // MID3 wildcard channels need explicit type filtering before capturing the channel number.
        if(r.incoming.startsWith('{status}')){const type=p[`Incoming${index}`].match(/<Simple Type="([^"]+)"/)?.[1],status=({ControlChange:176,NoteOn:144,NoteOff:128,ProgramChange:192,PitchBend:224,ChannelPressure:208,PolyPressure:160} as Record<string,number>)[type??''];r.rules.unshift(`if((status&240)!=${status})noexecute`);const variable=p[`Incoming${index}`].match(/<Channel var="([a-z][a-z0-9])"/)?.[1]??'channel';r.rules.splice(1,0,`${variable}=status&15`)}
        const ins=input.ports.length?input.ports:p.DefaultInPorts?ports(p.DefaultInPorts):defaultIn,outs=output.ports.length?output.ports:p.DefaultOutPorts?ports(p.DefaultOutPorts):defaultOut
        r.sources=ins.map(n=>'port:'+n);r.outputs=outs.map(n=>({target:'port:'+n,message:output.message}));if(!ins.length||!outs.length)throw Error('Missing explicit port aliases')
        if(Object.keys(p).some(k=>k.endsWith(String(index))&&!['Incoming','Outgoing','Options','Name'].some(prefix=>k===prefix+index)))throw Error('Unrecognized translator fields')
        r.enabled=p.Active==='1'&&o.enabled
      }catch(e){r.unsupported=[String(e)];warnings.push(`${r.id}: ${e}`)}
      project.rules.push(r)
    }
  }
  if(!project.rules.length)warnings.push('No translator entries found')
  if(sections.has('MIDI.routes'))warnings.push('MIDI Thru routes retained only in the source file; not activated')
  if(sections.has('Signatures'))warnings.push('Original signatures are not transferable; BomeBox/MT Player compatibility is not provided')
  warnings.push('Subset importer: verify all converted rules in simulation before arming; no native MT Pro round-trip proof')
  return {project:validateProject(project),warnings}
}
export function exportBome(value:unknown):string{
  const p=validateProject(value),parts=['; Studio unsigned MIDI-only subset; MT Pro round-trip not yet validated.','; No BomeBox/MT Player signatures.','[Project]','Version=2','']
  if(p.ports&&(p.ports.inputs!==null||p.ports.outputs!==null))throw Error('BMTP cannot preserve port filters; export JSON instead.')
  p.rules.forEach((r,i)=>{
    if(/[\r\n]/.test(r.name)||r.rules.some(line=>/[\r\n]/.test(line)))throw Error('Bome export fields must be single-line')
    if(r.unsupported?.length)throw Error(`Cannot export unsupported rule: ${r.name}`)
    const encodePorts=(names:string[])=>'MIDA'+names.length.toString(16).toUpperCase().padStart(4,'0')+names.map(n=>{if(!n.startsWith('port:')||/[^\x20-\x7E]/.test(n.slice(5)))throw Error('Bome export requires ASCII port aliases');const s=n.slice(5);return s.length.toString(16).toUpperCase().padStart(4,'0')+s}).join('')
    const encodeMessage=(s:string)=>'MID1'+templateTokens(s).map(t=>{if(t[0]!=='{')return t.toUpperCase();const variable=t.slice(1,-1);if(!/^[a-z][a-z0-9]$/.test(variable))throw Error('Bome raw export requires two-character variables, no inline expressions');return variable}).join('')
    if(!r.outputs.length||r.outputs.some(o=>o.message!==r.outputs[0].message))throw Error('Bome subset export requires identical output templates')
    const lines=r.rules.map(l=>l.trim()).filter(Boolean);if(lines.some(l=>!/^\/\//.test(l)&&!(/^[a-z][a-z0-9]=[^\r\n]+$/.test(l)||/^if\([^\r\n]+\)(?:execute|noexecute)$/.test(l)||['execute','noexecute'].includes(l))))throw Error('Unsupported Bome rule export')
    const body=lines.map(l=>l.startsWith('//')?'label'+('__cmt>'+l.slice(2)).length.toString(16).toUpperCase().padStart(4,'0')+'__cmt>'+l.slice(2):l).join('')
    parts.push(`[Preset.${i}]`,'Name='+r.name,`Active=${r.enabled?1:0}`,'DefaultInPorts='+encodePorts(r.sources),'DefaultOutPorts='+encodePorts(r.outputs.map(o=>o.target)), 'Name0='+r.name,'Incoming0='+encodeMessage(r.incoming),'Outgoing0='+encodeMessage(r.outputs[0].message),`Options0=Actv${r.enabled?'01':'00'}Stop${r.stop?'01':'00'}OutO00StMa${lines.length.toString(16).toUpperCase().padStart(8,'0')}${body}`,'PresetSwitchIgnore=0','')
  });return parts.join('\n')
}
