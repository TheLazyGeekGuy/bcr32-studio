import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
const built=await build({entryPoints:['src/sysex-map/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',metafile:true})
assert.ok(Object.keys(built.metafile.inputs).every(f=>f.startsWith('src/sysex-map/')),'standalone SDK has no host, React, BCL or device dependency')
const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));const m=module.exports
const read=file=>readFileSync(file,'utf8'),base='docs/formats/sysex-map-v1/'
const vectors=JSON.parse(read(base+'vectors.json')),copy=v=>JSON.parse(JSON.stringify(v))
for(const v of vectors){const d=m.parseMap(read(base+v.file)),{parameter}=m.resolveParameter(d,v.device,v.parameter);assert.deepEqual(m.renderParameter(parameter,v.value,v.fields),v.expected);assert.deepEqual(m.parseMap(m.serializeMap(d)),d)}
const python=spawnSync('python3',[base+'reference-renderer.py','--vectors',base+'vectors.json'],{encoding:'utf8'})
assert.equal(python.status,0,python.stderr);assert.deepEqual(JSON.parse(python.stdout),vectors.map(v=>v.expected),'Python and TypeScript agree independently')
const starter=m.parseMap(read('src/sysex-catalog/starter.sxm.json')),old=JSON.parse(read('scripts/fixtures/sysex-catalog-alpha5.json'))
assert.equal(starter.devices.length,20)
for(const model of old.models)for(const c of model.commands){const {parameter}=m.resolveParameter(starter,model.id,c.id)
 for(const value of [c.minimum,Math.floor((c.minimum+c.maximum)/2),c.maximum]){
  const fields=Object.fromEntries(c.fields.map(f=>[f.name,f.maximum])),bytes=[...c.prefix];for(const f of c.fields)bytes[f.index]=f.base+fields[f.name]
  for(const token of c.valueTokens)bytes.push(token==='val'?value:token==='val7.13'?value>>>7&127:value&127)
  if(c.checksum)bytes.push(bytes.slice(c.checksum.start).reduce((a,b)=>a+b,0)&127)
  bytes.push(247);assert.deepEqual(m.renderParameter(parameter,value,fields),[bytes],'alpha5 wire compatibility')
 }}
const example=m.parseMap(read(base+'tx81z.sxm.json'))
assert.ok(Object.isFrozen(example)&&Object.isFrozen(example.devices[0].parameters[0]))
assert.ok(Object.isFrozen(m.sysexMapSchema.properties.version))
assert.equal(example.values[0].origin,'preset')
const changed=m.withMapValue(example,{device:'tx81z',parameter:'algorithm',value:7,fields:{channel:16},origin:'user'})
assert.equal(changed.values[0].value,7);assert.equal(example.values[0].value,3)
assert.deepEqual(m.subsetMap(changed,'tx81z','algorithm').extensions,example.extensions)
assert.equal(m.subsetMap(starter,'dx7').devices.length,1)
assert.throws(()=>m.subsetMap(starter,'missing'));assert.throws(()=>m.subsetMap(starter,'dx7','missing'))
const bad=mutate=>{const d=copy(example);mutate(d);assert.throws(()=>m.validateMap(d))}
bad(d=>d.version='2.0');bad(d=>d.format='BCL');bad(d=>d.execute='script');bad(d=>d.requiredExtensions=['vendor.feature']);bad(d=>d.devices.push(d.devices[0]));bad(d=>d.devices[0].parameters.push(d.devices[0].parameters[0]));bad(d=>d.devices[0].documentation.sources=['missing']);bad(d=>d.devices[0].parameters[0].value.default=8);bad(d=>d.devices[0].parameters[0].value.minimum=10)
bad(d=>d.devices[0].parameters[0].messages[0].bytes[0]=239);bad(d=>d.devices[0].parameters[0].messages[0].bytes[1]=128);bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={field:'missing',add:0});bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={field:'channel',add:127});bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={checksum:{algorithm:'sum7',from:0,to:2}});bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={checksum:{algorithm:'crc32',from:0,to:1}});bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={value:{shift:0,bits:8,add:0}});bad(d=>d.devices[0].parameters[0].messages[0].bytes[2]={value:{shift:0,bits:7,add:0},field:'channel',add:0})
bad(d=>d.values[0].fields.channel=17);bad(d=>d.values.push(d.values[0]));bad(d=>d.values[0].parameter='missing');bad(d=>d.values[0].value=NaN);bad(d=>d.devices[0].parameters[0].value.labels={'8':'outside'});bad(d=>d.devices[0].parameters[0].value.labels={'-0':'not canonical'});bad(d=>d.extensions={bad:undefined})
assert.throws(()=>m.parseMap('{"format":"one","format":"two"}'),/duplicate object key/)
assert.throws(()=>m.parseMap('{"x":1,"\\u0078":2}'),/duplicate object key/)
assert.throws(()=>m.parseMap('{"extensions":{"__proto__":{}}}'))
assert.throws(()=>m.parseMap('['.repeat(40)+'0'+']'.repeat(40)),/depth/)
assert.throws(()=>m.parseMap(' '.repeat(m.maxMapBytes+1)),/2 MiB/)
assert.throws(()=>m.parseMap('{"x":1} garbage'));assert.throws(()=>m.parseMap('null'));assert.throws(()=>m.parseMap('{bad'))
assert.deepEqual(m.parseMap('\uFEFF'+m.serializeMap(example)),example)
assert.deepEqual(m.decodeMap(new TextEncoder().encode(m.serializeMap(example))),example)
assert.throws(()=>m.decodeMap(Uint8Array.from([123,34,120,34,58,34,255,34,125])),'malformed UTF-8 must not be normalized into replacement characters')
assert.equal(m.serializeMap(m.parseMap(m.serializeMap(example))),m.serializeMap(example))
const mutated=copy(example);mutated.extensions={'z.app':{unicode:'é',array:[null,true,3.5]},'a.app':{field:'kept'}};assert.deepEqual(m.parseMap(m.serializeMap(mutated)).extensions,mutated.extensions)
console.log('PASS SXM 1.0: schema-driven structure + references/framing/ranges/checksum semantics, duplicate-key/depth/budget refusals, deterministic roundtrip/extensions/values, 20-model legacy parity, inert standalone SDK and 11 independent Python/TypeScript golden vectors')
