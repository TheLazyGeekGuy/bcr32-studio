import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
const b=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/page-follow';export * from './src/editors/bcontrol/bcr32/page-state';export {validateQuery} from './src/editors/bcontrol/bcr32/host-policy'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',b.outputFiles[0].text)(mod,mod.exports);const m=mod.exports
const frame=mode=>{const h=[240,0,32,50,127,100,4,mode,2,0,0,0,...Array(256).fill(0)];const sum=h.reduce((n,v)=>n+v,0)&65535;return [...h,...[12,8,4,0].map(s=>sum>>s&15),247]}
const ctrl=frame(12),zaq=frame(11)
assert.equal(m.pageFromExport(ctrl),'controller');assert.equal(m.pageFromExport(zaq),'sequencer')
for(const [index,value] of [[0,0],[4,0],[5,99],[7,10],[8,0],[11,8],[12,16],[268,15],[272,0]]){const bad=[...ctrl];bad[index]=value;assert.equal(m.pageFromExport(bad),null)}
assert.equal(m.pageFromExport(ctrl.slice(1)),null)
assert.deepEqual(m.currentPageQuery(),[240,0,32,50,127,100,8,247]);assert.equal(m.validateQuery(m.currentPageQuery()),false,'legacy export08 is not approved for automatic mode following')
assert.equal(m.validateQuery([...m.currentPageQuery().slice(0,-1),0,247]),false,'no padded or value-bearing export command')
assert.equal(m.validateQuery([240,0,32,50,127,100,9,247]),false,'no all-presets export expansion')
assert.equal(m.createPageFollower,undefined,'the rejected background export poller is removed, not feature-flagged')
console.log('PASS captured page parser: CTRL/ZQR checksums; export08 refused by host; rejected export follower stays removed')
// New firmware-qualified state exchange: only48/00, shared by the view and observer.
let time=0,allowed=true;const sent=[],pages=[]
const follow=m.createPageState({firmware:'1.0.3',device:0,send:b=>sent.push(b),canPoll:()=>allowed,onPage:p=>pages.push(p),now:()=>time,timeout:20})
const capture=JSON.parse(readFileSync('scripts/fixtures/page-state-103.json','utf8'))
const ctrlState=capture.cases.find(c=>c.mode==='controller').reply
const seqState=capture.cases.find(c=>c.mode==='sequencer').reply
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
assert.throws(()=>m.createPageState({firmware:'1.0.2',device:0,send(){},canPoll:()=>true,onPage(){}}))
follow.receive(seqState);assert.deepEqual(pages,[],'unsolicited state is not an observation')
follow.tick();const shared=follow.state();assert.strictEqual(follow.state(),shared);assert.equal(sent.length,1,'view and poll coalesce')
for(const [index,value] of [[4,1],[6,71],[7,1],[8,7]]){const bad=[...seqState];bad[index]=value;follow.receive(bad)}
assert.deepEqual(pages,[])
follow.receive(seqState);await shared;await settle();assert.deepEqual(pages,[],'one response is insufficient')
time=1000;follow.tick();follow.receive(seqState);await settle();assert.deepEqual(pages,['sequencer'])
time=2000;follow.tick();follow.receive(ctrlState);await settle();assert.deepEqual(pages,['sequencer'])
time=3000;follow.tick();follow.receive(ctrlState);await settle();assert.deepEqual(pages,['sequencer','controller'])
allowed=false;time=4000;follow.tick();assert.equal(sent.length,4,'busy operations pause background reads')
allowed=true;follow.tick();follow.manual();follow.receive(seqState);await settle();assert.deepEqual(pages,['sequencer','controller'],'manual action invalidates in-flight observation')
time=6000;follow.tick();follow.receive(seqState);await settle();assert.equal(pages.length,2)
time=7000;follow.tick();follow.receive(seqState);await settle();assert.equal(pages.at(-1),'sequencer')
time=8000;follow.tick();follow.receive([240,0,32,50,0,100,72,0,7,247]);await settle()
time=9000;follow.tick();follow.receive(ctrlState);await settle();assert.equal(pages.length,3,'other refusal resets confirmation')
time=10000;follow.tick();follow.receive(ctrlState);await settle();assert.equal(pages.at(-1),'controller')
time=11000;follow.tick();await new Promise(r=>setTimeout(r,30));assert.equal(pages.length,4,'timeout never implies a page')
time=12000;follow.tick();const count=sent.length;assert.equal(count,11,'timeout cooldown pauses another query')
follow.close();time=14000;follow.tick();follow.receive(seqState);assert.equal(sent.length,count);assert.equal(pages.length,4)
assert.ok(sent.every(b=>JSON.stringify(b)===JSON.stringify([240,0,32,50,127,100,72,0,247])))
console.log('PASS page state: firmware/device/selector qualification, stable confirmations, coalescing, busy/manual/timeout/disposal guards, no page/export/STORE output')
