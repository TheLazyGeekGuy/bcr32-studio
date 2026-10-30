// Deterministic, offline catalogue compiler. Tables contain raw protocol values,
// not physical units inferred from UI labels. Does not access MIDI or the network.
import {readFileSync,writeFileSync} from 'node:fs'
const read=p=>JSON.parse(readFileSync(p,'utf8')),copy=x=>structuredClone(x)
const doc=read('src/sysex-catalog/starter.sxm.json'),extension='org.midistudio.value-domain.v1'
doc.id='classic-synth-catalogue';doc.name='Classic synthesizer SysEx catalogue'
doc.description='Manufacturer-table definitions. Coverage is specified per device; file rendering does not establish hardware or native BCL compatibility.'
const base=id=>doc.devices.find(d=>d.id===id)
const value={value:{shift:0,bits:7,add:0}}
function group(name){return name.match(/^(Osc(?:illator)? \d|Wave \d|Filter(?: \d)?|LFO \d|Effect \d|Mod(?:ifier)? \d|Arp(?:eggiator)?|Amplifier|Mixer|Operator \d|Instrument \d|Tone \d)/i)?.[0]??(/Envelope|Env\b/.test(name)?'Envelopes':/^Name/.test(name)?'Name':'Common')}
function parameter(device,row,bytes,section){
 const p={id:`parameter-${row.index}`,name:row.name,value:{minimum:row.minimum,maximum:row.maximum},fields:copy(device.parameters[0].fields),messages:[{bytes}],effect:row.effect??'edit-buffer',evidence:'manufacturer-documented',extensions:{'org.midistudio.catalogue':{section:group(row.name),reference:section,index:row.index}}}
 if(row.step||row.allowed)p.extensions[extension]={...(row.step?{step:row.step}:{}),...(row.allowed?{allowed:row.allowed}:{})}
 return p
}
function expandWaldorf(id,modelByte,tableName=id){
 const d=base(id),table=read(`src/sysex-catalog/tables/${tableName}.json`),prefix=copy(d.parameters[0].messages[0].bytes.slice(0,6)),old=copy(d.parameters)
 prefix[2]=modelByte
 const rows=table.rows.filter(r=>id!=='microwave2'||r.index!==51)
 d.parameters=rows.map(r=>parameter({...d,parameters:old},r,[...prefix,r.index>>7,r.index&127,value,247],`${table.scope} / index ${r.index}`))
 // Preserve public parameter IDs used by existing presets and imports.
 for(const p of d.parameters){const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id}
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:rows.length,reserved:table.reserved,metadata:table.metadata??[],excluded:id==='microwave2'?[51]:[]}}
 return d
}
expandWaldorf('blofeld',19)
const mw=expandWaldorf('microwave2',14);mw.name='Microwave II';mw.notes='Complete SDATA parameter indices except format metadata, reserved entries and XT-only external input. Effect interpretation depends on its selected algorithm. No physical qualification.'
const xt=copy(mw);xt.id='microwave-xt';xt.name='Microwave XT / XTk'
const xtTable=read('src/sysex-catalog/tables/microwave2.json'),external=xtTable.rows.find(r=>r.index===51)
xt.parameters.push(parameter(mw,external,[240,62,14,{field:'device',add:0},32,{field:'part',add:-1},0,51,value,247],'SDATA / index 51'))
xt.parameters.find(p=>p.extensions['org.midistudio.catalogue'].index===76).value.maximum=35
xt.extensions['org.midistudio.catalogue'].excluded=[];xt.extensions['org.midistudio.catalogue'].mapped=xt.parameters.length
xt.notes='SDATA includes XT-only external mixer input and the XT effect-type range. Shared wire model 0E; firmware-specific effect algorithms remain context dependent. No physical qualification.'
doc.devices.splice(doc.devices.indexOf(mw)+1,0,xt)
function expandYamaha(id,tableName,voiceGroup){
 const d=base(id),old=copy(d.parameters),table=read(`src/sysex-catalog/tables/${tableName}.json`),destination=copy(old[0].messages[0].bytes[2])
 d.parameters=table.rows.map(r=>{
  const group=['dx7','dx7ii','dx7s'].includes(tableName)?((r.group??0)<<2)|(r.index>>7):(r.group??voiceGroup)
  const p=parameter({...d,parameters:old},r,[240,67,destination,group,r.index&127,value,247],table.scope)
  p.id=`${r.group??voiceGroup}-${r.index}`
  const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length,reserved:table.reserved??[]}}
 return d
}
expandYamaha('dx7','dx7',0)
expandYamaha('tx81z','tx81z',18)
expandYamaha('dx7ii','dx7ii',0)
expandYamaha('dx7s','dx7s',0)
expandYamaha('dx21','dx21',18)
for(const id of ['an1x','an200']){
 const d=base(id),old=copy(d.parameters),table=read(`src/sysex-catalog/tables/${id}.json`),prefix=copy(old[0].messages[0].bytes.slice(0,6))
 d.parameters=table.rows.map(r=>{
  const p=parameter({...d,parameters:old},r,[...prefix,r.index,...(r.size===2?[{value:{shift:7,bits:7,add:0}},value]:[value]),247],table.scope)
  const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id
  if(r.note)p.extensions['org.midistudio.catalogue'].note=r.note
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length}}
}
for(const id of ['cs1x','cs2x']){
 const d=base(id),old=copy(d.parameters),table=read(`src/sysex-catalog/tables/${id}.json`),prefix=copy(old[0].messages[0].bytes.slice(0,6))
 d.parameters=table.rows.map(r=>{
  const p=parameter({...d,parameters:old},r,[...prefix,r.index,...(r.size===2?[{value:{shift:r.encoding==='nibbles'?4:7,bits:r.encoding==='nibbles'?4:7,add:0}},{value:{shift:0,bits:r.encoding==='nibbles'?4:7,add:0}}]:[value]),247],table.scope)
  const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length}}
}
{
 const d=base('fs1r'),old=copy(d.parameters),table=read('src/sysex-catalog/tables/fs1r.json')
 d.parameters=table.rows.map(r=>{
  const fields=copy(old[0].fields)
  if(r.block==='operator')fields.operator={name:'Operator',minimum:1,maximum:8,default:1}
  const p=parameter({parameters:[{fields}]},r,[240,67,{field:'device',add:15},94,{field:'part',add:r.block==='operator'?95:63},r.block==='operator'?{field:'operator',add:-1}:0,r.index,{value:{shift:7,bits:7,add:0}},value,247],table.scope)
  p.id=`${r.block}-${r.index}`
  const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id
  p.extensions['org.midistudio.catalogue'].section=r.block==='common'?'Voice Common':r.index<35?'Voiced Operator':'Unvoiced Operator'
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length,inventoryOnly:table.inventoryOnly}}
}
for(const id of ['jx8p','alpha-juno2','juno106','dw8000','dw6000']){
 const d=base(id),old=copy(d.parameters),table=read(`src/sysex-catalog/tables/${id}.json`),prefix=copy(old[0].messages[0].bytes.slice(0,id==='juno106'?4:['dw8000','dw6000'].includes(id)?5:7))
 d.parameters=table.rows.map(r=>{
  const p=parameter({...d,parameters:old},r,[...prefix,r.index,value,247],table.scope)
  const previous=old.find(o=>JSON.stringify(o.messages)===JSON.stringify(p.messages));if(previous)p.id=previous.id
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length,reserved:table.reserved??[]}}
}
{
 const d=base('microwave'),old=copy(d.parameters),table=read('src/sysex-catalog/tables/microwave.json')
 d.parameters=table.rows.map(r=>{
  const p=parameter({...d,parameters:old},r,[240,62,0,{field:'device',add:0},96,{field:'part',add:-1},r.index>>4,r.index&15,value,{checksum:{algorithm:'sum7',from:5,to:8}},247],table.scope)
  if(r.index===60)p.id='cutoff';if(r.index===61)p.id='resonance'
  return p
 })
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length,reserved:table.reserved,metadata:table.metadata}}
 d.notes='OS2.0 RTBP sound editing. Parameter numbers are zero-based within the 180-byte BPR data, excluding its five-byte dump header. Discrete raw values and sum7 checksum are enforced. No physical qualification.'
}
{
 const table=read('src/sysex-catalog/tables/jv2080.json')
 const device={name:'Device ID',minimum:16,maximum:31,default:16}
 const d={id:'jv2080',manufacturer:'Roland',name:'JV-2080',notes:'Patch-mode temporary edit buffer only, model6A. SysEx RX must be enabled; not received in GM mode. Effect parameters depend on the selected algorithm. No STORE, physical qualification or automatic transmission.',documentation:{sources:['jv2080'],section:table.scope},parameters:[]}
 doc.sources.jv2080=table.source
 function block(name,offset,rows){for(const row of rows){
  const r=copy(row)
  // Angle-bracket values are explicitly ignored by this model (manual p188).
  if(name.startsWith('Tone')){
   if(r.index===1)r.allowed=[0,2]
   if(r.index===9)r.allowed=[0,1,2,3,5,6,7]
   if([0x34,0x3c].includes(r.index))r.maximum=1
  }
  const bytes=[240,65,{field:'device',add:0},106,18,3,0,offset+(r.index>>7),r.index&127,...(r.size===2?[{value:{shift:4,bits:4,add:0}},{value:{shift:0,bits:4,add:0}}]:[value])]
  bytes.push({checksum:{algorithm:'complement7',from:5,to:bytes.length-1}},247)
  const p=parameter({parameters:[{fields:{device}}]},r,bytes,table.scope)
  p.id=`${name.toLowerCase().replaceAll(' ','-')}-${r.index}`;p.name=`${name} / ${r.name}`;p.extensions['org.midistudio.catalogue'].section=name
  d.parameters.push(p)
 }}
 block('Patch Common',0,table.sections['patch-common'])
 for(let tone=1;tone<=4;tone++)block(`Tone ${tone}`,16+(tone-1)*2,table.sections.tone)
 d.extensions={'org.midistudio.catalogue':{scope:table.scope,mapped:d.parameters.length,notCovered:['System','Performance','Rhythm','GS scale tune','User memory','Bulk requests']}}
 doc.devices.push(d)
}
{
 const d=base('bass-station-ii'),prefix=[240,0,32,41,0,51,0]
 const make=(id,name,effect,bytes,maximum=0,fields={})=>({id,name,effect,value:{minimum:0,maximum},fields,messages:[{bytes}],evidence:'manufacturer-documented',extensions:{'org.midistudio.catalogue':{section:'AFX overlay operations',reference:'Official appendix / AFX mode SysEx support'}}})
 const dest={destination:{name:'Destination overlay',minimum:0,maximum:24,default:0}}
 d.parameters.push(make('overlay-copy','Copy overlay to destination','global-change',[...prefix,75,{field:'destination',add:0},value,247],24,dest),make('overlay-move','Move overlay to destination (clears source)','global-change',[...prefix,77,{field:'destination',add:0},value,247],24,dest),make('overlay-save','Save current overlay bank','persistent-write',[...prefix,74,247]),make('overlay-clear-bank','Clear current overlay bank (unsaved)','global-change',[...prefix,73,247]),make('overlay-clear','Clear one overlay (unsaved)','global-change',[...prefix,76,value,247],24))
 d.parameters.push(make('tuning-fraction','Micro-tuning / note fraction','global-change',[240,127,0,8,2,{field:'table',add:0},1,{field:'note',add:0},{field:'pitch',add:0},{value:{shift:7,bits:7,add:0}},value,247],16383,{table:{name:'Tuning table',minimum:0,maximum:8,default:0},note:{name:'Original MIDI note',minimum:0,maximum:127,default:69},pitch:{name:'Target MIDI note',minimum:0,maximum:127,default:69}}))
 d.notes='AFX-capable firmware. Overlay request has a106-byte response; import requires its full opaque payload and is not synthesized. Copy/move/clear, persistent save and real-time tuning are file-only operations here. Hardware tuning accuracy is limited to semitone/256; not every14-bit fraction is physically distinct.'
 d.extensions={'org.midistudio.catalogue':{scope:'Official appendix / AFX mode SysEx support and Micro-tuning',mapped:d.parameters.length,inventoryOnly:[{name:'Import overlay4E',reason:'Requires captured overlay payload; no invented payload.'},{name:'CC / NRPN parameter control',reason:'Separate MIDI parameter table; not a SysEx message.'}]}}
}
{
 const d=base('m1'),fields=copy(d.parameters[0].fields),prefix=[240,66,{field:'channel',add:47},25]
 const existing=new Set(d.parameters.map(p=>p.messages[0].bytes[4]))
 for(const [opcode,name,bank]of [[18,'Mode request',false],[31,'PCM card drum names request',false],[22,'PCM card multisound names request',false],[28,'All programs request',true],[29,'All combinations request',true],[24,'All sequences request',true],[14,'Global data request',true],[15,'All data request',true]]){
  if(existing.has(opcode))continue
  d.parameters.push({id:`request-${opcode}`,name,value:{minimum:0,maximum:bank?1:0},fields:copy(fields),messages:[{bytes:[...prefix,opcode,...(bank?[value]:[]),247]}],effect:'request',evidence:'manufacturer-documented',extensions:{'org.midistudio.catalogue':{section:'Requests',reference:'MIDI Exclusive Format1-10 / PDF125'}}})
 }
 const table=read('src/sysex-catalog/tables/m1.json')
 for(const r of table.rows){
  const p=parameter({parameters:[{fields}]},r,[...prefix,65,r.page,r.position,value,{value:{shift:7,bits:7,add:0}},247],table.scope)
  p.id=`edit-${r.layout.toLowerCase()}-${r.page}-${r.position}`;p.name=`${r.layout} / ${r.name}`;p.extensions['org.midistudio.catalogue'].section=`Edit Program / ${r.layout}`
  d.parameters.push(p)
 }
 d.notes='Parameter changes require EDIT PROGRAM mode and the matching Single/Double layout, selected on the M1. The wire uses page and position8-15, not memory offsets. Signed values are rendered as14-bit two-complement; the native BCL adapter cannot load signed ranges. Requests do not decode replies here. No mode change or STORE is added.'
 d.extensions={'org.midistudio.catalogue':{scope:table.scope+'; requests1-10 / PDF125',mapped:d.parameters.length,inventoryOnly:[{name:'Packed switch/polarity and effect-algorithm parameters',reason:'Page/position alone does not establish the per-position value coding; not guessed from packed dump offsets.'},{name:'Combination / Global parameter pages',reason:'Table6 contexts are not projected into scalar templates in this scope.'},{name:'Program / Combination write11/1A',reason:'Persistent destination depends on memory allocation and bank; requires a dedicated write policy.'},{name:'Bulk program / combination / sequencer / global40/49/48/51',reason:'Requires full captured packed data and context; not a scalar template.'}]}}
}
// Keep established IDs and initial choices stable for stored editor drafts.
const original=read('src/sysex-catalog/starter.sxm.json')
for(const d of doc.devices){const ids=original.devices.find(x=>x.id===d.id)?.parameters.map(p=>p.id)??[];d.parameters.sort((a,b)=>(ids.includes(a.id)?ids.indexOf(a.id):Number.MAX_SAFE_INTEGER)-(ids.includes(b.id)?ids.indexOf(b.id):Number.MAX_SAFE_INTEGER))}
{
 const table=read('src/sysex-catalog/tables/a3000v2.json')
 Object.assign(doc.sources,table.sources)
 const d={id:'a3000v2',manufacturer:'Yamaha',name:'A3000 V2',
  notes:'Object-edit messages require the intended Program or Sample to have been selected on the A3000 first. No automatic object selection, request, STORE or transmission. V2 addresses replace several V1 meanings. Signed values are SXM file-only; no physical qualification.',
  documentation:{sources:['a3000v2','a3000'],section:table.scope},parameters:[],
  extensions:{'org.midistudio.catalogue':{scope:table.scope,mapped:table.rows.length,inventoryOnly:table.inventoryOnly,notCovered:table.notCovered}}}
 d.parameters=table.rows.map(r=>({id:r.id,name:`${r.block==='program'?'Program':'Sample'} / ${r.name}`,
  value:{minimum:r.minimum,maximum:r.maximum},
  fields:{device:{name:'Device number',minimum:1,maximum:16,default:1},...copy(r.fields)},
  messages:[{bytes:[240,67,{field:'device',add:15},88,1,...copy(r.address),
   ...Array.from({length:r.size*2},(_,i)=>{const shift=(r.size*2-1-i)*4;return {value:{shift,bits:r.size===2&&i===0&&r.maximum<=16383?2:4,add:0}}}),247]}],
  effect:'edit-buffer',evidence:'manufacturer-documented',
  extensions:{'org.midistudio.catalogue':{section:r.block==='program'?'Program':'Sample',reference:table.scope,objectContext:r.block}}}))
 doc.devices.push(d)
}
for(const d of doc.devices){const info=d.extensions?.['org.midistudio.catalogue'];if(info?.scope)d.documentation.section=info.scope}
doc.requiredExtensions=[extension]
const file='src/sysex-catalog/expanded.sxm.json',generated=JSON.stringify(doc)+'\n'
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==generated)throw Error('Generated catalogue is stale; run node scripts/build-sysex-catalog.mjs')}
else writeFileSync(file,generated)
console.log(JSON.stringify({models:doc.devices.length,parameters:doc.devices.reduce((n,d)=>n+d.parameters.length,0),bytes:Buffer.byteLength(JSON.stringify(doc))}))
