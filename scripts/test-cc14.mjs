import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) { if (name.endsWith('.json')) return JSON.parse(readFileSync(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url), 'utf8'));
  if (!name.startsWith('./')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const tsx = ['./FrontPanel', './OledDisplay', './ActivityLeds', './i18n', './Icon'].includes(name)
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name.slice(2)}.${tsx ? 'tsx' : 'ts'}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}; cache.set(name, exports)
  new Function('require','exports',code)(load,exports)
  return exports
}
const { receiveCC, ledIndex } = load('./FrontPanel')
const { createProfile, parseProfile } = load('./profile')
const { encoderMessages, createCcSender } = load('./cc-transport')
const { emptyLabels, emptyValues, makePreset, parsePreset } = load('./presets')
const { controlForCC } = load('./oled-model')
const p = createProfile()
p.encoders[0] = { ...p.encoders[0], type:'cc', mode:'abs_14', parameter:16, maximum:16383 }
const e = p.encoders[0]
let values = receiveCC(p, {}, [176,16,0])
assert.equal(values[1].value, null)
values = receiveCC(p, values, [176,48,120])
assert.equal(values[1].value, 120) // Value from a hardware capture.
values = receiveCC(p, values, [176,16,64])
assert.equal(values[1].value, 120) // Hold complete value until LSB arrives.
values = receiveCC(p, values, [176,48,1])
assert.equal(values[1].value, 8193)
assert.equal(receiveCC(p, {}, [176,48,127])[1], undefined)
assert.deepEqual(receiveCC(p, {}, [177,16,1]), {})
for (const v of [0,127,128,8192,16383]) {
  const pair = encoderMessages(e,v)
  assert.deepEqual(pair, [[176,16,v>>7],[176,48,v&127]])
  const received = pair.reduce((current, b) => receiveCC(p,current,b), {})
  assert.equal(received[1].value,v)
}
assert.equal(encoderMessages({...e,parameter:32},500),null)
assert.deepEqual(encoderMessages(e,20000),[[176,16,127],[176,48,127]])
assert.equal(ledIndex(16383,0,16383),20)
assert.equal(ledIndex(8192,0,16383),10)
assert.deepEqual(controlForCC(p,{kind:'encoders',id:2},[176,48,3]),{kind:'encoders',id:1})
assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(p))),p)
const pv = emptyValues(); pv.encoders[0]=16383
const preset = makePreset({profile:p,values:pv,labels:emptyLabels(),ringMode:'bar'},'14 bits')
assert.deepEqual(parsePreset(JSON.parse(JSON.stringify(preset))),preset)
assert.throws(()=>parsePreset({...preset,values:{...pv,encoders:Array(32).fill(16383)}}))
assert.throws(()=>parseProfile({...p,encoders:p.encoders.map(e=>({...e,maximum:16384}))}))
const writes=[]
const sender=createCcSender(b=>writes.push(b),()=>{},assert.fail,5)
for(let v=0;v<1000;v++)sender.enqueueMessages(encoderMessages(e,v))
await new Promise(r=>setTimeout(r,25))
assert.deepEqual(writes,[[176,16,7],[176,48,103]])
sender.enqueueMessages(encoderMessages(e,500));sender.close()
await new Promise(r=>setTimeout(r,25))
assert.equal(writes.length,2)
console.log('PASS: captured CC16/48, pending MSB, 0..16383, channels, valid base, pair batching/cancel, OLED, LED scale and preset roundtrip')
