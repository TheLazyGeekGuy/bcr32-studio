// Offline: the sequencer clock master sends only Start, 24 clocks per quarter at the chosen tempo, and Stop.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'seq-clock-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/sequencer-clock'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const m=createRequire(import.meta.url)(bundle);rmSync(dir,{recursive:true})
let t=1000,fn=null;const timers={now:()=>t,every:f=>{fn=f;return 1},cancel:()=>{fn=null}}
const sent=[],changes=[],clock=m.createClockMaster((b,at)=>sent.push([b[0],at]),r=>changes.push(r),{timers,lookaheadMs:50})
clock.start(125)
assert.equal(sent[0][0],0xfa,'Start first');assert.deepEqual(changes,[true])
for(let i=0;i<100;i++){t+=10;fn()}                       // one second
const clocks=sent.filter(s=>s[0]===0xf8)
assert.equal(clocks.length,Math.floor((1050)/20)+1,'24 clocks per quarter at 125 BPM = one every 20 ms, scheduled 50 ms ahead')
assert.ok(clocks.every((c,i)=>Math.abs(c[1]-(1000+i*20))<1e-9),'evenly timestamped')
clock.stop();assert.equal(sent.at(-1)[0],0xfc,'Stop last');assert.deepEqual(changes,[true,false]);assert.equal(fn,null,'timer cancelled')
const n=sent.length;clock.stop();assert.equal(sent.length,n,'a second stop sends nothing')
assert.ok(sent.every(s=>m.isClockMessage([s[0]])),'only FA, F8, FC')
for(const b of [[0xf0],[0x90,60,100],[0xfb],[0xf8,0]])assert.equal(m.isClockMessage(b),false)
clock.start(1000);assert.equal(clock.bpm,300,'tempo clamped to the BCR32 range');clock.stop()
{const c=m.createClockMaster(()=>{throw Error('gone')},undefined,{timers});assert.throws(()=>c.start(),/gone/);assert.equal(c.running,false,'a failed send halts the clock')}
console.log('PASS sequencer clock: Start, 24 ppq timestamped clocks, Stop, tempo range, only realtime transport bytes')
