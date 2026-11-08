import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {performance} from 'node:perf_hooks'
import {readFileSync,readdirSync} from 'node:fs'
const result=await build({stdin:{contents:`export * from './src/sysex-catalog/catalog';export * from './src/bcl-tx';export * from './src/history';export {acceptsValue,valueDomain} from './src/sysex-map'`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'})
const module={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));const m=module.exports
assert.ok(m.synthCatalog.length>=21);assert.equal(new Set(m.synthCatalog.map(x=>x.id)).size,m.synthCatalog.length)
const shippedIds=new Set(m.synthCatalog.map(x=>x.id))
for(const file of readdirSync('src/sysex-catalog/tables').filter(f=>f.endsWith('.json')))assert.ok(shippedIds.has(file.slice(0,-5)),`normalized table ${file} must be reachable in the catalogue`)
for(const device of JSON.parse(readFileSync('src/sysex-catalog/starter.sxm.json','utf8')).devices)assert.ok(shippedIds.has(device.id),`seed model ${device.id} must remain reachable`)
let count=0,values=0
for(const model of m.synthCatalog){
 assert.match(m.catalogSources[model.source].url,/^https:\/\//);assert.ok(model.section&&model.notes)
 assert.equal(new Set(model.commands.map(c=>c.id)).size,model.commands.length)
 for(const c of model.commands){
  count++;assert.ok(['edit-buffer','request','global-change','persistent-write'].includes(c.effect));const before=JSON.stringify(c)
  const refused=c.minimum<0||!!m.valueDomain(c.parameter)||!['edit-buffer','request'].includes(c.effect);let program
  if(refused)assert.throws(()=>m.catalogProgram(model,c,{}));else{program=m.parseCustomAssignment(m.catalogProgram(model,c,{}));assert.equal(program.conversionStatus,c.checksum?'partial':'exact')}
  for(let v=c.minimum;v<=c.maximum;v++){
   if(!m.acceptsValue(c.parameter,v)){assert.throws(()=>m.previewCatalog(c,{},v));continue}
   const bytes=m.previewCatalog(c,{},v);values++;assert.equal(bytes[0],240);assert.equal(bytes.at(-1),247);assert.ok(bytes.slice(1,-1).every(b=>Number.isInteger(b)&&b>=0&&b<=127))
   if(c.checksum){const span=bytes.slice(c.checksum.start,-2),sum=span.reduce((a,b)=>a+b,0);assert.equal(bytes.at(-2),c.checksum.method==='complement7'?(-sum&127):c.checksum.method==='xor7'?span.reduce((a,b)=>a^b,0)&127:sum&127);if(program)assert.throws(()=>m.evaluateAssignment(program,v))}
   else if(program)assert.deepEqual(m.evaluateAssignment(program,v),[bytes])
  }
  assert.throws(()=>m.previewCatalog(c,{},c.minimum-1));assert.throws(()=>m.previewCatalog(c,{},c.maximum+1));assert.throws(()=>m.previewCatalog(c,{},0.5))
  for(const f of c.fields){for(const v of [f.minimum,f.maximum])assert.equal(m.previewCatalog(c,{[f.name]:v},c.minimum)[f.index],f.base+v)
   for(const v of [f.minimum-1,f.maximum+1,NaN,1.5])assert.throws(()=>m.catalogProgram(model,c,{[f.name]:v}))}
  assert.equal(JSON.stringify(c),before,'builders do not mutate the shared definitions')
 }
}
assert.ok(count>=1705)
const preview=(model,command,value,fields={})=>{const a=m.synthCatalog.find(x=>x.id===model);return m.hexBytes(m.previewCatalog(a.commands.find(c=>c.id===command),fields,value))}
assert.equal(preview('microwave','cutoff',64),'F0 3E 00 00 60 00 03 0C 40 4F F7')
assert.equal(preview('microwave2','cutoff',64),'F0 3E 0E 00 20 00 00 3E 40 F7')
assert.equal(preview('blofeld','cutoff',127,{device:16,part:16}),'F0 3E 13 10 20 0F 00 4E 7F F7')
assert.equal(preview('tx81z','algorithm',7,{channel:16}),'F0 43 1F 12 34 07 F7')
assert.equal(preview('dx7','algorithm',31),'F0 43 10 01 06 1F F7')
assert.equal(preview('fs1r','cutoff',127,{device:16,part:4}),'F0 43 1F 5E 43 00 57 00 7F F7')
assert.equal(preview('alpha-juno2','cutoff',64),'F0 41 36 00 23 20 01 10 40 F7')
assert.equal(preview('jx8p','cutoff',64),'F0 41 36 00 21 01 01 22 40 F7')
assert.equal(preview('dw8000','cutoff',63,{channel:16}),'F0 42 3F 03 41 0F 3F F7')
assert.equal(preview('dw6000','cutoff',63),'F0 42 30 04 41 05 3F F7')
assert.equal(m.synthCatalog.find(x=>x.id==='dw6000').commands[0].fields.length,0,'DW-6000 format 30h is fixed, unlike DW-8000')
assert.equal(preview('m1','program-request',0),'F0 42 30 19 10 F7')
assert.equal(preview('bass-station-ii','overlay-request',24),'F0 00 20 29 00 33 00 4F 18 F7')
assert.equal(preview('jv2080','tone-1-81',64),'F0 41 10 6A 12 03 00 10 51 40 5C F7')
assert.equal(preview('jv2080','tone-1-3',254),'F0 41 10 6A 12 03 00 10 03 0F 0E 4D F7')
assert.equal(preview('an1x','parameter-10',255),'F0 43 10 5C 10 10 0A 01 7F F7')
assert.equal(preview('cs1x','parameter-9',255),'F0 43 10 4C 08 00 09 0F 0F F7')
assert.equal(preview('fs1r','operator-1',31,{part:4,operator:8}),'F0 43 10 5E 63 07 01 00 1F F7')
assert.equal(preview('m1','edit-double-5-9',99),'F0 42 30 19 41 05 09 63 00 F7')
assert.equal(preview('m1','edit-single-2-8',-1),'F0 42 30 19 41 02 08 7F 7F F7')
const dx21=m.synthCatalog.find(d=>d.id==='dx21');assert.match(dx21.commands.find(c=>c.id==='18-13').label,/Operator 2/);assert.match(dx21.commands.find(c=>c.id==='18-26').label,/Operator 3/)
const tampered=structuredClone(m.synthCatalog[0].device);tampered.extensions={'org.midistudio.catalogue':{inventoryOnly:'not an array',notCovered:123}};assert.deepEqual(m.catalogueInfo(tampered),{scope:'',inventoryOnly:[],notCovered:[]})

assert.equal(m.findCatalog('TX81Z').length,1);assert.equal(m.findCatalog('Waldorf cutoff').length,4);assert.equal(m.findCatalog('not a synth').length,0)
const h=m.createHistory();h.arrive('t','original');h.record('t','typed',0);h.record('t','catalogue',1,true);assert.equal(h.undo('t'),'typed');assert.equal(h.undo('t'),'original')
const view=readFileSync('src/editors/bcontrol/bcr32/CustomProgramEditor.tsx','utf8');assert.match(view,/lazy\(\(\)=>import\('\.\.\/\.\.\/\.\.\/sysex-catalog\/CatalogPicker'\)\)/)
const pure=readFileSync('src/sysex-catalog/catalog.ts','utf8');assert.ok(!/requestMIDIAccess|localStorage|\.send\(|setInterval|fetch\(/.test(pure))
// Bounded local workload; an initial codec baseline, not physical MIDI throughput or a memory claim.
const command=m.synthCatalog[0].commands.find(c=>c.id==='cutoff'),start=performance.now();for(let i=0;i<10000;i++)m.previewCatalog(command,{},i%128);const elapsed=performance.now()-start
console.log(`PASS SysEx catalogue: ${m.synthCatalog.length} models / ${count} templates / ${values} range values; primary-source metadata, bounded addressing, independent wire fixtures, checksum file-only, parser parity, inert helpers and discrete Undo. Local preview workload: 10000 / ${elapsed.toFixed(2)} ms`)
