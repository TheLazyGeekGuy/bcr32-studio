// Software-only manufacturer-table verification. No MIDI access, discovery or sender.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {build} from 'esbuild'
const compiled=await build({stdin:{contents:"export * from './src/sysex-catalog/catalog';export * from './src/bcl-tx';export {serializeMap,parseMap,subsetMap} from './src/sysex-map'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'})
const module={exports:{}};new Function('module','exports','require',compiled.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url))
const m=module.exports,model=m.synthCatalog.find(d=>d.id==='a3000v2'),table=JSON.parse(readFileSync('src/sysex-catalog/tables/a3000v2.json'))
assert.equal(model.commands.length,103);assert.equal(table.rows.filter(r=>r.block==='program').length,30)
const command=id=>model.commands.find(c=>c.id===id)
for(const row of table.rows){
 const c=command(row.id);assert.equal(m.catalogueContext(c.parameter),row.block)
 for(const value of [row.minimum,row.maximum,Math.trunc((row.minimum+row.maximum)/2)]){
  const fields=Object.fromEntries(c.fields.map(f=>[f.name,f.maximum]))
  const address=row.address.map(t=>typeof t==='number'?t:fields[t.field]+t.add)
  // Independent 8-bit two's-complement + high/low nibble algorithm, not the SXM renderer.
  const normalized=value<0?value+2**(row.size*8):value
  const bytes=Array.from({length:row.size*2},(_,i)=>Math.floor(normalized/16**(row.size*2-1-i))%16)
  assert.deepEqual(m.previewCatalog(c,fields,value),[240,67,31,88,1,...address,...bytes,247],row.id)
 }
 if(row.minimum<0)assert.throws(()=>m.catalogProgram(model,c,{}),/Signed logical ranges/)
 else{const assignment=m.parseCustomAssignment(m.catalogProgram(model,c,{}));assert.equal(assignment.conversionStatus,'exact');assert.deepEqual(m.evaluateAssignment(assignment,row.maximum),[m.previewCatalog(c,{},row.maximum)])}
}
const hex=(id,value)=>m.hexBytes(m.previewCatalog(command(id),{},value))
assert.equal(hex('sample-22-0',64),'F0 43 10 58 01 02 16 00 00 00 00 04 00 F7')
assert.equal(hex('program-14-0',250),'F0 43 10 58 01 01 0E 00 00 00 00 0F 0A F7')
assert.equal(hex('sample-9-0',-1),'F0 43 10 58 01 02 09 00 00 00 00 0F 0F F7')
assert.equal(command('program-11-0').label,'Program / Program LFO cycle','V2 does not retain V1 fine-tune semantics')
assert.equal(command('program-16-0').label,'Program / Program LFO wave','V2 does not retain V1 portamento semantics')
assert.equal(command('sample-10-0').maximum,128);assert.equal(command('sample-21-0').maximum,16)
assert.equal(command('sample-26-0').maximum,68);assert.equal(command('sample-41-0').minimum,-127)
for(const id of ['sample-11-0','sample-13-0','program-20-0','program-21-4','program-25-0'])assert.equal(command(id),undefined,'ambiguous/structural addresses are not executable definitions')
for(const id of ['sample-22-0','program-14-0','sample-9-0','sample-20-0']){
 const c=command(id),value=c.minimum
 const result=spawnSync('python3',['docs/formats/sysex-map-v1/reference-renderer.py','src/sysex-catalog/expanded.sxm.json','--device','a3000v2','--parameter',id,'--value',String(value)],{encoding:'utf8'})
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[m.previewCatalog(c,{},value)])
}
const scoped=m.subsetMap(m.starterMap,'a3000v2'),roundtrip=m.parseMap(m.serializeMap(scoped));assert.equal(roundtrip.devices[0].parameters.length,103)
assert.equal(m.catalogueContext({...command('sample-22-0').parameter,extensions:{'org.midistudio.catalogue':{objectContext:123}}}),null)
const previous=structuredClone(m.starterMap);previous.devices=previous.devices.filter(d=>d.id!=='a3000v2');delete previous.sources.a3000;delete previous.sources.a3000v2
previous.values=[{device:'tx81z',parameter:'algorithm',value:3,fields:{channel:8},origin:'observed'}]
const refreshed=m.refreshBuiltinCatalogue(previous);assert.equal(refreshed.devices.length,23);assert.deepEqual(refreshed.values,previous.values);assert.equal(previous.devices.length,22,'refresh leaves saved bytes untouched')
const custom=structuredClone(previous);custom.devices[0].notes+=' User changes';assert.equal(m.refreshBuiltinCatalogue(custom),custom,'custom catalogue is never overwritten')
assert.equal(m.refreshBuiltinCatalogue(scoped),scoped,'scoped imports remain scoped')
const partial=structuredClone(previous);partial.devices=partial.devices.slice(0,20);delete partial.values;assert.equal(m.refreshBuiltinCatalogue(partial),partial,'partial multi-model imports remain scoped')
assert.equal(m.refreshBuiltinCatalogue(m.starterMap),m.starterMap)
console.log('PASS A3000 V2: 103 scoped definitions, independent nibble vectors, V2 overrides, contextual object requirement, signed BCL refusal, Python parity and SXM roundtrip; no hardware exercised.')
