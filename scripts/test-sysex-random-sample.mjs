// Reproducible, stratified random sample. Pure codecs and a Python reference only; no MIDI/network API.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
const seed=Number(process.env.SXM_TEST_SEED??20261030)>>>0
let randomState=seed
const random=n=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return Math.floor(randomState/4294967296*n)}
const compiled=await build({stdin:{contents:"export * from './src/sysex-catalog/catalog';export * from './src/bcl-tx';export {valueDomain,acceptsValue} from './src/sysex-map';export {fragmentForBody} from './src/editors/bcontrol/bcr32/custom-program-transfer'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'})
const module={exports:{}};new Function('module','exports','require',compiled.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));const m=module.exports
const sample=[['microwave','checksum'],['jv2080','checksum'],['tx81z','simple'],['fs1r','simple'],['m1','signed']]
const results=[]
for(const [id,kind]of sample){
 const model=m.synthCatalog.find(d=>d.id===id)
 const pool=model.commands.filter(c=>c.effect==='edit-buffer'&&(kind==='checksum'?!!c.checksum&&!m.valueDomain(c.parameter):kind==='signed'?c.minimum<0:!c.checksum&&c.minimum>=0&&!m.valueDomain(c.parameter)))
 assert.ok(pool.length)
 const command=pool[random(pool.length)],valid=[]
 for(let value=command.minimum;value<=command.maximum;value++)if(m.acceptsValue(command.parameter,value))valid.push(value)
 const value=valid[random(valid.length)],fields=Object.fromEntries(command.fields.map(f=>[f.name,f.minimum+random(f.maximum-f.minimum+1)]))
 const expected=m.previewCatalog(command,fields,value)
 const args=['docs/formats/sysex-map-v1/reference-renderer.py','src/sysex-catalog/expanded.sxm.json','--device',id,'--parameter',command.id,'--value',String(value),...Object.entries(fields).flatMap(([k,v])=>['--field',`${k}=${v}`])]
 const reference=spawnSync('python3',args,{encoding:'utf8'});assert.equal(reference.status,0,reference.stderr);assert.deepEqual(JSON.parse(reference.stdout),[expected],'independent Python agrees with TS')
 assert.throws(()=>m.previewCatalog(command,fields,command.minimum-1));assert.throws(()=>m.previewCatalog(command,fields,command.maximum+1))
 for(const f of command.fields)assert.throws(()=>m.previewCatalog(command,{...fields,[f.name]:f.maximum+1},value))
 let native
 if(kind==='signed'){
  assert.throws(()=>m.catalogProgram(model,command,fields),/Signed logical ranges/);native='refused: signed BCL range'
 }else{
  const source=m.catalogProgram(model,command,fields),program=m.parseCustomAssignment(source)
  if(kind==='checksum'){
   assert.equal(program.conversionStatus,'partial');assert.throws(()=>m.evaluateAssignment(program,value));assert.throws(()=>m.txToSysex(program.messages[0]));assert.throws(()=>m.fragmentForBody({kind:'encoders',id:8},source));native='refused: checksum is file-only'
  }else{
   assert.equal(program.conversionStatus,'exact');assert.deepEqual(m.evaluateAssignment(program,value),[expected])
   m.fragmentForBody({kind:'encoders',id:8},source);m.fragmentForBody({kind:'pushes',id:8},source)
   native='software preflight accepted; hardware not exercised'
  }
 }
 results.push({model:`${model.manufacturer} ${model.model}`,parameter:command.label,id:command.id,value,fields,frame:m.hexBytes(expected),software:'PASS',native})
}
console.log(JSON.stringify({seed,scope:'Software only; no MIDI ports, hardware send or physical qualification',results},null,2))
