// Owned local composite artifact only; no real MIDI ports or public user session.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core'),assert=require('node:assert/strict')
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext(),base=process.argv[2]??'http://studio.localhost:5195/bcr32-studio/'
 await context.addInitScript(()=>{window.__midiRequests=0;Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>{window.__midiRequests++;return Promise.resolve({sysexEnabled:true,inputs:new Map(),outputs:new Map(),onstatechange:null})}})})
 const pages={},errors=[]
 for(const [environment,number] of [['production','17'],['develop','23'],['staging','45']]){
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));pages[environment]=page
  await page.goto(base+(environment==='production'?'':environment+'/')+'editor/?midi=manual&native=0')
  if(environment!=='production')await page.getByRole('complementary',{name:'Deployment environment'}).filter({hasText:environment.toUpperCase()}).waitFor()
  await page.getByRole('combobox',{name:'MIDI message type',exact:true}).or(page.getByRole('combobox',{name:'Type',exact:true})).first().selectOption('cc')
  await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).fill(number)
  await page.waitForTimeout(800)
  await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration(location.href);return !!r?.active},{},{timeout:30000})
  const scope=await page.evaluate(async()=>{const registrations=await navigator.serviceWorker.getRegistrations();console.log('registrations',registrations.map(r=>r.scope));const r=registrations.sort((a,b)=>b.scope.length-a.scope.length).find(r=>location.pathname.startsWith(new URL(r.scope).pathname));return r?new URL(r.scope).pathname:'missing'})
  console.log(environment,'scope',scope)
  assert.equal(scope,new URL(base+(environment==='production'?'':environment+'/')).pathname)
 }
 for(const [environment,number] of [['production','17'],['develop','23'],['staging','45']]){
  const page=pages[environment];await page.reload();assert.equal(await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).inputValue(),number,environment+' own draft retained')
 }
 const keys=await pages.develop.evaluate(()=>Object.keys(localStorage));assert.ok(keys.some(k=>k.startsWith('midi-studio.environment.develop.')));assert.ok(keys.some(k=>k.startsWith('midi-studio.environment.staging.')))
 await context.setOffline(true)
 for(const environment of ['production','develop','staging']){const page=pages[environment];await page.reload();await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).waitFor();if(environment!=='production')await page.getByRole('complementary',{name:'Deployment environment'}).waitFor()}
 assert.deepEqual(errors,[])
 console.log('PASS composite GitHub paths: actual alpha17 production plus current develop/staging, distinct drafts after edits/reloads, three service-worker scopes, three offline navigations, visible preview banners, empty simulated ports, no physical MIDI access')
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
