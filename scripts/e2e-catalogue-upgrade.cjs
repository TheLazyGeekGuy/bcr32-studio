// Owned browser only, fake MIDI and a previous built-in catalogue supplied at the storage boundary.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core'),{fakeMidi}=require('./e2e-zaq-host.cjs'),assert=require('node:assert/strict'),fs=require('node:fs')
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const previous=JSON.parse(fs.readFileSync('src/sysex-catalog/expanded.sxm.json','utf8'))
 previous.devices=previous.devices.filter(d=>d.id!=='a3000v2');delete previous.sources.a3000;delete previous.sources.a3000v2
 const saved=JSON.stringify(previous),page=await browser.newPage()
 await page.addInitScript(fakeMidi,{sync:true})
 await page.addInitScript(saved=>{const original=Storage.prototype.getItem;window.__catalogueReads=0;Storage.prototype.getItem=function(key){if(String(key).endsWith('sysex-map.catalog.v1')){window.__catalogueReads++;return saved}return original.call(this,key)}},saved)
 await page.goto((process.argv[2]??'http://127.0.0.1:5193')+'/editor/?native=0')
 await page.getByRole('combobox',{name:'MIDI message type',exact:true}).selectOption('bcl')
 await page.getByRole('button',{name:'Synth SysEx catalogue',exact:true}).click()
 const picker=page.getByRole('region',{name:'Synth SysEx catalogue',exact:true}),synth=picker.getByRole('combobox',{name:'Synth',exact:true})
 await picker.waitFor();assert.equal(await synth.locator('option').count(),23)
 assert.ok(await page.evaluate(()=>window.__catalogueReads>0),'the saved-catalogue path was exercised')
 await synth.selectOption('a3000v2');assert.equal(await picker.getByRole('listbox',{name:'SysEx parameter',exact:true}).locator('option').count(),103)
 const writes=await page.evaluate(()=>window.__sent.filter(b=>b[0]!==240||b[1]!==0||b[2]!==32||b[3]!==50||b[6]===32||b[6]===114||b[6]===119||b[6]>=49&&b[6]<=56&&b.length>8));assert.deepEqual(writes,[])
 console.log('PASS browser saved catalogue: prior22-model built-in inventory exposes A3000 V2 /103 parameters automatically; fake MIDI only, zero writes.')
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
