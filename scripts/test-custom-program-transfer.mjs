import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
const result=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/custom-program-transfer';export * from './src/bcl-tx';export * from './src/editors/bcontrol/bcr32/host-policy';export * from './src/editors/bcontrol/bcr32/bcl';export * from './src/editors/bcontrol/bcr32/preset-store';`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const bundled={exports:{}};new Function('module','exports',result.outputFiles[0].text)(bundled,bundled.exports);const m=bundled.exports
const target={kind:'encoders',id:1},original=".easypar CC 1 16 0 127 absolute\n.showvalue on\n.mode 12dot\n.default 0"
const working=body=>`$rev BCR32\n$preset\n.name 'Fixture'\n.snapshot off\n$encoder 1\n${body}\n$encoder 2\n.easypar CC 1 17 0 127 absolute\n$end`
const program=m.parseCustomAssignment('.minmax 0 127\n.default 0\n.tx $F0 $7D val $F7\n.showvalue on')
assert.equal(m.controlFromWorking(working(original),target),original)
assert.equal(m.programFragment(m.fragmentForBody(target,program.sourceBcl)).hasTx,true)
for(const bad of ['$store 1','.init','.snapshot on','.vendor-test 1','.tx $F0 $7D cks-1 2 $F7','.easypar CC 1 16 0 127 absolute\n.tx $F0 $7D val $F7'])assert.throws(()=>m.fragmentForBody(target,bad))
assert.throws(()=>m.controlFromWorking(working(original).replace('$encoder 2','$encoder 1'),target),/ambiguous/)
assert.throws(()=>m.controlFromWorking(working(original).replace('$end','$store 2\n$end'),target),/Complete/)
const frames=m.fragmentForBody(target,program.sourceBcl).map((l,i)=>{const b=m.bclLine(i,l);b[4]=0;return b})
assert.equal(m.plannedOperation(frames),'edit-buffer')
assert.equal(m.supportsCustomProgram('1.0.3'),true);assert.equal(m.supportsCustomProgram('1.0.4'),false)
function fixture(options={}){
 let state=working(original),reads=0,off=0,writes=0,backup=null,valid=true
 const api={target,program,check(){if(!valid)throw Error('stale connection')},read:async()=>({status:'complete',text:options.changed&&++reads===2?state.replace('Fixture','Changed'):state}),
 backup:(before,body,proposed)=>{if(options.storageFail)throw Error('backup failed');backup={before,body,proposed};if(options.disconnect)valid=false},
 setOff:async()=>{assert.ok(backup);off++;if(options.offFail)throw Error('OFF not confirmed')},
 transfer:async lines=>{assert.ok(backup);writes++;if(options.nak)throw Error('NAK');state=working(lines.slice(2,-1).join('\n'));if(options.otherChanged)state=state.replace('CC 1 17','CC 1 18');if(options.mismatch)state=state.replace('$7D','$7E')},
 }
 return {api,counts:()=>({off,writes,backup}),state:()=>state}
}
let f=fixture();await m.sendControlProgram(f.api);assert.equal(f.counts().off,1);assert.equal(f.counts().writes,1)
await m.restoreControlProgram({...f.api,body:original});assert.equal(f.state(),working(original))
for(const option of ['storageFail','disconnect','changed']){f=fixture({[option]:true});await assert.rejects(m.sendControlProgram(f.api));assert.equal(f.counts().off,0);assert.equal(f.counts().writes,0)}
for(const option of ['offFail','nak','otherChanged','mismatch']){f=fixture({[option]:true});await assert.rejects(m.sendControlProgram(f.api));assert.ok(f.counts().backup);assert.ok(f.counts().writes<=1,'no automatic retry or restore')}
f=fixture();await assert.rejects(m.sendControlProgram({...f.api,read:async()=>({status:'timeout'})}));assert.equal(f.counts().off,0)
f=fixture();await m.sendControlProgram(f.api);await assert.rejects(m.restoreControlProgram({...f.api,body:original,transfer:async()=>{}}),/not confirmed/)
const physical=JSON.parse(readFileSync(new URL('./fixtures/bcl-control-103.json',import.meta.url)))
assert.equal(physical.fullPresetRestored,true);assert.equal(physical.beforePresetSha256,physical.restoredPresetSha256);assert.ok(physical.ackStatuses.every(a=>a.status===0))
assert.equal(m.parseCustomAssignment(physical.observedBody).conversionStatus,'exact','native .mode does not make a custom program opaque')
m.fragmentForBody(physical.target,physical.observedBody)
// Native canonical ordering, whitespace and extra ring setting must pass an independent read-back.
let native=working(physical.beforeBody)
await m.sendControlProgram({target,program:m.parseCustomAssignment(physical.proposedBody),read:async()=>({status:'complete',text:native}),setOff:async()=>{},backup(){},check(){},transfer:async()=>{native=working(physical.observedBody)}})
assert.equal(m.parseCustomAssignment('.tx $F0 $7D val $F7\n.mode unknown').conversionStatus,'partial')
const old=m.parseCustomAssignment('.tx $F0 $7D val $F7\n.mode 1dot')
assert.equal(m.validCustomAssignment({...old,kind:'opaque-bcl',conversionStatus:'partial',diagnostics:['Statement preserved without simplified editing: .mode']}),true,'alpha1 opaque ring descriptors remain readable without source loss')
assert.equal(m.validCustomAssignment({...old,hardwareValidated:true}),false)
let named=working(original).replace("'Fixture'","'Same;One'")
await assert.rejects(m.sendControlProgram({target,program,read:async()=>({status:'complete',text:named}),setOff:async()=>{},backup(){},check(){},transfer:async()=>{named=working(program.sourceBcl).replace("'Fixture'","'Same;Two'")}}),/differs/,'an unrelated quoted preset-name change cannot be hidden by comment stripping')
const stored=JSON.parse(readFileSync(new URL('./fixtures/bcl-store-recall-103.json',import.meta.url)))
assert.ok(stored.storePassed&&stored.recallEqual&&stored.alternatePresetEqual&&stored.workingRestored&&stored.globalsRestored)
assert.equal(stored.bankDigests.length,64);assert.ok(stored.bankDigests.every(b=>b.before===b.after));assert.deepEqual(stored.bankDiffs,[])
assert.deepEqual(stored.storeLines,['$store 63','$store 63']);assert.equal(stored.nonzeroAcks,0)
for(const t of stored.targets){assert.equal(t.storedBody,t.recalledBody);assert.equal(t.beforeBody,t.restoredBody);assert.equal(m.parseCustomAssignment(t.recalledBody).conversionStatus,'exact');m.fragmentForBody(t,t.recalledBody)}
let pushReads=0
await assert.rejects(m.sendControlProgram({target:{kind:'pushes',id:1},program,read:async()=>{pushReads++;throw Error('must not read')},transfer:async()=>{throw Error('must not send')},setOff:async()=>{throw Error('must not mutate')},backup(){},check(){}}),/encoder-only/)
assert.equal(pushReads,0,'unsupported push default fails before any hardware operation')
const preset=['$rev BCR32','$preset',"  .name 'BCL fixture'",...stored.targets.flatMap(t=>[t.selector,...t.storedBody.split('\n')]),'$end'].join('\n')
const job=m.presetStorePlan(preset,62,'BCL fixture').lines.map((l,i)=>{const b=m.bclLine(i,l);b[4]=0;return b})
assert.equal(m.plannedOperation(job),'preset-store');assert.ok(job.every(m.validatePresetStore),'native minmax/tx/down lines pass the exact prepared STORE path')
assert.ok(m.supportsPresetStorage('1.0.2')&&m.supportsPresetStorage('1.0.3'));assert.equal(m.supportsPresetStorage('1.0.4'),false)
console.log('PASS custom program transaction: selected fragment, durable backup before OFF, stale/change/backup refusal, ACK/verification failure retention, independent readback, original restoration, no STORE or guessed tokens')

assert.doesNotThrow(()=>m.assertWorkingPrograms(working(program.sourceBcl.replace('.default 0','.default 63')+'\n.mode 1dot'),[{target,program}]),'native order/ring/runtime value do not change message semantics')
for(const body of [original,program.sourceBcl.replace('$7D','$42'),program.sourceBcl.replace('0 127','0 63')])assert.throws(()=>m.assertWorkingPrograms(working(body),[{target,program}]),/STORE stopped/)
let rejectedStoreWrites=0,rejectedStoreBackups=0
await assert.rejects(()=>m.storeHardwarePreset({source:'working',slot:12,name:'Fixture',read:async request=>({status:'complete',request,names:{},frames:[],text:working(original)}),transfer:async()=>{rejectedStoreWrites++},backup:()=>{rejectedStoreBackups++},validateSource:text=>m.assertWorkingPrograms(text,[{target,program}])}),/STORE stopped/)
assert.equal(rejectedStoreWrites,0);assert.equal(rejectedStoreBackups,0)
console.log('PASS STORE consistency: missing/different custom programs refused before backup/write; canonical ring/default changes accepted')
