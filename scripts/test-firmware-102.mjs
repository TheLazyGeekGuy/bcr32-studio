import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) {
  if (!name.startsWith('.')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const base = fileURLToPath(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url))
  if (name.endsWith('.json')) return JSON.parse(readFileSync(base, 'utf8'))
  const code = ts.transpileModule(readFileSync(existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}; cache.set(name, exports); new Function('require', 'exports', code)(load, exports); return exports
}
const codec = load('./firmware-codec'), bcl = load('./bcl'), zaq = load('./zaquencer'), remote = load('./zaquencer-remote')
const { FirmwareTools } = load('./FirmwareTools')
for (const n of [0,1,2,6,7,8,14,15,128,1024]) {
  const raw = Array.from({length:n}, (_,i)=>(i*157+128)&255)
  assert.deepEqual(codec.unpack7(codec.pack7(raw)),raw)
}
for (const raw of [[1],[4,0],[0,128]]) assert.throws(()=>codec.unpack7(raw))
assert.throws(()=>codec.pack7([NaN]));assert.throws(()=>codec.midiFrame(1,[128]))
assert.deepEqual(codec.targetQuery(50,'parameter'),[240,0,32,50,127,100,51,50,247])
assert.equal(codec.targetReply(codec.targetQuery(50,'type')),null,'query echo is not a value')
assert.equal(codec.targetReply(codec.midiFrame(49,[50,8])).raw,8,'unknown/SysEx type 8 is retained')
assert.equal(codec.targetReply(codec.midiFrame(51,[50,...codec.pack7([245,165])])).sentinel,true)
assert.equal(codec.targetReply(codec.midiFrame(55,[0,...codec.pack7([255,255])])).signed,-1)
assert.equal(codec.targetReply(codec.midiFrame(51,[50,4,0,0])),null)
for (const q of [codec.targetQuery(81,'display'), bcl.bclQuery('preset',63),bcl.bclQuery('global'),bcl.bclQuery('names',0)]) assert.equal(codec.isFirmwareRead(q),true)
for (const q of [bcl.bclLine(0,'$rev BCR32'),codec.midiFrame(4,[0]),codec.midiFrame(49,[50,8]),codec.midiFrame(64,[64]),codec.midiFrame(82,[5])]) assert.equal(codec.isFirmwareRead(q),false,'write or invalid query rejected at sender boundary')
let sent=[];const reader=codec.createTargetReader(bytes=>sent.push(bytes),25)
const promise=reader.read(50,'type')
assert.equal(reader.receive(codec.targetQuery(50,'type')),false)
assert.equal(reader.receive(codec.midiFrame(49,[51,8])),false)
assert.equal(reader.receive(codec.midiFrame(49,[50,8])),true)
assert.equal((await promise).value.raw,8)
assert.equal((await reader.read(50,'type')).status,'timeout')
const cancelled=reader.read(1,'type');reader.close();assert.equal((await cancelled).status,'cancelled')
const closedSent=sent.length;await reader.read(1,'type');assert.equal(sent.length,closedSent)
const throwing=codec.createTargetReader(()=>{throw Error('Disconnected')});await assert.rejects(throwing.read(0,'type'));throwing.close()
const text='$rev BCR32\n$preset\n$encoder 1\n .tx F0 7D val F7\n'
const bclFrames=codec.splitSysex(bcl.bclFile(text));assert.equal(bcl.bclText(bclFrames),text.trimEnd())
assert.throws(()=>bcl.bclFile('x'.repeat(601)));assert.throws(()=>bcl.bclFile('é'))
assert.throws(()=>bcl.bclText([...bclFrames].reverse()))
assert.deepEqual(bcl.bclResponse(codec.midiFrame(33,[0,1,0])),{kind:'status',line:1,status:0})
const name=codec.midiFrame(33,[0,3,...Array.from('Preset'.padEnd(24),c=>c.charCodeAt(0))]);assert.deepEqual(bcl.bclResponse(name),{kind:'name',preset:3,name:'Preset'})
const data=Array.from({length:1024},(_,i)=>(i*13+7)&255)
const blocks=Array.from({length:8},(_,i)=>({device:127,kind:1,bank:0,page:0,block:i,data:data.slice(i*128,(i+1)*128)}))
const assembler=zaq.createZaqAssembler();let pattern=null
for(const b of blocks){const bytes=zaq.zaqBlockFile(b);assert.equal(bytes.length,273);const decoded=zaq.decodeZaqBlock(bytes);assert.deepEqual(decoded,b);pattern=assembler.receive(decoded)}
assert.deepEqual(pattern.data,data)
assert.deepEqual(zaq.patternFile(pattern),blocks.flatMap(zaq.zaqBlockFile),'unchanged dump round trip byte exact')
const broken=zaq.zaqBlockFile(blocks[0]);broken[12]^=1;assert.equal(zaq.decodeZaqBlock(broken),null)
assert.equal(zaq.decodeZaqBlock(codec.midiFrame(4,[11,0])),null)
const state=zaq.createZaqAssembler();state.receive(blocks[0]);state.receive(blocks[2]);for(const b of blocks.slice(1))assert.equal(state.receive(b),null,'no mixing after missing/out-of-order block')
state.receive(blocks[0]);state.reset();for(const b of blocks.slice(1))assert.equal(state.receive(b),null,'disconnect clears partial data')
let edited=data
for(let track=0;track<4;track++)for(let step=0;step<32;step++){
  const gate=zaq.readStep(edited,track,step).gate
  edited=zaq.patchStep(edited,track,step,{velocity:61});assert.equal(zaq.readStep(edited,track,step).gate,gate)
}
for(let track=0;track<4;track++)for(let step=0;step<32;step++)for(let gate=0;gate<16;gate++){
  edited=zaq.patchStep(edited,track,step,{gate});assert.equal(zaq.readStep(edited,track,step).gate,gate)
  for(let s=0;s<32;s++)assert.equal(zaq.readStep(edited,track,s).velocity,61,'gate edits preserve all velocities')
}
for(let base=0;base<1024;base+=256){assert.deepEqual(edited.slice(base,base+48),data.slice(base,base+48));assert.deepEqual(edited.slice(base+124,base+256),data.slice(base+124,base+256))}
edited=zaq.patchStep(data,3,31,{delay:-23,rest:true,mask:true,voices:42330})
assert.deepEqual([zaq.readStep(edited,3,31).delay,zaq.readStep(edited,3,31).rest,zaq.readStep(edited,3,31).mask,zaq.readStep(edited,3,31).voices],[-23,true,true,42330])
assert.throws(()=>zaq.patchStep(data,0,0,{velocity:128}));assert.deepEqual(pattern.data,data,'immutable local edits')
const updated=zaq.patternFile(pattern,edited), rebuilt=zaq.createZaqAssembler();let back
for(const f of codec.splitSysex(updated))back=rebuilt.receive(zaq.decodeZaqBlock(f))
assert.deepEqual(back.data,edited,'edited file imports with valid checksums')
assert.throws(()=>codec.splitSysex([240,0]));assert.throws(()=>codec.splitSysex([240,240,247]));assert.throws(()=>codec.splitSysex([247]))
assert.equal(remote.zaqRemoteDefaults.length,27)
for(const bpm of [30,120,300]){const m=remote.zaqTempoPreview(1,bpm);assert.equal(m[2]+(m[1]-18)*128-76,bpm)}
assert.deepEqual(remote.zaqStepFlagPreview(16,3,31,true,'rest'),[191,15,127]);assert.throws(()=>remote.zaqStepFlagPreview(0,0,0,true,'rest'))
let writes=0
const html=renderToStaticMarkup(React.createElement(FirmwareTools,{firmware:null,connectionKey:'offline',canRead:false,sendRead:()=>writes++,receive:{current:()=>{}},download:()=>{}}))
assert.ok(html.includes('Firmware tools'));assert.ok(html.includes('Zaquencer pattern editor'));assert.ok(html.includes('BCL preset editor'));assert.equal(writes,0,'render/import workflows never send MIDI')
const french=renderToStaticMarkup(React.createElement(load('./i18n').I18nContext.Provider,{value:{language:'fr',choice:'fr',setChoice:()=>{}}},React.createElement(FirmwareTools,{firmware:null,connectionKey:'offline',canRead:false,sendRead:()=>writes++,receive:{current:()=>{}},download:()=>{}})))
assert.ok(french.includes('Éditeur de patterns Zaquencer'));assert.ok(french.includes('Lire le paramètre'))
console.log('PASS: firmware 1.0.2 codecs, strict read boundary/echo rejection/cancellation, BCL file/name/status shapes, sequential pattern assembly, 2048 gate edits with shared-bit preservation, immutable round trips, CC previews and translated offline UI')

const { wireGlobalCommand,createGlobalsReader,globalWritesEnabled }=load('./device-globals')
assert.equal(globalWritesEnabled,false)
for(const cmd of [32,33,64]){assert.equal(wireGlobalCommand(cmd,null),cmd);assert.equal(wireGlobalCommand(cmd,'0.56.0'),cmd)}
assert.deepEqual([32,33,64].map(c=>wireGlobalCommand(c,'1.0.2')),[80,81,82])
let globals;const globalSent=[]
globals=createGlobalsReader(bytes=>{globalSent.push(bytes);queueMicrotask(()=>globals.receive([...bytes.slice(0,-1),5,247]))},100,undefined,'1.0.2')
const settings=await globals.read();globals.close()
for(const c of [32,33,64])assert.ok(!globalSent.some(b=>b[6]===c),'1.x does not send legacy BCL-conflicting commands')
assert.ok(globalSent.some(b=>b[6]===82));assert.equal(settings.find(r=>r.cmd===64).value,5,'profile logical ID kept while wire command changes')
const brightness=load('./led-brightness');const brightnessSent=[];let brightnessState
const bt=brightness.createBrightnessTransport(bytes=>brightnessSent.push(bytes),s=>brightnessState=s,1,100,82)
bt.read();assert.deepEqual(brightnessSent[0],[240,0,32,50,127,100,82,247]);assert.ok(bt.receive([240,0,32,50,127,100,82,5,247]));bt.set(7)
await new Promise(r=>setTimeout(r,5));assert.equal(brightnessSent.length,1,'no 1.x brightness write, even after successful read');assert.equal(brightnessState.value,5);bt.close()
console.log('PASS: version-dependent global reads; firmware 1.x brightness strictly read-only')

assert.deepEqual(codec.trackQuery(3,'alpha'),[240,0,32,50,127,100,44,3,247])
assert.equal(codec.isFirmwareRead(codec.trackQuery(3,'beta')),true)
assert.equal(codec.isFirmwareRead(codec.midiFrame(44,[4])),false)
assert.equal(codec.trackReply(codec.trackQuery(0,'alpha')),null)
assert.deepEqual(codec.trackReply(codec.midiFrame(44,[2,...codec.pack7([252])])),{index:2,field:'alpha',raw:252,signed:-4,sentinel:false})
assert.equal(codec.trackReply(codec.midiFrame(44,[2,4,0])),null)
const tr=codec.createTrackReader(()=>{},100),tp=tr.read(1,'mode');assert.ok(tr.receive(codec.midiFrame(41,[1,1])));assert.equal((await tp).value.raw,1);tr.close()
console.log('PASS: five sequencer track fields, signed packed selectors and read-only request validation')
