import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) {
  if (!name.startsWith('./')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name.slice(2)}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}; cache.set(name, exports)
  new Function('require', 'exports', code)(load, exports)
  return exports
}
const { createProfile, parseProfile, is14Bit, modesFor } = load('./profile')
const { createMidiDecoder, applyChange, buttonValue } = load('./controller-midi')
const { encoderMessages, createCcSender } = load('./cc-transport')
const { makePreset, parsePreset, emptyLabels, emptyValues } = load('./presets')
const units = { rel1:[0,127], rel2:[63,65], rel3:[1,65], r1_14:[1,16383], r2_14:[8191,8193], r3_14:[8193,1] }
for (const [mode, [ccw, cw]] of Object.entries(units)) {
  for (const type of ['cc', 'nrpn']) {
    const p = createProfile(), e = p.encoders[0] = { ...p.encoders[0], type, mode, parameter:type === 'cc' ? 16 : 1025, maximum:is14Bit({mode}) ? 16383 : 127 }
    const decode = createMidiDecoder(p)
    const prefix = type === 'nrpn' ? [[176,99,8],[176,98,1]] : []
    const base = type === 'nrpn' ? 6 : 16
    for (const [delta, word] of [[-1,ccw],[1,cw],[-3,ccw],[3,cw]]) {
      const bytes = encoderMessages(e,50+delta,50)
      const unit = [...prefix,...is14Bit(e) ? [[176,base,word>>7],[176,base+32,word&127]] : [[176,base,word]]]
      assert.deepEqual(bytes,Array.from({length:Math.abs(delta)},()=>unit).flat(),`${type} ${mode} ${delta}`)
      let live = {value:50,source:'local'}
      for (const b of bytes) for (const change of decode(b)) live = applyChange(e,live,change)
      assert.equal(live.value,50+delta)
      assert.equal(live.source,'relative')
    }
    if (is14Bit(e)) assert.equal(encoderMessages(e,500,0),null) // bounded burst
    assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(p))),p)
    const pv=emptyValues();pv.encoders[0]=is14Bit(e)?8193:50
    const preset=makePreset({profile:p,values:pv,labels:emptyLabels(),ringMode:'bar'},mode)
    assert.deepEqual(parsePreset(JSON.parse(JSON.stringify(preset))),preset)
  }
}
assert.ok(!modesFor('cc',true).includes('inc_dec'))
assert.ok(modesFor('nrpn',true).includes('inc_dec'))
const p=createProfile(), e=p.encoders[0]={...p.encoders[0],type:'nrpn',parameter:1025,mode:'inc_dec'}
let decode=createMidiDecoder(p)
assert.deepEqual(encoderMessages(e,52,50),[[176,99,8],[176,98,1],[176,96,1],[176,99,8],[176,98,1],[176,96,1]])
assert.deepEqual(encoderMessages(e,49,50),[[176,99,8],[176,98,1],[176,97,1]])
assert.deepEqual(decode([176,96,1]),[]) // no selection
decode([176,99,8]);decode([176,98,1])
assert.equal(decode([176,96,0])[0].delta,1) // value byte is ignored by NRPN increment
assert.equal(decode([176,97,1])[0].delta,-1)
assert.deepEqual(decode([177,96,1]),[])
decode([176,101,0]);assert.deepEqual(decode([176,96,1]),[]) // RPN cancels NRPN
decode([176,99,8]);decode([176,98,1]);decode([176,99,9]);assert.deepEqual(decode([176,96,1]),[])
decode([176,98,1]);assert.deepEqual(decode([176,96,1]),[]) // different parameter
decode=createMidiDecoder(p);decode([176,98,1]);decode([176,99,8]);assert.equal(decode([176,96,1])[0].delta,1) // selector LSB first
assert.equal(encoderMessages({...e,parameter:16383},50,49),null)
for (const mode of ['absolute','abs_14']) {
  p.encoders[0]={...e,mode,maximum:mode==='abs_14'?16383:127}
  decode=createMidiDecoder(p)
  for (const v of mode==='abs_14'?[0,127,8193,16383]:[0,64,127]) {
    const changes=encoderMessages(p.encoders[0],v).flatMap(decode)
    assert.equal(changes.length,1);assert.equal(changes[0].value,v)
  }
}
p.encoders[0]={...e,type:'cc',parameter:16,mode:'r2_14',maximum:16383}
decode=createMidiDecoder(p)
assert.deepEqual(decode([176,48,1]),[]) // orphan LSB
assert.deepEqual(decode([176,16,64]),[]) // no transient value
assert.equal(decode([176,48,1])[0].delta,1)
assert.deepEqual(decode([176,48,1]),[]) // consumed relative pair
decode([176,16,64]);assert.deepEqual(decode([176,48,0]),[]) // neutral relative pair consumed too
assert.deepEqual(decode([176,48,1]),[])
for(const data of [[176,16],[176,16,128],[176,16,NaN],[240,16,1],[176,-1,1]]) assert.deepEqual(decode(data),[])
const b={...e,type:'cc',parameter:20,minimum:0,maximum:127}
assert.equal(buttonValue({...b,mode:'momentary'},null,true),127)
assert.equal(buttonValue({...b,mode:'momentary'},127,false),0)
assert.equal(buttonValue({...b,mode:'toggle'},null,true),127)
assert.equal(buttonValue({...b,mode:'toggle'},127,true),0)
assert.equal(buttonValue({...b,mode:'toggle'},127,false),null)
assert.equal(buttonValue({...b,mode:'inc_dec',increment:5},120,true),125)
assert.equal(buttonValue({...b,mode:'inc_dec',increment:5},125,true),127)
assert.equal(buttonValue({...b,mode:'inc_dec',increment:-5},3,true),0)
assert.throws(()=>parseProfile({...p,buttons:p.buttons.map(x=>({...x,increment:128}))}))
p.pushes[0]={...b,id:1,mode:'momentary'};p.buttons[0]={...b,id:5,parameter:21,mode:'inc_dec'}
decode=createMidiDecoder(p)
assert.deepEqual(decode([176,20,127]),[{control:{kind:'pushes',id:1},value:127}])
assert.deepEqual(decode([176,21,5]),[{control:{kind:'buttons',id:5},value:5}])
const writes=[],errors=[]
const sender=createCcSender(bytes=>writes.push(bytes),()=>{},e=>errors.push(e),5)
sender.enqueueOrdered([[176,20,127]]);sender.enqueueOrdered([[176,20,0]])
sender.enqueueOrdered([[176,16,65]]);sender.enqueueOrdered([[176,16,65]])
await new Promise(r=>setTimeout(r,25))
assert.deepEqual(writes,[[176,20,127],[176,20,0],[176,16,65],[176,16,65]])
sender.enqueueOrdered([[176,16,65]]);sender.close();await new Promise(r=>setTimeout(r,25));assert.equal(writes.length,4)
const overflow=createCcSender(()=>assert.fail('overflow must not send'),()=>{},e=>errors.push(e),5)
overflow.enqueueOrdered(Array.from({length:4097},()=>[176,16,65]));await new Promise(r=>setTimeout(r,25));assert.equal(errors.length,1);overflow.close()
// Deterministic pacing proof: complete NRPN units, four units per timer tick.
const realSetTimeout=globalThis.setTimeout, realClearTimeout=globalThis.clearTimeout
const ticks=[];globalThis.setTimeout=fn=>{ticks.push(fn);return ticks.length};globalThis.clearTimeout=()=>{}
try {
  const pacedWrites=[], paced=createCcSender(b=>pacedWrites.push(b),()=>{},assert.fail)
  const n={...e,mode:'r2_14',maximum:16383}
  paced.enqueueOrdered(encoderMessages(n,59,50)) // nine units of four messages
  ticks.shift()();assert.equal(pacedWrites.length,16)
  ticks.shift()();assert.equal(pacedWrites.length,32)
  ticks.shift()();assert.equal(pacedWrites.length,36)
  const rx=createMidiDecoder({...createProfile(),encoders:[n]})
  assert.equal(pacedWrites.flatMap(rx).reduce((sum,c)=>sum+c.delta,0),9)
  paced.close()
} finally {globalThis.setTimeout=realSetTimeout;globalThis.clearTimeout=realClearTimeout}
console.log('PASS: six relative modes ±1/±3 CC+NRPN, NRPN absolute/14/inc-dec, selector isolation, consumed pairs, bounds, presets, button modes/steps, ordered/cancel/overflow queue')
