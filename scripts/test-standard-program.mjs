import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),r=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/standard-program';export * from './src/editors/bcontrol/bcr32/custom-program-transfer';export * from './src/editors/bcontrol/bcr32/profile';export * from './src/editors/bcontrol/bcr32/live-control-queue'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,mod,mod.exports);const m=mod.exports
const rotation={kind:'encoders',id:8},button={kind:'buttons',id:12},push={kind:'pushes',id:8},base={...m.createEncoder(8),type:'cc',parameter:23,ledMode:'bar',display:true}
for(const type of ['cc','nrpn','gs','at','pb','off']){
 const e={...base,type,parameter:type==='gs'?0:23,...(type==='pb'?{minimum:1}:{} )},body=m.standardProgramBody(rotation,e);m.fragmentForBody(rotation,body)
 assert.ok(!body.includes('.tx'))
}
for(const type of ['cc','nrpn','note','gs','at','off'])m.fragmentForBody(push,m.standardProgramBody(push,{...base,type,parameter:type==='gs'?0:23,mode:'momentary',buttonValues:[127,0]}))
assert.throws(()=>m.standardProgramBody(rotation,{...base,type:'pc'}),/not qualified/)
m.fragmentForBody(push,'.easypar CC 1 23 127 0 toggleoff\n.mode down')
const original='$rev BCR32\n$preset\n.name \'Fixture\'\n$encoder 8\n.easypar CC 1 23 0 127 absolute\n.showvalue on\n.mode bar\n$encoder 9\n.easypar CC 2 17 0 127 absolute\n$end'
let working=original,events=[],backup
const read=async()=>({status:'complete',text:working}),transfer=async lines=>{events.push('transfer');working=working.replace(/\$encoder 8\n[\s\S]*?(?=\$encoder 9)/,lines.slice(1,-1).join('\n')+'\n')}
const context={target:rotation,read,transfer,setOff:async()=>{events.push('off');working=working.replace('.easypar CC 1 23 0 127 absolute\n','')},backup:(...data)=>{backup=data;events.push('backup')},check:()=>{}}
await m.sendStandardProgram({...context,control:{...base,type:'off'}})
assert.deepEqual(events,['backup','off'],'standard OFF changes only Type and does not reset dormant range/mode')
assert.ok(working.includes('.mode bar'));assert.equal(backup[0],original)
working=original;events=[]
await m.sendStandardProgram({...context,control:{...base,parameter:24}})
assert.deepEqual(events,['backup','off','transfer']);assert.match(working,/CC 1 24/);assert.ok(working.includes('$encoder 9\n.easypar CC 2 17'))
working=original;await m.sendStandardProgram({...context,control:{...base,type:'gs',parameter:0}});assert.match(working,/GS\/XG 1 cutoff/)
working=original.replace('.easypar CC 1 23 0 127 absolute','.tx $F0 $7D val $F7');events=[]
await m.sendStandardProgram({...context,control:{...base,type:'off'}});assert.deepEqual(events,['backup','off','transfer']);assert.ok(!working.includes('.tx'))
working=original;let reads=0;events=[]
await assert.rejects(m.sendStandardProgram({...context,control:base,read:async()=>({status:'complete',text:++reads===2?original.replace('Fixture','Changed'):original})}),/changed during preparation/);assert.deepEqual(events,['backup'])
working=original;events=[];await assert.rejects(m.sendStandardProgram({...context,control:{...base,parameter:25},transfer:async()=>{throw Error('NAK')}}),/NAK/);assert.deepEqual(events,['backup','off'])
// Rebound/disconnected queues never replay earlier local edits.
let ready=true,writes=[],states=[]
const queue=m.createLiveControlQueue({ready:()=>ready,write:async(t,c)=>writes.push([t.id,c.parameter]),changed:s=>states.push(s)},5)
queue.enqueue(rotation,{...base,parameter:1});queue.enqueue(rotation,{...base,parameter:2});await new Promise(r=>setTimeout(r,25));assert.deepEqual(writes,[[8,2]])
queue.enqueue(rotation,{...base,parameter:3});queue.cancel();await new Promise(r=>setTimeout(r,15));assert.equal(writes.length,1)
ready=false;queue.enqueue(rotation,base);await new Promise(r=>setTimeout(r,15));assert.equal(writes.length,1);assert.equal(states.at(-1),'failed');queue.close()
console.log('PASS standard BCL live: CC/NRPN/GS/AT/PB/Note/OFF construction, native button down, backup/readback, dormant OFF fields, custom OFF clearing, stale/NAK refusal, latest-only serial queue and no replay; no hardware')
