// Real browser, simulated ports. No physical MIDI enumeration or persistent STORE.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const {fakeMidi}=require('./e2e-zaq-host.cjs'),assert=require('node:assert/strict')
function device(){
 const request=navigator.requestMIDIAccess.bind(navigator),prefix=[240,0,32,50,0,100]
 window.__bodies={'$encoder 8':'.easypar CC 1 23 0 127 absolute\n.showvalue on\n.mode bar\n.default 0','$encoder 9':'.easypar CC 1 71 0 127 absolute\n.showvalue on\n.mode 1dot\n.default 0','$encoder 25':'.easypar CC 1 7 0 127 absolute\n.showvalue on\n.mode 1dot/off\n.default 63','$button 8':'.easypar CC 1 64 127 0 toggleoff\n.showvalue on\n.mode down','$button 24':'.easypar CC 1 55 127 0 toggleoff\n.showvalue on\n.mode down','$encoder 32':'.easypar CC 1 23 0 127 absolute\n.showvalue on\n.mode bar', '$button 48':'.easypar CC 1 55 127 0 toggleoff\n.showvalue on'}
 window.__types={81:2,47:2,57:2,58:2,74:2,7:2,23:2};window.__programs=[];window.__working=()=>['$rev BCR32','$preset',".name 'Live fixture'",...Object.entries(window.__bodies).flatMap(([selector,body])=>[selector,...body.split('\n')]),'$end'].join('\n')
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{
  const access=await request(),out=access.outputs.get('bcr-out'),send=out.send.bind(out)
  if(out.__live)return access;out.__live=true
  out.send=bytes=>{const b=Array.from(bytes),cmd=b[6],index=b[7]
   if(cmd===64&&b.length===9){window.__sent.push(b);window.__working().split('\n').forEach((l,i)=>window.__emit([...prefix,32,i>>7,i&127,...Array.from(l,c=>c.charCodeAt(0)),247]));return}
   if(cmd===66&&b[7]===126){window.__sent.push(b);for(let n=0;n<64;n++)window.__emit([...prefix,33,0,n,...Array.from(('Preset '+(n+1)).padEnd(24),c=>c.charCodeAt(0)),247]);return}
   if(cmd>=49&&cmd<=56&&b.length===9){window.__sent.push(b)
    const raw={49:window.__types[index]??2,50:0,51:({81:23,57:23,58:71,74:7}[index]??55),52:index>=50?0:127,53:index>=50?127:0,54:0,55:index>=50?5:1,56:1}[cmd],wide=[51,52,53].includes(cmd)||cmd===55&&index<50
    window.__emit([...prefix,cmd,index,...(wide?[(raw>>15&1)|(raw>>6&2),raw>>8&127,raw&127]:[raw]),247]);return
   }
   if(cmd===49&&b.length===10){window.__sent.push(b);window.__types[index]=b[8];if(b[8]===0){const key=index>=50?'$encoder '+(index-49):'$button '+(index+1);if(window.__bodies[key])window.__bodies[key]=window.__bodies[key].replace(/^\s*\.easypar[^\n]*(?:\n|$)/m,'')}return}
   if(cmd===32){window.__sent.push(b);const l=String.fromCharCode(...b.slice(9,-1));if(b[7]===0&&b[8]===0)window.__bcl=[];window.__bcl.push(l)
    if(l==='$end'){const selector=window.__bcl[1];window.__bodies[selector]=window.__bcl.slice(2,-1).join('\n');window.__programs.push([...window.__bcl]);const kind=selector.startsWith('$encoder ')?'encoder':'button',id=Number(selector.split(' ')[1]),index=kind==='encoder'?id+49:id-1,type=/\.easypar (\S+)/.exec(window.__bodies[selector])?.[1];window.__types[index]=({OFF:0,PC:1,CC:2,NRPN:3,NOTE:4,PB:4,AT:5,'GS/XG':6,MMC:7})[type]??0}
    window.__emit([...prefix,33,b[7],b[8],0,247]);return
   }
   send(b)
  };return access
 }})
}
module.exports={device}
if(require.main===module)(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(fakeMidi,{sync:true});await page.addInitScript(device)
 await page.goto((process.argv[2]??'http://127.0.0.1:5193')+'/editor/?native=0')
 const search=page.getByRole('combobox',{name:'Control search',exact:true}),type=page.getByRole('combobox',{name:'MIDI message type',exact:true})
 const select=async name=>{await search.fill(name);await page.getByRole('listbox',{name:'Control results',exact:true}).getByRole('option').first().click()}
 await page.getByRole('button',{name:'Presets',exact:true}).click();await page.getByRole('button',{name:'Read the BCR32',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.controller-read-panel')?.textContent.includes('Controller read complete'),{},{timeout:30000})
 await page.getByRole('button',{name:'Control',exact:true}).click()
 await select('Encoder 32');await type.selectOption('sysex')
 const text=page.getByRole('textbox',{name:'SysEx template',exact:true}),status=page.getByRole('status',{name:'Custom program synchronization',exact:true})
 await status.filter({hasText:'independently read back'}).waitFor();assert.equal(await page.evaluate(()=>window.__programs.length),1,'explicit SysEx Type selection applies the valid program in live mode')
 await text.fill('F0 7D 01 {val} F7')
 await status.filter({hasText:'independently read back'}).waitFor()
 assert.match(await page.evaluate(()=>window.__bodies['$encoder 32']),/\.tx \$F0 \$7D \$01 val \$F7/)
 assert.equal(await page.evaluate(()=>window.__types[81]),0,'rotation32 native type is disabled before custom program')
 assert.equal(await page.evaluate(()=>window.__programs.length),2,'Type selection then one live edit, two serialized transfers')
 await text.fill('F0 7D 80 F7');await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>window.__programs.length),2,'invalid hex never uploads')
 await text.fill('F0 7D 02 {val} F7');await text.fill('F0 7D 03 {val} F7')
 await status.filter({hasText:'independently read back'}).waitFor()
 await page.waitForFunction(()=>window.__programs.length===3)
 assert.match(await page.evaluate(()=>window.__bodies['$encoder 32']),/\$03 val/,'rapid edits coalesce to the latest valid program')
 // Hardware has been reprogrammed outside the editor: a full reread must replace the local custom draft.
 await page.evaluate(()=>{window.__types[81]=2;window.__bodies['$encoder 32']='.easypar CC 1 23 0 127 absolute\n.showvalue on\n.mode bar'})
 await page.getByRole('button',{name:'Presets',exact:true}).click()
 await page.getByRole('button',{name:'Read the BCR32',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.controller-read-panel')?.textContent.includes('Controller read complete'),{},{timeout:30000})
 await page.getByRole('button',{name:'Control',exact:true}).click()
 await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).waitFor()
 assert.equal(await type.inputValue(),'cc');assert.equal(await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).inputValue(),'23')
 assert.equal(await page.evaluate(()=>window.__programs.length),3,'rereading hardware never uploads the retained local draft')
 await select('Push 32');await type.selectOption('sysex');await text.fill('F0 7D 04 {val} F7')
 await status.filter({hasText:'independently read back'}).waitFor()
 assert.match(await page.evaluate(()=>window.__bodies['$button 48']),/\$04 val/,'push32 uses native button48')
 assert.equal(await page.evaluate(()=>window.__types[47]),0)
 await page.getByRole('button',{name:'Assignments → BCR32',exact:true}).click()
 const n=await page.evaluate(()=>window.__programs.length);await text.fill('F0 7D 05 {val} F7');await status.filter({hasText:'Assignments → BCR32 is off'}).waitFor()
 assert.equal(await page.evaluate(()=>window.__programs.length),n,'global assignment switch keeps custom edits local too')
 await text.fill('F0 7D 80 F7')
 await page.getByRole('button',{name:'Presets',exact:true}).click()
 await page.getByRole('button',{name:'Save to…',exact:true}).click()
 await page.getByRole('combobox',{name:'Hardware save destination',exact:true}).selectOption('12')
 await page.getByRole('textbox',{name:'Destination preset name',exact:true}).fill('Fixture')
 await page.getByRole('button',{name:'Save complete preset to BCR32',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Invalid custom draft; STORE stopped before writing'}).waitFor()
 assert.equal(await page.evaluate(()=>window.__programs.length),n,'STORE never writes when the visible draft is invalid, even before local apply')
 await page.getByRole('button',{name:'Back to presets',exact:true}).click()
 await page.getByRole('button',{name:'Control',exact:true}).click()
 await text.fill('F0 7D 05 {val} F7');await status.filter({hasText:'Assignments → BCR32 is off'}).waitFor()

 await page.getByRole('button',{name:'Assignments → BCR32',exact:true}).click();await page.waitForTimeout(900)
 assert.equal(await page.evaluate(()=>window.__programs.length),n,'reenabling never replays old edits')
 await page.reload();await page.waitForTimeout(1500)
 assert.equal(await page.evaluate(()=>window.__programs.length),0,'reloading retained custom drafts never uploads')
 assert.deepEqual(errors,[])
 console.log('PASS live custom browser: rotation32 and push32 auto backup/OFF/upload/readback, debounce, invalid refusal, no replay, live switch, stale custom→CC23 reread; simulated MIDI only')
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
