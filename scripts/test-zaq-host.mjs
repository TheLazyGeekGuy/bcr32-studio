// Offline protocol regression. Physical 1.0.3 captures are fixtures, never replayed to MIDI.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
const result=await build({stdin:{contents:"export * from './src/editors/bcontrol/bcr32/zaq-host';export * from './src/editors/bcontrol/bcr32/firmware-codec';export * from './src/editors/bcontrol/bcr32/zaquencer'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const module={exports:{}};new Function('module','exports',result.outputFiles[0].text)(module,module.exports);const z=module.exports
const fixture=JSON.parse(readFileSync(new URL('./fixtures/zaq-host-103.json',import.meta.url),'utf8'))
const stateFixture=JSON.parse(readFileSync(new URL('./fixtures/zaq-host-103-state.json',import.meta.url),'utf8'))
assert.deepEqual(z.parseHostReply(stateFixture.runningTrack0,0).values,[1,0,0,0,0])
assert.deepEqual(z.parseHostReply(stateFixture.runningTrack1,0).values,[1,0,1,0,0])
assert.deepEqual(stateFixture.runningTrack0,stateFixture.restoredTrack0)
assert.equal(fixture.identity.firmware,'1.0.3');assert.equal(fixture.restored,true)
assert.equal(z.supportsZaqHost('1.0.3'),true)
for(const f of [null,'1.0.2','1.0.4','2.0.0','1.0.3-dev'])assert.equal(z.supportsZaqHost(f),false)
const frames=fixture.frames.filter(b=>b[6]!==0)
for(const frame of frames){assert.ok(z.parseHostReply(frame,0));assert.equal(z.parseHostReply(frame,1),null);assert.equal(z.parseHostReply(frame,127),null)}
assert.equal(frames.filter(b=>b[6]===0x45).length,38)
let data=Array(1024).fill(0)
for(const b of frames.filter(b=>b[6]===0x45).slice(0,36)){const r=z.parseHostReply(b,0);data=z.applyHostLane(data,r.track,r.field,r.values)}
for(let t=0;t<4;t++)for(let s=0;s<32;s++)assert.deepEqual(z.readStep(data,t,s),{note:60,velocity:100,rest:false,mask:false,delay:0,gate:2,alpha:255,beta:255,voices:0})
const ack=frames.find(b=>b[6]===0x44);assert.equal(z.parseHostReply(ack,0).values[0],61)
assert.deepEqual(z.writeHostStep(0,0,0,61),[240,0,32,50,127,100,68,2,0,0,0,0,0,61,247])
const ranges=[[0,127],[0,127],[0,1],[-5,5],[0,15],[-1,127],[-1,127],[0,55],[0,1]]
for(let field=0;field<9;field++){
 for(const value of ranges[field]){const b=z.writeHostStep(3,31,field,value);assert.ok(z.isZaqHostWrite(b));assert.ok(!z.isZaqHostQuery(b))}
 for(const value of [ranges[field][0]-1,ranges[field][1]+1,NaN,1.5])assert.throws(()=>z.writeHostStep(0,0,field,value))
}
for(let t=0;t<4;t++)for(let f=0;f<9;f++){const b=z.readHostLane(t,f);assert.ok(z.isZaqHostQuery(b));assert.equal(z.parseHostReply(b,0),null)}
for(const b of [z.midiFrame(7),z.midiFrame(0x48,[1]),z.midiFrame(0x48,[2]),z.midiFrame(0x45,[2,0,0]),z.midiFrame(0x44,[2,0,0,9,0,0,0]),z.midiFrame(0x77)]){assert.equal(z.isZaqHostQuery(b),false);assert.equal(z.isZaqHostWrite(b),false)}
for(const b of frames){for(const index of [4,5,6,b.length-1]){const bad=[...b];bad[index]^=1;assert.equal(z.parseHostReply(bad,0),null)}}
for(const index of [11,19,27,35,43,51,59,67,75,83]){const b=[...frames.find(b=>b[6]===0x45)];b[index]=127;assert.doesNotThrow(()=>z.parseHostReply(b,0))}
const malformed=z.writeHostStep(0,0,0,60);malformed[11]=127;assert.equal(z.isZaqHostWrite(malformed),false)
const after=z.patchStep(data,2,15,{note:64,delay:-5,alpha:1,rest:true,voices:55})
assert.deepEqual(z.changedHostSteps(data,after),[{track:2,step:15,field:0,value:64},{track:2,step:15,field:2,value:1},{track:2,step:15,field:3,value:-5},{track:2,step:15,field:5,value:1},{track:2,step:15,field:7,value:55}])
assert.equal(z.readStep(z.applyHostLane(data,0,7,Array(32).fill(-1)),0,0).voices,65535,'unknown Chord words remain lossless on read')
assert.ok(z.sameHostPatternContext([0,0,0,0,0],[1,0,0,0,0]),'PLAY does not invalidate the pattern')
assert.ok(z.sameHostPatternContext([0,0,0,0,0],[0,0,1,0,0]),'track selection does not invalidate a four-track snapshot')
assert.equal(z.sameHostPatternContext([0,0,0,0,0],[0,1,0,0,0]),false)
let sent=[];const client=z.createZaqHost(b=>sent.push(b),0,20)
const lane=client.readLane(0,0)
client.receive(z.readHostLane(0,0));client.receive(frames.find(b=>b[6]===0x45&&b[9]===1));client.receive(frames.find(b=>b[6]===0x45&&b[8]===0&&b[9]===0))
assert.equal((await lane).values[0],60)
await assert.rejects(client.state(),/timeout/);assert.equal(sent.length,2,'no retries or command scanning')
const cancelled=client.readLane(1,0);client.close();await assert.rejects(cancelled,/cancelled/)
await assert.rejects(client.state(),/closed/)
const failing=z.createZaqHost(()=>{throw Error('disconnected')},0);await assert.rejects(failing.state(),/disconnected/);failing.close()
console.log('PASS Zaq host 1.0.3: physical read/write/restoration fixtures; all 9 lanes, signed/16-bit packing, strict ranges and firmware gates, echo/source/selector refusal, timeout/no retry, cancellation and no STORE/transport/legacy export')
