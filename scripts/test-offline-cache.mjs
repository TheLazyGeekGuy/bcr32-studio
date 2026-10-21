// Offline service worker: a pinned build must be complete, and only an explicit message may activate
// a waiting build. Runs the real build plugin and the real worker source in fakes; no browser, no network.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import vm from 'node:vm'

const bundled=await build({entryPoints:['build/offline.mts'],bundle:true,write:false,platform:'node',format:'esm',external:['vite'],logLevel:'error'})
const {offlineCachePlugin}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))

// A build with an entry, an app shell, a lazy chunk never imported statically, a worker, CSS and binary assets.
const dir=mkdtempSync(join(tmpdir(),'offline-cache-'))
try{
 const files={'index.html':'<html></html>','assets/index-A.js':'entry','assets/StandaloneEditorApp-A.js':'shell','assets/LibraryPanel-A.js':'lazy','assets/parse-worker-A.js':'worker','assets/index-A.css':'css','assets/picture-A.png':'png','fonts/Noto.ttf':'ttf'}
 for(const [name,body] of Object.entries(files)){mkdirSync(join(dir,name,'..'),{recursive:true});writeFileSync(join(dir,name),body)}
 mkdirSync(join(dir,'root','build'),{recursive:true});writeFileSync(join(dir,'root','build','offline-worker.js'),readFileSync('build/offline-worker.js','utf8'))
 const plugin=offlineCachePlugin()
 plugin.configResolved({root:join(dir,'root'),build:{outDir:dir}})
 plugin.generateBundle({},{
  'assets/index-A.js':{type:'chunk',fileName:'assets/index-A.js',isEntry:true,imports:[],moduleIds:['/src/main.tsx'],viteMetadata:{importedCss:new Set(['assets/index-A.css'])}},
  'assets/StandaloneEditorApp-A.js':{type:'chunk',fileName:'assets/StandaloneEditorApp-A.js',isEntry:false,imports:[],moduleIds:['/src/editor-host/StandaloneEditorApp.tsx']},
  'assets/LibraryPanel-A.js':{type:'chunk',fileName:'assets/LibraryPanel-A.js',isEntry:false,imports:[],moduleIds:['/src/library/LibraryPanel.tsx']},
  'assets/parse-worker-A.js':{type:'asset',fileName:'assets/parse-worker-A.js'},
  'assets/index-A.css':{type:'asset',fileName:'assets/index-A.css'},
  'assets/picture-A.png':{type:'asset',fileName:'assets/picture-A.png'},
 })
 plugin.writeBundle()
 const sw=readFileSync(join(dir,'sw.js'),'utf8')
 const precache=JSON.parse(/const PRECACHE = (\[.*?\])/.exec(sw)[1])
 for(const code of ['assets/LibraryPanel-A.js','assets/parse-worker-A.js','assets/StandaloneEditorApp-A.js','assets/index-A.js','assets/index-A.css','index.html'])assert.ok(precache.includes(code),`precached: ${code}`)
 for(const media of ['assets/picture-A.png','fonts/Noto.ttf'])assert.ok(!precache.includes(media),`cached on use only: ${media}`)

 // Worker: install never skips waiting; only an explicit SKIP_WAITING message does.
 const handlers={},calls={skip:0}
 const self={registration:{scope:'https://example.test/app/'},addEventListener:(type,fn)=>{handlers[type]=fn},skipWaiting:async()=>{calls.skip++},clients:{claim:async()=>{}}}
 const caches={open:async()=>({match:async()=>undefined,put:async()=>{}}),keys:async()=>[],delete:async()=>true}
 vm.runInNewContext(sw,{self,caches,URL,Request:class{},fetch:async()=>({ok:true,type:'basic'}),Set,Array,JSON,Promise,Error})
 const waitUntil=[];const event=data=>({data,waitUntil:p=>waitUntil.push(p),ports:[]})
 handlers.message(event({type:'STATUS'}));await Promise.allSettled(waitUntil);assert.equal(calls.skip,0,'status probes never activate a waiting build')
 handlers.message(event({type:'SKIP_WAITING'}));await Promise.allSettled(waitUntil);assert.equal(calls.skip,1,'explicit update activates the waiting build')
 assert.match(readFileSync('build/offline-worker.js','utf8'),/No skipWaiting: a new build must not take over/,'install keeps the session-safe policy')
 assert.ok(!/addEventListener\('install'[^]*?skipWaiting\(\)[^]*?\}\)\n/.test(sw.split("self.addEventListener('activate'")[0]),'install handler does not call skipWaiting')
}finally{rmSync(dir,{recursive:true,force:true})}
console.log('PASS offline cache: every JS/CSS file of a build is precached (lazy chunks and workers included, media cached on use); a waiting build activates only on an explicit SKIP_WAITING message')
