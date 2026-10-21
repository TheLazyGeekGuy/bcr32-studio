// End-to-end check of the offline service worker across a redeployment.
// Serves build A, lets its service worker pin it, then serves ONLY build B (as GitHub Pages does after a push)
// and checks that: the pinned build keeps working (its lazy chunks were precached), an "Update and reload"
// action appears, and that action moves the page to build B. No MIDI, no network outside 127.0.0.1.
// Usage: PLAYWRIGHT_CORE=<playwright-core path> node scripts/e2e-offline-update.cjs <dist-a> <dist-b>
// (build B must differ from A in a lazy chunk, e.g. one changed string in src/library/LibraryPanel.tsx).
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const [distA,distB]=process.argv.slice(2).map(p=>path.resolve(p))
if(!distA||!distB)throw Error('usage: e2e-offline-update.cjs <dist-a> <dist-b>')
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain','.png':'image/png','.webp':'image/webp'}
let served=distA
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://x'),rel=decodeURIComponent(url.pathname).replace(/^\/bcr32-studio\//,'')
 const file=path.join(served,rel===''?'index.html':rel)
 if(!file.startsWith(served)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return}
 res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream','cache-control':'no-cache'});fs.createReadStream(file).pipe(res)
})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const fail=m=>{throw Error('FAIL '+m)}
;(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 // *.localhost is a secure context (service workers allowed) and is not excluded by startOffline's local-preview rule.
 const base=`http://studio.localhost:${server.address().port}/bcr32-studio/`
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'offline-e2e-'))
 const ctx=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1300,height:900},locale:'fr-FR'})
 try{
  await ctx.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{value:undefined,configurable:true})})
  const entry=async pg=>pg.evaluate(()=>[...document.scripts].map(s=>s.src.split('/').pop()).find(n=>/^index-/.test(n)))
  const waiting=async pg=>pg.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)
  const broken=async pg=>(await pg.innerText('body')).includes('Éditeur indisponible')
  const indexOf=dir=>fs.readdirSync(path.join(dir,'assets')).find(n=>/^index-.*\.js$/.test(n))
  let pg=await ctx.newPage()
  await pg.goto(base,{waitUntil:'networkidle'});await sleep(6000);await pg.reload({waitUntil:'networkidle'});await sleep(3000)
  if(await entry(pg)!==indexOf(distA))fail('build A not loaded')
  if(!await pg.evaluate(()=>!!navigator.serviceWorker.controller))fail('service worker does not control build A')
  served=distB // redeployment: build A's files are gone from the server
  await pg.reload({waitUntil:'networkidle'});await sleep(3000)
  if(await entry(pg)!==indexOf(distA))fail('build A should stay pinned until the user updates')
  if(!await waiting(pg))fail('build B should be installed and waiting')
  await pg.getByRole('button',{name:/Bibliothèque d’instruments/}).first().click();await sleep(2500)
  if(await broken(pg))fail('pinned build A broke when loading a lazy chunk (stale pinned build)')
  await pg.keyboard.press('Escape');await sleep(500) // close the library dialog
  const update=pg.getByRole('button',{name:'Mettre à jour et recharger'})
  if(!await update.count())fail('no update action while build B is waiting')
  const logs=[];pg.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,200)))
  const before=await pg.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {waiting:r?.waiting?.state,active:r?.active?.state,controller:navigator.serviceWorker.controller?.state}})
  await update.first().click();await sleep(6000)
  const after=await pg.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {waiting:r?.waiting?.state??null,active:r?.active?.state,controller:navigator.serviceWorker.controller?.state}})
  if(await entry(pg)!==indexOf(distB))fail(`update action did not move the page to build B: before ${JSON.stringify(before)} after ${JSON.stringify(after)} logs ${JSON.stringify(logs.slice(0,8))}`)
  if(await entry(pg)!==indexOf(distB))fail('update action did not move the page to build B')
  if(await broken(pg))fail('build B shows Editor unavailable')
  console.log(`PASS offline update e2e: build A pinned across redeployment with all lazy code precached; "Mettre à jour et recharger" moved the page to build B (${indexOf(distA)} -> ${indexOf(distB)})`)
 }finally{await ctx.close();server.close();fs.rmSync(profile,{recursive:true,force:true})}
})().catch(e=>{console.error(String(e));process.exit(1)})
