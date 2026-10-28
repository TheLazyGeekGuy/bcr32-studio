import assert from 'node:assert/strict'
import {build} from 'esbuild'
const result=await build({stdin:{contents:"export {createMidiBroker} from './src/editor-host/midi-broker';export {createMidiViewAccess} from './src/editor-host/midi-view-access'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports)
const {createMidiBroker,createMidiViewAccess}=mod.exports
const make=(id,name)=>({id,name,state:'connected',onmidimessage:null,send(){throw Error('unexpected hardware output')}})
const input=make('a-in','Device A'),output=make('a-out','Device A'),otherIn=make('b-in','Unrelated B'),otherOut=make('b-out','Unrelated B')
const shared={sysexEnabled:false,inputs:new Map([[input.id,input],[otherIn.id,otherIn]]),outputs:new Map([[output.id,output],[otherOut.id,otherOut]]),onstatechange:null}
let now=999;const broker=createMidiBroker(shared,()=>now),a=broker.createLease('editor-a'),b=broker.createLease('editor-b')
const view=createMidiViewAccess('editor-a',{id:'a',portName:/Device A/},shared,broker,a)
view.bind(input.id,output.id);b.bind({inputId:otherIn.id,outputId:otherOut.id})
const packets=[],events=[],others=[];a.subscribe(p=>packets.push(p));b.subscribe(p=>others.push(p))
view.access.inputs.get(input.id).onmidimessage=e=>events.push(e)
const emit=stamp=>input.onmidimessage(Object.assign(Object.create({timeStamp:stamp}),{data:new Uint8Array([248])}))
emit(12.345);assert.equal(packets.at(-1).timestamp,12.345);assert.equal(events.at(-1).timeStamp,12.345,'inherited source timestamp survives broker and synthetic view')
emit(0);assert.equal(events.at(-1).timeStamp,0,'zero is valid')
for(const stamp of [undefined,NaN,Infinity,-1]){now++;emit(stamp);assert.equal(events.at(-1).timeStamp,now,'older/invalid event metadata falls back to injected arrival time')}
assert.equal(others.length,0,'no cross-instance RX leakage')
otherIn.onmidimessage({data:new Uint8Array([176,1,64]),timeStamp:88});assert.equal(others.at(-1).timestamp,88,'unrelated voice module retains timestamps too')
view.close();a.release();assert.equal(input.onmidimessage,null,'closing releases the physical listener');assert.equal(b.getState().connected,true)
assert.throws(()=>view.bind(input.id,output.id),/closed/)
b.release();assert.equal(otherIn.onmidimessage,null)
console.log('PASS MIDI source timestamps: inherited/zero/fallback, broker→legacy view, unlike payloads, isolated instances, close and release; no sender')
