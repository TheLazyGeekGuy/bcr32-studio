import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) {
  if (!name.startsWith('./')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name.slice(2)}.ts`, import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const exports={};cache.set(name,exports);new Function('require','exports',code)(load,exports);return exports
}
const { automaticMidiAccess, automaticPorts, associateDefaultEncoder }=load('./auto-midi')
const {createProfile}=load('./profile')
const port=(id,name='BCR32',state='connected')=>({id,name,state,onmidimessage:null,send(){}})
const access={inputs:new Map([['i',port('i')]]),outputs:new Map([['o',port('o')]]),sysexEnabled:true,onstatechange:null}
const requests=[]
assert.equal((await automaticMidiAccess(async sysex=>{requests.push(sysex);return access})).access,access)
assert.deepEqual(requests,[true]);requests.length=0
const fallback=await automaticMidiAccess(async sysex=>{requests.push(sysex);if(sysex)throw Error('denied');return {...access,sysexEnabled:false}})
assert.deepEqual(requests,[true,false]);assert.equal(fallback.sysexError,'denied');assert.equal(fallback.access.sysexEnabled,false)
await assert.rejects(()=>automaticMidiAccess(async()=>{throw Error('all denied')}),/all denied/)
assert.equal(automaticPorts(access).input.id,'i');assert.equal(automaticPorts(access).output.id,'o')
const many={...access,inputs:new Map([['i',port('i')],['i2',port('i2')]]),outputs:new Map([['o',port('o')],['o2',port('o2')]])}
assert.equal(automaticPorts(many).ambiguous,true);assert.equal(automaticPorts(many).output,undefined)
assert.equal(automaticPorts(many,'i2','o2').output.id,'o2')
assert.equal(automaticPorts({...access,outputs:new Map([['x',port('x','Other synth')]])}).output,undefined)
assert.equal(automaticPorts({...access,outputs:new Map([['o',port('o','BCR32','disconnected')]])}).output,undefined)
const p=createProfile(),associated=associateDefaultEncoder(p,false)
assert.equal(p.encoders[0].type,'off');assert.equal(associated.encoders[0].parameter,16);assert.equal(associated.encoders[0].channel,1)
assert.equal(associateDefaultEncoder(p,true),p)
assert.equal(associateDefaultEncoder(associated,false),associated)
const configured={...p,encoders:p.encoders.map(e=>({...e,type:'cc',mode:'abs_14',parameter:16,maximum:16383}))}
assert.equal(associateDefaultEncoder(configured,false),configured)
assert.equal(associateDefaultEncoder({...p,encoders:p.encoders.map(e=>({...e,mode:'abs_14',maximum:16383}))},false).encoders[0].type,'off')
// Effect wiring (refs, dependency on a new port) is not observable without a DOM renderer: source-level guards.
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
assert.match(app,/automaticStarted\.current = true/);assert.match(app,/probedPair\.current\?\.access === access/)
assert.match(app,/automaticEmissionPort\.current === output\) return/)
assert.match(app,/automaticEmissionPort\.current = output\s*\n\s*setSendCC\(true\)/)
const activation = app.slice(app.indexOf('// Arm only a newly connected'), app.indexOf('if (!sendCC || !isBcrOutput(output)) return'))
assert.ok(!/\.(?:send|enqueue\w*)\s*\(/.test(activation), 'Activation must not transmit stored values')
console.log('PASS: SysEx first, CC fallback/refusal, unique BCR-only ports, ambiguity/manual choice, reconnect detection, safe default association and preset/mode preservation')
