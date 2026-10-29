import assert from 'node:assert/strict'
import {build} from 'esbuild'
const b=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/page-follow';export {validateQuery} from './src/editors/bcontrol/bcr32/host-policy'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',b.outputFiles[0].text)(mod,mod.exports);const m=mod.exports
const frame=mode=>{const h=[240,0,32,50,127,100,4,mode,2,0,0,0,...Array(256).fill(0)];const sum=h.reduce((n,v)=>n+v,0)&65535;return [...h,...[12,8,4,0].map(s=>sum>>s&15),247]}
const ctrl=frame(12),zaq=frame(11)
assert.equal(m.pageFromExport(ctrl),'controller');assert.equal(m.pageFromExport(zaq),'sequencer')
for(const [index,value] of [[0,0],[4,0],[5,99],[7,10],[8,0],[11,8],[12,16],[268,15],[272,0]]){const bad=[...ctrl];bad[index]=value;assert.equal(m.pageFromExport(bad),null)}
assert.equal(m.pageFromExport(ctrl.slice(1)),null)
assert.deepEqual(m.currentPageQuery(),[240,0,32,50,127,100,8,247]);assert.ok(m.validateQuery(m.currentPageQuery()))
assert.equal(m.validateQuery([...m.currentPageQuery().slice(0,-1),0,247]),false,'no padded or value-bearing export command')
assert.equal(m.validateQuery([240,0,32,50,127,100,9,247]),false,'no all-presets export expansion')
const wait=ms=>new Promise(r=>setTimeout(r,ms));let ready=true;const sent=[],changes=[]
const observer=m.createPageFollower({ready:()=>ready,send:b=>sent.push(b),changed:p=>changes.push(p),interval:20,timeout:15})
try{
 assert.equal(observer.receive(ctrl),false,'unsolicited dumps are retained by the normal export receiver')
 await wait(24);assert.equal(sent.length,1);assert.ok(observer.receive(zaq));assert.deepEqual(changes,['sequencer'])
 await wait(20);assert.ok(observer.receive(zaq));assert.equal(changes.length,1,'unchanged mode never echoes or repeats navigation')
 observer.requested('controller');assert.equal(observer.receive(zaq),false,'UI request invalidates the old pending reply')
 await wait(45);assert.ok(observer.receive(ctrl));assert.equal(changes.length,1,'UI selection is already reflected, observation does not echo it')
 await wait(20);assert.ok(observer.receive(zaq));assert.deepEqual(changes,['sequencer','sequencer'],'a subsequent physical transition is observed')
 ready=false;const before=sent.length;await wait(50);assert.equal(sent.length,before,'writes/busy state pause polling')
}finally{observer.close()}
const count=sent.length;await wait(30);assert.equal(sent.length,count);assert.equal(observer.receive(ctrl),false)
assert.ok(sent.every(b=>b[6]===8),'follower only reads; no mode, assignment, STORE or firmware messages')
console.log('PASS page follow: strict CTRL/ZQR checksum framing, qualified read08 only, bounded pending/timeout, UI invalidation, no echo, idle pause and disposal')
