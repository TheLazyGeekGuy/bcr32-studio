// Offline regression: explicit OFF is a type setter, not a zero performance value or STORE.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
const r=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/controller-write';export * from './src/editors/bcontrol/bcr32/firmware-codec';export * from './src/editors/bcontrol/bcr32/profile';export * from './src/editors/bcontrol/bcr32/host-policy'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',r.outputFiles[0].text)(mod,mod.exports);const m=mod.exports
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const snapshot=(index,type=2)=>({index,fields:{type:m.targetReply(m.midiFrame(49,[index,type],0)),channel:m.targetReply(m.midiFrame(50,[index,0],0)),parameter:m.targetReply(m.midiFrame(51,[index,0,0,7],0))}})
const before={...m.createProfile().encoders[0],type:'cc'},off={...before,type:'off'}
for(let i=0;i<82;i++){
 const jobs=m.changedControllerFields(before,off,snapshot(i));assert.deepEqual(jobs,[{field:'type',value:0}])
 const b=m.midiFrame(49,[i,0],0);assert.ok(m.isEncoderAssignmentWrite(b,0));assert.ok(m.validateEditBuffer(b))
 for(const device of [1,127])assert.equal(m.isEncoderAssignmentWrite(b,device),false)
 if(i<50)assert.equal(m.validateEditBuffer(m.midiFrame(49,[i,2],0)),false,'button activation is not admitted by OFF support')
}
for(const i of [-1,82])assert.equal(m.isEncoderAssignmentWrite([240,0,32,50,0,100,49,i,0,247],0),false)
assert.deepEqual(m.changedEncoderFields(off,off),[])
assert.deepEqual(m.changedEncoderFields(off,before).at(-1),{field:'type',value:2},'enable only after dormant encoder fields')
let writer;const sent=[],confirmed=[],states=[];let wire=2,echoOnly=false
writer=m.createAssignmentWriter(bytes=>{sent.push([...bytes]);if(bytes.length===10){wire=bytes[8];writer.receive(bytes)}else if(!echoOnly)queueMicrotask(()=>writer.receive(m.midiFrame(bytes[6],[bytes[7],wire],0)))},0,s=>states.push(s),v=>confirmed.push(v),500,5,30)
assert.equal(sent.length,0)
writer.enqueue(snapshot(50),'parameter',9)
writer.enqueue(snapshot(50),'type',0) // OFF drops stale queued assignments for this target and bypasses 500ms debounce.
await pause(60)
assert.deepEqual(sent,[m.midiFrame(49,[50,0],0),m.targetQuery(50,'type')]);assert.equal(confirmed.at(-1).raw,0);assert.equal(states.at(-1).status,'confirmed')
const count=sent.length
assert.throws(()=>writer.enqueueBatch([{snapshot:snapshot(0),field:'type',value:0},{snapshot:snapshot(16),field:'channel',value:3}]))
await pause(10);assert.equal(sent.length,count,'invalid batch is atomic')
writer.enqueue(snapshot(15),'type',0);await pause(60);assert.equal(confirmed.at(-1).index,15)
echoOnly=true;writer.enqueue(snapshot(16),'type',0);await pause(60);assert.equal(states.at(-1).status,'failed','setter echo alone is not a confirmation')
writer.close();assert.throws(()=>writer.enqueue(snapshot(50),'type',0))
assert.ok(sent.every(b=>b[6]===49),'no channel/range/LED, STORE, global or sequencer packets')
const prioritySent=[];const priority=m.createAssignmentWriter(b=>prioritySent.push([...b]),0,()=>{},()=>{},500,500,30)
priority.enqueue(snapshot(51),'parameter',9);priority.enqueue(snapshot(50),'type',0);await pause(20)
assert.deepEqual(prioritySent,[m.midiFrame(49,[50,0],0)],'OFF precedes unrelated queued edits');priority.close()
console.log('PASS BCR32 OFF: all 82 target mappings, addressed type-only writes, queued-edit cancellation, prompt send, independent GET, echo-only failure, atomic refusal, close and no STORE')
