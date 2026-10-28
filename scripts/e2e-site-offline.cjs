// Static production build under a project subpath, with real offline navigation. No MIDI or external traffic.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(process.argv[2]||'dist'),prefix='/bcr32-studio/'
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.webp':'image/webp'}
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end()}
 const rel=decodeURIComponent(url.pathname.slice(prefix.length)),target=path.resolve(root,rel.endsWith('/')||!rel?rel+'index.html':rel)
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404);return res.end()}
 res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(target).pipe(res)
})
;(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://studio.localhost:${server.address().port}${prefix}`
 const browser=await chromium.launch({headless:true});try{const context=await browser.newContext(),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(String(e)));await context.route('**/*',route=>new URL(route.request().url()).hostname==='studio.localhost'?route.continue():route.abort())
 await page.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:undefined});localStorage.setItem('bcr32-studio.language.v1','en')})
 await page.goto(base+'editor/?midi=manual');await page.getByRole('button',{name:'Sequencer',exact:true}).waitFor()
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:20000})
 const scope=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).scope);assert.equal(scope,base)
 await page.goto(base);await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.locator('#root').count(),0)
 // The worker sees the presentation assets on this online visit before the offline test.
 await context.setOffline(true)
 await page.goto(base+'editor/?midi=manual');await page.getByRole('button',{name:'Sequencer',exact:true}).click();await page.getByRole('region',{name:'Sequencer',exact:true}).waitFor()
 assert.equal(await page.locator('h1').count(),0,'editor is not replaced with landing HTML')
 await page.goto(base);await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.locator('#root').count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS production subpath + offline: root presentation, /editor/ application, shared root SW scope, no landing/editor document mix-up, no browser errors or hardware access')
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1})
