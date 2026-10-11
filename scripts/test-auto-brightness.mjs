import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const exports={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../src/led-brightness.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports)
const {createBrightnessTransport,brightnessQuery,brightnessWrite}=exports
let now=0,id=0,timers=new Map()
const realSet=globalThis.setTimeout,realClear=globalThis.clearTimeout
globalThis.setTimeout=(fn,delay)=>{const key=++id;timers.set(key,{fn,at:now+delay});return key}
globalThis.clearTimeout=key=>timers.delete(key)
function tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn()}now=end}
function setup(){const sent=[],states=[];const transport=createBrightnessTransport(b=>sent.push(b),s=>states.push(s));return {transport,sent,state:()=>states.at(-1)}}
try {
  const {transport:t,sent,state}=setup()
  t.read();assert.deepEqual(sent,[brightnessQuery]);t.set(8);tick(100);assert.equal(sent.length,1,'Unknown hardware state cannot be written')
  assert.equal(t.receive([1,2]),false);assert.equal(state().busy,true)
  t.receive(brightnessWrite(5));assert.equal(state().value,5)
  t.set(6);tick(30);t.set(7);tick(30);t.set(8);tick(79);assert.equal(sent.length,1)
  tick(1);assert.deepEqual(sent.slice(1),[brightnessWrite(8),brightnessQuery])
  t.set(9);tick(80);assert.equal(sent.length,3,'Only one outstanding read-back')
  t.set(10);t.receive(brightnessWrite(8));assert.equal(state().draft,10);tick(80)
  assert.deepEqual(sent.slice(3),[brightnessWrite(10),brightnessQuery])
  t.receive(brightnessWrite(10));t.set(10);tick(80);assert.equal(sent.length,5,'No duplicate write')
  t.set(12);tick(80);t.receive(brightnessWrite(11));assert.equal(state().value,11);assert.equal(state().draft,11);assert.match(state().status,/mismatch/)
  t.set(13);t.close();tick(5000);assert.equal(sent.length,7,'Disconnect discards pending slider choice');assert.equal(t.receive(brightnessWrite(13)),false)

  const retry=setup();retry.transport.read();tick(2000);assert.equal(retry.state().value,null);tick(300);tick(2000);tick(300);tick(2000);tick(5000)
  assert.deepEqual(retry.sent,[brightnessQuery,brightnessQuery,brightnessQuery],'Bounded read-only retries');retry.transport.close()

  const timeout=setup();timeout.transport.read();timeout.transport.receive(brightnessWrite(4));timeout.transport.set(6);tick(80);timeout.transport.set(7);tick(2000)
  assert.equal(timeout.state().value,null);tick(300);timeout.transport.receive(brightnessWrite(6));tick(5000)
  assert.deepEqual(timeout.sent,[brightnessQuery,brightnessWrite(6),brightnessQuery,brightnessQuery],'Timeout never replays an uncertain write or queued target');timeout.transport.close()
  let failed
  const broken=createBrightnessTransport(()=>{throw Error('BCR32 output disconnected')},s=>failed=s);broken.read();assert.equal(failed.busy,false);assert.equal(failed.value,null);tick(5000);broken.close()
  assert.equal(failed.status,'BCR32 output disconnected','Thrown catalog key reaches the status untouched (no "Error: " prefix)')
  assert.equal(timers.size,0)
  console.log('PASS: automatic read, debounced latest value, serialized read-back, mismatch, bounded read-only retries and disconnect cancellation; no STORE')
} finally {globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear}
