import assert from 'node:assert/strict'
import {build} from 'esbuild'
const b=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/page-follow';export {validateQuery} from './src/editors/bcontrol/bcr32/host-policy'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
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
console.log('PASS captured page parser: CTRL/ZQR checksums; export08 refused by host; no automatic follower or sender')
