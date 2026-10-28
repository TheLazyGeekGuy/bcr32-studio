import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
const built=await build({stdin:{contents:"export * from './src/editors/bcontrol/bcr32/sequencer-follow'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports)
const {createPlaybackFollower,decodeTrackTiming}=mod.exports
const fixture=JSON.parse(readFileSync(new URL('./fixtures/zaq-clock-103.json',import.meta.url),'utf8'))
const timing=decodeTrackTiming(fixture.timing),masks=Array.from({length:4},()=>Array(32).fill(false)),tracks=Array(4).fill(timing)
let updates=0;const f=createPlaybackFollower(()=>updates++)
f.configure('physical capture',tracks,masks)
f.receive([248],-100);assert.equal(f.snapshot().synced,false,'midstream clock does not invent phase')
f.receive([250],0);assert.deepEqual(f.snapshot().positions,[0,0,0,0])
for(const at of fixture.clockOffsetsMs)f.receive([248],at)
assert.equal(fixture.clockOffsetsMs.length,71)
assert.deepEqual(f.snapshot().positions,[11,11,11,11],'71 captured clocks place forward six-tick tracks on step12')
assert.ok(f.snapshot().bpm>34&&f.snapshot().bpm<36)
assert.ok(updates<30,'presentation is step/tempo coalesced, not one render per tick')
f.receive([252],fixture.stopMs);assert.deepEqual(f.snapshot().positions,[null,null,null,null])
f.receive([251],fixture.stopMs+100);assert.equal(f.snapshot().synced,false,'Continue without retained phase never guesses')
f.receive([250],10000);for(let n=0;n<7;n++)f.receive([248],10000+n*70);assert.deepEqual(f.snapshot().positions,[1,1,1,1])
f.checkStale(12000);assert.equal(f.snapshot().synced,false);assert.equal(f.snapshot().clockSeen,false)
f.configure('other instance',tracks,masks);assert.deepEqual(f.snapshot().positions,[null,null,null,null])
const unsupported=tracks.map((t,i)=>({...t,direction:i===0?3:0,shuffleEven:i===1?1:0}));const skipped=masks.map(m=>[...m]);skipped[2][0]=true
f.configure('qualification',unsupported,skipped);f.receive([250],20000);assert.deepEqual(f.snapshot().positions,[null,null,null,0])
const other=createPlaybackFollower(()=>{});other.configure('independent',tracks,masks);assert.equal(other.snapshot().synced,false)
let burstUpdates=0;const burst=createPlaybackFollower(()=>burstUpdates++);burst.configure('high-rate',tracks,masks);burst.receive([250],0)
for(let n=0;n<2400;n++)burst.receive([248],n*1000/120)
assert.ok(burstUpdates<=425,'120Hz clocks cause step/tempo updates, not 120Hz full-view changes')
for(const bad of [[1,32,0,4,0,0,-1],[1,32,0,4,0,0,NaN],[]])assert.throws(()=>decodeTrackTiming(bad))
assert.equal(decodeTrackTiming([1,32,0,4,45,0,99]).direction,99,'unknown read values are preserved, never granted a cursor')
const narrow=tracks.map(t=>({...t,start:30,length:4,offset:2,divider:2}));f.configure('offset wrap',narrow,masks);f.receive([250],30000);assert.deepEqual(f.snapshot().positions,[31,31,31,31]);for(let n=0;n<=24;n++)f.receive([248],30000+n*70);assert.deepEqual(f.snapshot().positions,[0,0,0,0])
const fast=JSON.parse(readFileSync(new URL('./fixtures/zaq-clock-300.json',import.meta.url),'utf8'))
for(const quantum of [0,1,2,10]){
  const follower=createPlaybackFollower(()=>{});follower.configure('native 300 tempo only',tracks,masks)
  for(const time of fast.clockOffsetsMs)follower.receive([248],quantum?Math.round(time/quantum)*quantum:time)
  assert.ok(Math.abs(follower.snapshot().bpm-300)<1,`300 BPM survives ${quantum}ms timestamp quantization: ${follower.snapshot().bpm}`)
  assert.equal(follower.snapshot().synced,false,'native high-rate capture has no Start; no invented phase')
}
// Callback batching can be arbitrarily late: source timestamps, not delivery intervals, determine tempo.
for(const quantum of [1,2,10]){
  let deliveredAt=0;const follower=createPlaybackFollower(()=>{},()=>deliveredAt);follower.configure('batched 300',tracks,masks);follower.receive([250],0)
  for(let n=0;n<1200;n++){deliveredAt=Math.ceil(n/12)*100;follower.receive([248],Math.round(n*1000/120/quantum)*quantum)}
  assert.ok(Math.abs(follower.snapshot().bpm-300)<.2)
  assert.deepEqual(follower.snapshot().positions,[7,7,7,7],'all 1200 ticks counted, not dropped or interpolated')
}
const edge=createPlaybackFollower(()=>{});for(let n=0;n<500;n++)edge.receive([248],n*60000/24/300.1)
assert.equal(edge.snapshot().bpm,300.1,'small measurement overshoot above 300 never freezes an older estimate')
const medianTrap=createPlaybackFollower(()=>{});for(let n=0;n<600;n++)medianTrap.receive([248],Math.floor(n/3)*25+[0,9,18][n%3])
assert.ok(Math.abs(medianTrap.snapshot().bpm-300)<.2,'9/9/7ms gaps average 300 BPM, not median-derived 277.8')
console.log('PASS passive sequencer follower: real FA/71 F8/FC replay, timing/phase, no guessed midstream cursor, loss/stop/rebind, unsupported modes, isolation and bounded render updates; no MIDI sender')
