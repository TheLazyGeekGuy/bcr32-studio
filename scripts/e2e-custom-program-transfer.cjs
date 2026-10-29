// Real headless browser, fake MIDI endpoints only; no physical MIDI enumeration.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const {fakeMidi}=require('./e2e-zaq-host.cjs'),assert=require('node:assert/strict')
function customDevice(){
 const request=navigator.requestMIDIAccess.bind(navigator),prefix=[240,0,32,50,0,100]
 window.__nativeBody='.easypar CC 1 16 0 127 absolute\n.showvalue on\n.mode 12dot\n.default 0'
 window.__nativeType=2;window.__bcl=[];window.__failBcl=false;window.__nativePreset=null;window.__slots={}
 window.__working=()=>window.__nativePreset??`$rev BCR32\n$preset\n  .name 'Fixture'\n$encoder 1\n${window.__nativeBody}\n$encoder 2\n.easypar CC 1 17 0 127 absolute\n$end`
 window.__slots[62]=window.__working().replace('Fixture','Original slot')
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{
  const access=await request(),out=access.outputs.get('bcr-out'),send=out.send.bind(out)
  if(out.__custom)return access;out.__custom=true
  out.send=bytes=>{
   const b=Array.from(bytes),cmd=b[6]
   if(cmd===64&&b.length===9){window.__sent.push(b);(b[7]===127?window.__working():window.__slots[b[7]]??window.__working()).split('\n').forEach((l,i)=>window.__emit([...prefix,32,i>>7,i&127,...Array.from(l,c=>c.charCodeAt(0)),247]));return}
   if(cmd===66&&b[7]===126){window.__sent.push(b);for(let n=0;n<64;n++)window.__emit([...prefix,33,0,n,...Array.from(('Preset '+(n+1)).padEnd(24),c=>c.charCodeAt(0)),247]);return}
   if(cmd===49&&b[7]===50){window.__sent.push(b);if(b.length===10)window.__nativeType=b[8];window.__emit([...prefix,49,50,window.__nativeType,247]);return}
   if(cmd===32){window.__sent.push(b);const line=String.fromCharCode(...b.slice(9,-1));if(b[7]===0&&b[8]===0)window.__bcl=[];window.__bcl.push(line)
    if(line==='$end'&&!window.__failBcl){
     if(window.__bcl[1]==='$preset'){const store=window.__bcl.find(l=>l.startsWith('$store '));window.__nativePreset=window.__bcl.filter(l=>!l.startsWith('$store ')).join('\n');if(store)window.__slots[Number(store.split(' ')[1])-1]=window.__nativePreset;const lines=window.__nativePreset.split('\n'),start=lines.indexOf('$encoder 1'),end=lines.indexOf('$encoder 2');window.__nativeBody=lines.slice(start+1,end).join('\n')}
     else{window.__nativePreset=null;window.__nativeBody=window.__bcl.slice(2,-1).join('\n');if(window.__nativeBody.includes('.tx ')&&!window.__nativeBody.includes('.mode '))window.__nativeBody+='\n.mode 1dot'}
     window.__nativeType=window.__nativeBody.includes('.easypar CC')?2:0
    }
    window.__emit([...prefix,33,b[7],b[8],window.__failBcl?7:0,247]);return
   }
   send(b)
  };return access
 }})
}
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(fakeMidi,{sync:true});await page.addInitScript(customDevice)
 await page.goto((process.argv[2]??'http://127.0.0.1:5193')+'/editor/?native=0')
 const pane=page.locator('.custom-program'),type=page.getByRole('combobox',{name:'MIDI message type',exact:true});await type.selectOption('bcl')
 const read=page.getByRole('button',{name:'Read control BCL from BCR32',exact:true});await read.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Read control BCL from BCR32'&&!b.disabled))
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===32||b[6]===49&&b.length===10).length),0,'opening never uploads or disables a control')
 await read.click();await page.getByText('Current control read from BCR32. Local draft not applied.',{exact:false}).waitFor()
 assert.match(await page.getByRole('textbox',{name:'Custom BCL control body'}).inputValue(),/easypar CC 1 16/)
 await page.getByRole('button',{name:'Example',exact:true}).click()
 const send=page.getByRole('button',{name:'Back up, set Type OFF and send program',exact:true});await send.click()
 await page.getByText('Custom program independently read back on BCR32. Working memory only; not STORE.',{exact:false}).waitFor()
 assert.match(await page.evaluate(()=>window.__nativeBody),/\.tx \$F0 \$7D val \$F7/)
 assert.equal(await page.locator('.standard-assignment').evaluate(n=>n.disabled),true,'successful write also applies the matching local custom definition')
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===49&&b.length===10).length),1)
 await read.click();await page.getByText('Current control read from BCR32. Local draft not applied.',{exact:false}).waitFor()
 assert.match(await page.getByRole('textbox',{name:'Custom BCL control body'}).inputValue(),/\.mode 1dot/)
 assert.equal(await send.isEnabled(),true,'a canonical native custom control remains editable/sendable')
 await page.getByRole('button',{name:'Presets',exact:true}).click()
 await page.getByRole('button',{name:'Save to…',exact:true}).click()
 await page.getByRole('combobox',{name:'Hardware save destination',exact:true}).selectOption('62')
 await page.getByRole('textbox',{name:'Destination preset name',exact:true}).fill('BCL STORE UI')
 await page.getByRole('button',{name:'Save complete preset to BCR32',exact:true}).click()
 await page.getByText('Preset stored and read back. Working contents restored.',{exact:false}).waitFor()
 assert.match(await page.evaluate(()=>window.__slots[62]),/\.tx \$F0 \$7D val \$F7/,'explicit1.0.3 STORE retains native custom source')
 await page.getByRole('button',{name:'Control',exact:true}).click()
 await page.getByRole('button',{name:'Restore original hardware control',exact:true}).click()
 await page.getByText('Original hardware control restored and independently read back. Local draft retained.',{exact:false}).waitFor()
 assert.match(await page.evaluate(()=>window.__nativeBody),/^\.easypar CC 1 16/)
 await page.evaluate(()=>window.__failBcl=true);await send.click()
 await page.getByText(/not acknowledged \(7\)/).waitFor()
 assert.ok(await page.getByRole('button',{name:'Save hardware backup',exact:true}).isEnabled())
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===114||b[6]===119).length),0)
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===32&&String.fromCharCode(...b.slice(9,-1)).startsWith('$store')).length),1,'only the explicit STORE action emits a persistent line')
 await page.reload();await pane.waitFor()
 assert.ok(await page.getByRole('button',{name:'Save hardware backup',exact:true}).isEnabled(),'durable backup remains downloadable after reload')
 assert.equal(await page.getByRole('button',{name:'Restore original hardware control',exact:true}).isEnabled(),false,'a retained file alone does not authorize restoration on a new connection')
 const search=page.getByRole('combobox',{name:'Control search',exact:true});await search.fill('Push 1');await page.getByRole('listbox',{name:'Control results',exact:true}).getByRole('option').first().click()
 await type.selectOption('bcl')
 const push=page.getByRole('textbox',{name:'Custom BCL control body'});assert.ok(!(await push.inputValue()).includes('.default'))
 assert.equal(await page.getByLabel('BCL default',{exact:true}).count(),0)
 await push.fill('.minmax 0 127\n.default 0\n.tx $F0 $7D val $F7');assert.equal(await send.isEnabled(),false,'unsupported push default cannot be sent')
 assert.deepEqual(errors,[])
 console.log('PASS browser custom hardware UI: read, backup/OFF/upload/readback, explicit1.0.3 preset STORE, restoration, NAK/backup retention and push-specific defaults; fake MIDI only')
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
