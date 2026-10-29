import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const require=createRequire(import.meta.url)
const result=await build({stdin:{contents:`export {bcr32Module} from './src/editors/bcontrol/bcr32/module';export {createWorkbenchBridge} from './src/editors/bcontrol/bcr32/registration';export * from './src/editors/bcontrol/bcr32/firmware-codec';export * from './src/editors/bcontrol/bcr32/controller-read';export * from './src/editors/bcontrol/bcr32/profile';export * from './src/editors/bcontrol/bcr32/presets';export * from './src/editors/bcontrol/bcr32/bcl';export * from './src/editors/bcontrol/bcr32/host-policy';export {createMidiBroker} from './src/editor-host/midi-broker'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'}})
const bundled={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,bundled,bundled.exports);const m=bundled.exports
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/controller-pushes-102.json',import.meta.url),'utf8'))
for(const preset of fixtures.presets){
 let reader;reader=m.createControllerReader(q=>queueMicrotask(()=>reader.receive(preset.replies.find(b=>b[6]===q[6]&&b[7]===q[7]))),()=>{},50,0,0)
 const read=await reader.read(['pushes']);assert.equal(read.status,'complete');assert.equal(read.received,256)
 const initial=m.createProfile(),merged=m.mergeControllerRead(initial,initial,read.targets)
 for(let i=0;i<32;i++){
  const expected=preset.expected[i]
  if(expected.unsupported){assert.equal(m.assignmentFromRead(initial.pushes[i],read.targets[i]),null);continue}
  for(const [key,value] of Object.entries(expected))assert.deepEqual(merged.profile.pushes[i][key],value,`T${preset.track} push${i+1} ${key}`)
 }
 const state={profile:merged.profile,labels:m.emptyLabels(),values:m.emptyValues(),ringMode:'bar'}
 assert.deepEqual(m.bcr32Module.validateState(JSON.parse(JSON.stringify(state))),state)
 reader.close()
}
assert.throws(()=>m.bcr32Module.validateState({profile:{...m.createProfile(),device:{model:'BCR2000',firmwareObserved:null}},labels:m.emptyLabels(),values:m.emptyValues(),ringMode:'bar'}))
const sent=[],input={id:'in',name:'BCR-32 CTRL',state:'connected',onmidimessage:null},output={id:'out',name:'BCR-32 CTRL',state:'connected',send:b=>sent.push([...b])}
const zaqIn={id:'zaq-in',name:'BCR-32 ZAQ',state:'connected',onmidimessage:null},zaqOut={id:'zaq-out',name:'BCR-32 ZAQ',state:'connected',send(){throw Error('ZAQ used')}}
const access={sysexEnabled:true,inputs:new Map([[input.id,input],[zaqIn.id,zaqIn]]),outputs:new Map([[output.id,output],[zaqOut.id,zaqOut]]),onstatechange:null}
const broker=m.createMidiBroker(access),module=m.bcr32Module
const lease=broker.createLease('bcr-a',module.validateQuery,undefined,undefined,undefined,module.validateEditBufferWrite,module.validatePresetStoreWrite)
const bridge=m.createWorkbenchBridge({id:'bcr-a',access,broker,lease,request:async()=>({access,sysexError:null})})
await bridge.request()
assert.equal(bridge.access.inputs.size,1);assert.equal(bridge.access.outputs.size,1)
const port=()=>bridge.access.outputs.get('out')
const presetQuery=m.midiFrame(64,[127])
assert.throws(()=>port().send(presetQuery),/firmware/,'no ambiguous preset/legacy brightness packet before live identity')
const identity=()=>input.onmidimessage({data:new Uint8Array([240,0,32,50,0,100,0,1,0,0,1,0,2,247])})
identity();port().send(presetQuery);assert.deepEqual(sent.at(-1),presetQuery,'command40 selector is a query, never a brightness write')
assert.throws(()=>port().send(m.midiFrame(48,[5],0)),/refused/,'global writes stay refused')
for(const index of [0,15,16,48,50,81]){const off=m.midiFrame(49,[index,0],0);port().send(off);assert.deepEqual(sent.at(-1),off,'OFF traverses the actual host edit-buffer grant')}
assert.throws(()=>port().send(m.midiFrame(50,[15,1],0)),/refused/,'OFF support does not admit button channel writes')
bridge.setLocked(true);assert.throws(()=>port().send(m.midiFrame(49,[50,0],0)),/refused/);bridge.setLocked(false)

for(const cmd of [114,119])assert.throws(()=>port().send(m.midiFrame(cmd)),/refused/)
const frame=(i,text)=>{const b=m.bclLine(i,text);b[4]=0;return b}
const lines=['$rev BCR32','$preset',"  .name 'Fixture'",'  .init','$store 7','$end'],frames=lines.map((s,i)=>frame(i,s))
assert.throws(()=>port().send(frames[0]),/prepared/)
const release=bridge.authorizeTransfer(frames);frames.forEach(b=>port().send(b));release();assert.throws(()=>port().send(frames[0]),/prepared/)
assert.equal(m.plannedOperation(frames),'preset-store')
assert.throws(()=>bridge.authorizeTransfer(frames.map(b=>{const n=[...b];n[4]=1;return n})),/device ID/)
assert.throws(()=>m.plannedOperation([frame(0,'$rev BCR32'),frame(1,'$global'),frame(2,'  .opmode stdl'),frame(3,'$end')]),/shortcut/)
assert.throws(()=>m.plannedOperation([frame(0,'$rev BCR32'),frame(1,'$reset'),frame(2,'$end')]))
const shortcut=['$rev BCR32','$global','  .tracks 63 2 3 4 2','$end'].map((s,i)=>frame(i,s))
assert.equal(m.plannedOperation(shortcut),'edit-buffer')
const cancel=bridge.authorizeTransfer(shortcut);bridge.setLocked(true);assert.throws(()=>port().send(shortcut[0]),/prepared/);cancel();assert.throws(()=>bridge.authorizeTransfer(shortcut),/unavailable/);bridge.setLocked(false)
const original=port();lease.release();bridge.refresh();lease.bind({inputId:'in',outputId:'out'});bridge.refresh();assert.throws(()=>original.send(presetQuery),/binding changed/);assert.throws(()=>port().send(presetQuery),/firmware/)
identity();const again=bridge.authorizeTransfer(shortcut);assert.throws(()=>port().send(shortcut[1]),/prepared/);again()
// The new host protocol travels through the same real broker; no blanket future-firmware grant.
const hostRead=m.midiFrame(0x45,[1,0,0]),hostWrite=m.midiFrame(0x44,[2,0,0,0,0,0,61])
assert.throws(()=>port().send(hostRead),/1.0.3/)
input.onmidimessage({data:new Uint8Array([240,0,32,50,0,100,0,1,0,0,1,0,3,247])})
port().send(hostRead);assert.deepEqual(sent.at(-1),hostRead)
port().send(hostWrite);assert.deepEqual(sent.at(-1),hostWrite)
port().send(m.midiFrame(11));assert.deepEqual(sent.at(-1),m.midiFrame(11),'sequencer hardware page command')
const store103=bridge.authorizeTransfer(frames);frames.forEach(b=>port().send(b));store103() // Qualified by the physical1.0.3 STORE/change/recall fixture; not inferred from step support.
const custom=['$rev BCR32','$encoder 1','.minmax 0 127','.tx $F0 $7D val $F7','$end'].map((l,i)=>frame(i,l))
bridge.setProgramTypeOff(50);assert.deepEqual(sent.at(-1),m.midiFrame(49,[50,0],0))
assert.throws(()=>bridge.setProgramTypeOff(82))
assert.throws(()=>port().send(m.midiFrame(49,[50,0],0)),/refused/,'new OFF helper does not enable arbitrary indexed setters on1.0.3')
const customRelease=bridge.authorizeTransfer(custom)
assert.throws(()=>bridge.setProgramTypeOff(51),/unavailable/,'no Type transition inside an active BCL stream')
custom.forEach(b=>port().send(b));assert.throws(()=>port().send(custom[0]),/prepared/);customRelease()
assert.throws(()=>bridge.authorizeTransfer(['$rev BCR32','$encoder 1','.vendor-unknown 1','$end'].map((l,i)=>frame(i,l))),/Unsupported/)
bridge.setLocked(true);assert.throws(()=>bridge.setProgramTypeOff(50),/unavailable/);bridge.setLocked(false)
bridge.setLocked(true);assert.throws(()=>port().send(hostWrite),/refused/);assert.throws(()=>port().send(m.midiFrame(12)),/locked/);bridge.setLocked(false)
input.onmidimessage({data:new Uint8Array([240,0,32,50,0,100,0,1,0,0,1,0,4,247])})
assert.throws(()=>bridge.setProgramTypeOff(50),/unavailable/);assert.throws(()=>bridge.authorizeTransfer(custom),/unavailable/)
assert.throws(()=>port().send(hostRead),/1.0.3/);assert.throws(()=>port().send(hostWrite),/refused/)
const leaseB=broker.createLease('bcr-b',module.validateQuery),bridgeB=m.createWorkbenchBridge({id:'bcr-b',access,broker,lease:leaseB,request:async()=>({access,sysexError:null})})
assert.throws(()=>bridgeB.bind('in','out'),/reserved/);assert.equal(bridgeB.access.outputs.size,0)
bridgeB.dispose();leaseB.dispose();const last=port();bridge.dispose();assert.throws(()=>last.send(presetQuery));lease.dispose();broker.close()
console.log('PASS BCR32 Studio: 128 captured push assignments, v2 state roundtrip/model identity; CTRL-only host lease, live firmware gate, separate query/edit/store grants, complete prepared BCL jobs, lock, sequence/device/generation refusal, duplicate exclusion and disposal; simulated ports only')
