import assert from 'node:assert/strict'
import {build} from 'esbuild'
const result=await build({stdin:{contents:"export * from './src/custom-value-output';export * from './src/editors/bcontrol/bcr32/custom-value-policy';export {createMidiBroker} from './src/editor-host/midi-broker'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports)
const {customValueMessages,bcr32CustomValueMessages,createCustomValueQueue,createMidiBroker}=mod.exports
const source='.minmax 0 127\n.tx $F0 $7D val $F7',bytes=[240,125,87,247]
assert.deepEqual(customValueMessages(source,87),[bytes])
assert.deepEqual(customValueMessages('.minmax 0 16383\n.tx $F0 $7D val7.13 val0.6 $F7',8193),[[240,125,64,1,247]])
assert.throws(()=>customValueMessages(source,128),/minmax/)
assert.throws(()=>customValueMessages('.tx $F0 $7D cks-2 1 $F7',1),/Opaque/)
for(const frame of ['$F0 $00 $20 $32 $7F $64 $72 $F7','$F0 $7E $7F $09 $01 $F7','$F0 $7F $7F $06 $01 $F7'])assert.throws(()=>bcr32CustomValueMessages('.tx '+frame,1),/system commands/)
const sent=[],input={id:'in',state:'connected',onmidimessage:null},output={id:'out',state:'connected',send:b=>sent.push([...b])}
const access={sysexEnabled:true,inputs:new Map([['in',input]]),outputs:new Map([['out',output]]),onstatechange:null}
const broker=createMidiBroker(access),lease=broker.createLease('a'),other=broker.createLease('b')
lease.bind({inputId:'in',outputId:'out'})
assert.deepEqual(sent,[])
assert.throws(()=>lease.send([bytes],broker.authorize('a','value')),/policy/,'ordinary value grants remain voice-only')
const grant=broker.authorizeSysexValue('a',[bytes])
assert.throws(()=>lease.send([[240,125,88,247]],grant),/bytes differ/)
assert.throws(()=>other.send([bytes],grant),/foreign/)
lease.send([bytes],grant);assert.deepEqual(sent,[bytes])
assert.throws(()=>lease.send([bytes],grant),/used/)
const two=broker.authorizeSysexValue('a',[bytes,[240,125,88,247]])
assert.throws(()=>lease.send([bytes,[240,125,89,247]],two),/bytes differ/)
assert.equal(sent.length,1,'invalid second packet cannot partially send the first')
const copied=[...bytes],immutable=broker.authorizeSysexValue('a',[copied]);copied[2]=99
assert.throws(()=>lease.send([copied],immutable),/bytes differ/)
const stale=broker.authorizeSysexValue('a',[bytes]);lease.release();lease.bind({inputId:'in',outputId:'out'})
assert.throws(()=>lease.send([bytes],stale),/Stale/)
const permission=broker.authorizeSysexValue('a',[bytes]);access.sysexEnabled=false
assert.throws(()=>lease.send([bytes],permission),/policy/)
assert.throws(()=>broker.authorizeSysexValue('a',[bytes]),/unavailable/)
access.sysexEnabled=true
assert.throws(()=>broker.authorizeSysexValue('a',Array(5).fill(bytes)),/batch/)
assert.throws(()=>broker.authorizeSysexValue('a',[[240,125,128,247]]),/batch/)
lease.send([[176,7,64]],broker.authorize('a','value'));assert.deepEqual(sent.at(-1),[176,7,64])
broker.close()

const emitted=[],errors=[],wait=()=>new Promise(resolve=>setTimeout(resolve,25))
const queue=createCustomValueQueue(g=>emitted.push({...g}),e=>errors.push(e),3)
for(let value=0;value<100;value++)queue.enqueue({key:'encoders:8',source,value})
assert.equal(emitted.length,0,'enqueue is not an immediate write')
await wait();assert.deepEqual(emitted.map(g=>g.value),[99],'latest rotation wins')
queue.enqueue({key:'pushes:8',source,value:127},true);queue.enqueue({key:'pushes:8',source,value:0},true)
await wait();assert.deepEqual(emitted.slice(-2).map(g=>g.value),[127,0],'press and release survive batching')
queue.enqueue({key:'encoders:8',source,value:40});queue.cancel();await wait();assert.equal(emitted.length,3)
queue.enqueue({key:'encoders:8',source,value:41});await wait();assert.equal(emitted.at(-1).value,41,'cancel does not disarm the next gesture')
queue.enqueue({key:'encoders:8',source,value:42});queue.close();await wait();assert.equal(emitted.length,4)
assert.deepEqual(errors,[])
const failure=createCustomValueQueue(()=>{throw Error('Disconnected')},e=>errors.push(e),3)
failure.enqueue({key:'encoders:8',source,value:50});await wait()
failure.enqueue({key:'encoders:8',source,value:51});await wait();assert.equal(errors.length,1,'failed queue cannot replay')
console.log('PASS custom values: 7/14-bit rendering, scoped one-use broker grant, atomic refusal, permissions/generation/isolation, latest rotation, ordered press/release, cancellation and failure; fake ports only')
