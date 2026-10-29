// Local, transport-free reference artifact. This command does not publish a package.
import {build} from 'esbuild'
import {mkdirSync,copyFileSync,writeFileSync,existsSync,symlinkSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
const dir='output/sysex-map-sdk'
mkdirSync(dir,{recursive:true})
await build({entryPoints:['src/sysex-map/index.ts'],outfile:dir+'/index.mjs',bundle:true,format:'esm',platform:'neutral',target:'es2022',metafile:true})
const tsc=spawnSync(process.execPath,[createRequire(import.meta.url).resolve('typescript/bin/tsc'),'--ignoreConfig','--declaration','--emitDeclarationOnly','--target','ES2022','--module','ESNext','--moduleResolution','bundler','--resolveJsonModule','--esModuleInterop','--skipLibCheck','--strict','--outDir',dir+'/types','src/sysex-map/index.ts'],{stdio:'inherit'})
if(tsc.status!==0)process.exit(tsc.status??1)
copyFileSync('src/sysex-map/schema.json',dir+'/schema.json')
copyFileSync('docs/formats/sysex-map-v1/SPECIFICATION.md',dir+'/SPECIFICATION.md')
writeFileSync(dir+'/package.json',JSON.stringify({name:'sysex-map-reference',version:'1.0.0-draft.1',private:true,type:'module',exports:{'.':{types:'./types/index.d.ts',import:'./index.mjs'},'./schema.json':'./schema.json'}},null,2)+'\n')
const {parseMap,renderParameter}=await import('../'+dir+'/index.mjs')
const example={format:'SysEx Map',version:'1.0',id:'smoke',name:'SDK smoke',sources:{},devices:[{id:'example',manufacturer:'Example',name:'Offline',notes:'No hardware',documentation:{sources:[],section:'Synthetic'},parameters:[{id:'value',name:'Value',value:{minimum:0,maximum:127},fields:{},messages:[{bytes:[240,125,{value:{shift:0,bits:7,add:0}},247]}],effect:'edit-buffer',evidence:'unverified'}]}]}
const document=parseMap(JSON.stringify(example));if(JSON.stringify(renderParameter(document.devices[0].parameters[0],64))!=='[[240,125,64,247]]')throw Error('SDK smoke failed')
const consumer='output/sysex-map-consumer';mkdirSync(consumer+'/node_modules',{recursive:true})
if(!existsSync(consumer+'/node_modules/sysex-map-reference'))symlinkSync(resolve(dir),consumer+'/node_modules/sysex-map-reference','dir')
writeFileSync(consumer+'/package.json','{"type":"module"}\n')
writeFileSync(consumer+'/tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,types:[]},files:['example.ts']}))
writeFileSync(consumer+'/example.ts',`import {parseMap,renderParameter,type SxmParameter} from 'sysex-map-reference'\nconst doc=parseMap(${JSON.stringify(JSON.stringify(example))});const p:SxmParameter=doc.devices[0].parameters[0];const frames:number[][]=renderParameter(p,64);void frames\n`)
const checked=spawnSync(process.execPath,[createRequire(import.meta.url).resolve('typescript/bin/tsc'),'--project',consumer],{stdio:'inherit'});if(checked.status!==0)process.exit(checked.status??1)
console.log('PASS standalone SXM reference artifact: '+dir+' (ES module, NodeNext consumer declarations, schema, specification; zero runtime dependencies, no publication)')
