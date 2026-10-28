// Real browser, simulated Web MIDI only. Does not enumerate or send to hardware.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const assert=require('node:assert/strict')
function fakeMidi({sync=false}={}){
 localStorage.setItem('bcr32_site_lang','en');localStorage.setItem('bcr32-studio.language.v1','en');localStorage.setItem('bcr32-studio.controller-autoread','false')
 window.__requests=0;window.__sent=[];window.__note=60
 const input={id:'bcr-in',name:'BCR-32 SIM',state:'connected',type:'input',onmidimessage:null}
 const reply=b=>{const emit=()=>input.onmidimessage?.({data:new Uint8Array(b)});return sync?emit():setTimeout(emit,2)},prefix=[240,0,32,50,0,100]
 const pack=raw=>{const b=[];for(let i=0;i<raw.length;i+=7){const c=raw.slice(i,i+7);b.push(c.reduce((m,v,n)=>m|(v>>7)<<n,0),...c.map(x=>x&127))}return b}
 const output={id:'bcr-out',name:'BCR-32 SIM',state:'connected',type:'output',send(bytes){
  const b=Array.from(bytes);window.__sent.push(b);const cmd=b[6]
  if(cmd===0)return reply([...prefix,0,1,0,0,1,0,3,247])
  if(cmd===0x48&&b.length===9)return reply([...prefix,0x48,0,0,...pack([0,0,2,0,0]),247])
  if(cmd===0x45){const raw=Array.from({length:32},(_,s)=>b[9]===0?(b[8]===0&&s===0?window.__note:60):b[9]===1?100:b[9]===4?2:[5,6].includes(b[9])?-1:0).flatMap(v=>[v>>8&255,v&255]);return reply([...prefix,cmd,1,b[8],b[9],0,...pack(raw),247])}
  if(cmd===0x44){if(b[10]===0&&b[8]===0&&b[9]===0)window.__note=b[13];return reply([...prefix,cmd,2,b[8],b[9],b[10],0,...b.slice(11,14),247])}
  if(cmd===0x41&&b.length===8){['$rev BCR32','$global','  .opmode usb','  .ctrlout ua','$end'].forEach((l,i)=>reply([...prefix,32,0,i,...Array.from(l,c=>c.charCodeAt(0)),247]));return}
  if(b.length===8)return reply([...prefix,cmd,0,247])
 }}
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{window.__requests++;return {sysexEnabled:true,inputs:new Map([[input.id,input]]),outputs:new Map([[output.id,output]]),onstatechange:null}}})
}
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(fakeMidi,{sync:process.env.SYNC_REPLY==='1'})
 const base=process.argv[2]||'http://127.0.0.1:5186'
 await page.goto(base+'/');await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.evaluate(()=>window.__requests),0)
 assert.equal(await page.locator('#root').count(),0);assert.equal(await page.locator('img:not([loading="lazy"])').evaluateAll(imgs=>imgs.filter(x=>!x.complete||x.naturalWidth===0).length),0)
 console.log('Landing validated')
 await page.locator('a[href="./editor/"]').first().click();await page.waitForURL('**/editor/');console.log('Editor opened')
 // Disable the optional DEV native-inventory bridge: fake ports must never be compared to real macOS ports.
 await page.goto(base+'/editor/?native=0')
 await page.getByRole('button',{name:'Sequencer',exact:true}).click()
 await page.getByText('Current pattern read · 4 tracks / 32 steps · no STORE sent',{exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===0x45).length),36)
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===0x44).length),0,'opening never writes')
 const live=page.getByRole('checkbox',{name:'Live step editing',exact:true});assert.ok(await live.isChecked(),'live editing is automatic after a successful read')
 assert.ok(await page.evaluate(()=>window.__sent.some(b=>b.length===8&&b[6]===0x0b)),'hardware sequencer page command is sent')
 await page.locator('.seq-panel').getByRole('combobox',{name:'Note',exact:true}).selectOption('61')
 await page.getByText('Live edit confirmed · edit buffer only · press STORE on the BCR32 to keep it',{exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.__note),61)
 await page.getByRole('button',{name:'Undo',exact:true}).last().click()
 await page.waitForFunction(()=>window.__note===60)
 await live.uncheck();const before=await page.evaluate(()=>window.__sent.filter(b=>b[6]===0x44).length)
 await page.locator('.seq-panel').getByRole('combobox',{name:'Note',exact:true}).selectOption('62');await page.waitForTimeout(100)
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===0x44).length),before)
 assert.ok(await page.evaluate(()=>!window.__sent.some(b=>[4,7,0x72,0x77].includes(b[6]))),'no dumps, legacy export, STORE or firmware')
 assert.deepEqual(errors,[])
 console.log('PASS browser: root presentation → /editor/, no MIDI on root, 36 automatic reads, automatic live edit + undo, local-only disarm, no STORE, no browser errors')
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
