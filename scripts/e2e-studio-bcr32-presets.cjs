// Fake Web MIDI only: this browser never opens the owner's hardware ports.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const assert=require('node:assert/strict')
function fakeMidi(){
 window.__bcrStorage=key=>localStorage.getItem(`bcr-studio.instance.${document.querySelector('[data-bcr32-instance]')?.dataset.bcr32Instance}.${key}`)
 localStorage.setItem('bcr32-studio.language.v1','en');localStorage.setItem('bcr32-studio.controller-autoread','false')
 const input={id:'preset-in',name:'BCR-32 SIM',state:'connected',type:'input',onmidimessage:null},prefix=[240,0,32,50,0,100]
 const reply=b=>setTimeout(()=>input.onmidimessage?.({data:new Uint8Array(b)}),1)
 window.__sent=[];let ctrl=false
 const baseline=['$rev BCR32','$preset',"  .name 'Hardware 1'",'  .init','$button 49','  .easypar CC 1 109 127 0 toggleon','$button 50','  .easypar CC 1 110 127 0 toggleon','$end']
 let working=[...baseline], incoming=[];const bank=new Map()

 const output={id:'preset-out',name:'BCR-32 SIM',state:'connected',type:'output',send(b){window.__sent.push([...b]);const cmd=b[6]
  if(cmd===0)return reply([...prefix,0,1,0,0,1,0,2,247])
  if(cmd===12){ctrl=true;return}
  if(cmd===66&&ctrl){for(let i=0;i<64;i++)reply([...prefix,33,0,i,...Array.from(`Hardware ${i+1}`.padEnd(24),c=>c.charCodeAt(0)),247]);return}
  if(cmd===32&&b[4]===0&&ctrl){const index=b[7]*128+b[8];if(index===0)incoming=[];if(index!==incoming.length)throw Error('Bad simulated line order');const line=String.fromCharCode(...b.slice(9,-1));incoming.push(line);if(line==='$end'){working=incoming.filter(l=>!l.startsWith('$store '));const store=incoming.find(l=>l.startsWith('$store '));if(store)bank.set(Number(store.slice(7))-1,[...working])}reply([...prefix,33,b[7],b[8],0,247]);return}
  if((cmd===64||cmd===65)&&ctrl){const lines=cmd===65?['$rev BCR32','$global','  .startup ctrl','$end']:b[7]===127?working:b[7]===126?[...baseline.slice(0,-1),'$store 1','$end']:bank.get(b[7])||baseline;lines.forEach((line,i)=>reply([...prefix,32,i>>7,i&127,...Array.from(line,c=>c.charCodeAt(0)),247]));return}
  if(b.length===8)reply([...prefix,cmd,0,247])
 }}
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>({sysexEnabled:true,inputs:new Map([[input.id,input]]),outputs:new Map([[output.id,output]]),onstatechange:null})})
}
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(fakeMidi);await page.goto(process.argv[2]||'http://127.0.0.1:5183/?editor=bcr32-editor&native=0')
 await page.locator('.firmware-identity').getByText('1.0.2',{exact:true}).waitFor();await page.getByRole('button',{name:'Presets',exact:true}).click()
 const panel=page.locator('.controller-presets');await page.waitForFunction(()=>document.querySelector('.preset-source-label select')?.lastElementChild?.textContent.includes('64 · Hardware 64'))
 assert.ok((await panel.getByLabel('Preset to read',{exact:true}).textContent()).includes('64 · Hardware 64'))
 await panel.getByRole('button',{name:'Read',exact:true}).click();await panel.getByRole('button',{name:'Read complete preset',exact:false}).click();await page.waitForFunction(()=>document.querySelector('.controller-presets pre')?.textContent.includes('$button 50'))
 assert.ok((await panel.locator('pre').textContent()).includes('$button 50'))
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Export',exact:true}).click();await panel.getByRole('button',{name:'Save BCL text',exact:true}).click();assert.equal((await download).suggestedFilename(),'bcr32-working.bcl')
 await panel.getByLabel('Preset to read',{exact:true}).selectOption('63');await panel.getByRole('button',{name:'Read',exact:true}).click();await panel.getByRole('button',{name:'Read complete preset',exact:false}).click();await page.waitForFunction(()=>window.__sent.some(b=>b[6]===64&&b[7]===63))
 await panel.getByRole('button',{name:'Read',exact:true}).click();await panel.getByRole('button',{name:'Read full controller bank',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.controller-presets pre')?.textContent.includes('$store 1'))
 await panel.getByRole('button',{name:'Read',exact:true}).click();await panel.getByRole('button',{name:'Read global backup',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.controller-presets pre')?.textContent.includes('$global'))
 assert.equal(await panel.getByLabel('Hardware save destination',{exact:true}).count(),0,'destination is absent until Save is opened')
 const sent=await page.evaluate(()=>window.__sent);assert.ok(sent.some(b=>b[6]===12));assert.ok(!sent.some(b=>[4,32,34,67,114,119].includes(b[6])));assert.deepEqual(errors,[])
 await panel.getByLabel('Preset to read',{exact:true}).selectOption('working')
 await panel.getByRole('button',{name:'Save',exact:true}).click()
 await panel.getByLabel('Hardware save destination',{exact:true}).selectOption('62')
 await panel.getByLabel('Destination preset name',{exact:true}).fill('Browser test')
 assert.ok(await panel.getByRole('button',{name:'Save complete preset to BCR32',exact:true}).isEnabled())
 await panel.getByRole('button',{name:'Save complete preset to BCR32',exact:true}).click()
 await panel.getByRole('status').filter({hasText:'Preset stored and read back. Working contents restored.'}).waitFor({timeout:10000})
 assert.ok(await page.evaluate(()=>!!window.__bcrStorage('bcr32-studio.before-hardware-store.v1')))
 const writes=await page.evaluate(()=>window.__sent.filter(b=>b[6]===32));assert.ok(writes.length>0);assert.ok(writes.every(b=>b[4]===0));assert.equal(writes.filter(b=>String.fromCharCode(...b.slice(9,-1)).startsWith('$store')).length,1)
 assert.deepEqual(errors,[])
 // Source switching and opening/closing forms must not send hardware writes.
 const beforeSources=await page.evaluate(()=>window.__sent.filter(b=>b[6]===32).length)
 await page.getByRole('button',{name:'On this computer',exact:true}).click()
 await page.locator('.browser-presets').getByRole('button',{name:'Save',exact:true}).click()
 await page.locator('.browser-presets').getByRole('button',{name:'Back to presets',exact:true}).click()
 await page.getByRole('button',{name:'BCR32',exact:true}).click()
 await panel.getByRole('button',{name:'Save',exact:true}).click()
 await panel.getByRole('button',{name:'Cancel',exact:true}).click()
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===32).length),beforeSources)
 await panel.getByRole('button',{name:'Read',exact:true}).click()
 await panel.getByRole('button',{name:'Read',exact:true}).press('Escape')
 assert.equal(await panel.getByRole('button',{name:'Read',exact:true}).getAttribute('aria-expanded'),'false')
 assert.deepEqual(errors,[])
 console.log('PASS: browser — CTRL entry, 64 hardware names, working/slot/bank/global reads, complete backup download, separate local library and backed-up preset save/read-back/working restoration')
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
