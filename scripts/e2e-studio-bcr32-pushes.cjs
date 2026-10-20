// Browser regression with a simulated controller; never accesses real MIDI ports.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const assert = require('node:assert/strict')
function fakeMidi({ autoRead = true, silent = false, route = 'ua', midiIn = false, pushFixtures = {} } = {}) {
  window.__bcrStorage=key=>localStorage.getItem(`bcr-studio.instance.${document.querySelector('[data-bcr32-instance]')?.dataset.bcr32Instance}.${key}`)
  localStorage.setItem('bcr32-studio.language.v1', 'en')
  if (!autoRead) localStorage.setItem('bcr32-studio.controller-autoread', 'false')
  const input = { id: 'sim-in', name: 'BCR-32 SIM', state: 'connected', type: 'input', onmidimessage: null }
  const prefix = [240, 0, 32, 50, 0, 100] // Real 1.0.2 responds with configured device ID 00.
  const reply = data => setTimeout(() => input.onmidimessage?.({ data: new Uint8Array(data) }), 1)
  window.__sent = []
  window.__receive = data => input.onmidimessage?.({data:new Uint8Array(data)})
  let tracks=[63,2,3,4], selected=2,incoming=[];;
  const baseline=()=>['$rev BCR32','$preset',"  .name 'Track preset'",'  .init','$button 49','  .easypar CC 1 109 127 0 toggleon','$button 50','  .easypar CC 1 110 127 0 toggleon','$end']
  let working=baseline()
  window.__track=n=>{selected=n;working=baseline()}
  window.__tracks=()=>({tracks:[...tracks],selected})
  const assignments = new Map()
  const output = { id: 'sim-out', name: 'BCR-32 SIM', state: 'connected', type: 'output', send(bytes) {
    window.__sent.push([...bytes])
    const cmd = bytes[6], index = bytes[7]
    if (cmd === 0 && bytes.length === 8) return reply([...prefix, 0, 1, 0, 0, 1, 0, 2, 247])
    if(cmd===32&&bytes[4]===0){const i=bytes[7]*128+bytes[8];if(i===0)incoming=[];if(i!==incoming.length)throw Error('Bad line sequence');const line=String.fromCharCode(...bytes.slice(9,-1));incoming.push(line);if(line==='$end'){if(incoming.includes('$global')){const parts=incoming.find(l=>l.trim().startsWith('.tracks ')).trim().split(' ').slice(1).map(Number);tracks=parts.slice(0,4);selected=parts[4];working=baseline()}else working=[...incoming]}return reply([...prefix,33,bytes[7],bytes[8],0,247])}
    if(cmd===64){const lines=working;lines.forEach((line,i)=>reply([...prefix,32,i>>7,i&127,...Array.from(line,c=>c.charCodeAt(0)),247]));return}
    if(cmd===66){for(let i=0;i<64;i++)reply([...prefix,33,0,i,...Array.from(`Preset ${i+1}`.padEnd(24),c=>c.charCodeAt(0)),247]);return}
    if(cmd===65&&bytes.length===8) { const lines=['$rev BCR32','$global','  .opmode usb','  .footsw1 ctrl','  .footsw2 ctrl',`  .ctrlout ${route}`,`  .tracks ${tracks.join(' ')} ${selected}`,'$end'];lines.forEach((line,i)=>reply([...prefix,32,0,i,...Array.from(line,c=>c.charCodeAt(0)),247]));return }

    if(cmd>=49&&cmd<=56&&[10,12].includes(bytes.length)) {
      const raw=bytes.length===12?((bytes[9]|(bytes[8]&1)<<7)<<8)|(bytes[10]|(bytes[8]&2)<<6):bytes[8]
      assignments.set(`${index}:${cmd}`,raw);return reply([...bytes])
    }
    if (cmd >= 49 && cmd <= 56 && bytes.length === 9) {
      if (silent) return
      const captured = pushFixtures[selected]?.find(t=>t.index===index)
      const raw = captured ? captured.fields[cmd] : assignments.get(`${index}:${cmd}`) ?? {49:2, 50:selected-1, 51:index<16?65+index:index<48?33+index-16:index<50?109+index-48:71, 52:index>=50?0:127, 53:index>=50?127:0, 54:0, 55:index>=50?5:1, 56:1}[cmd]
      if(raw===null) return reply([...prefix,cmd,index,247])
      const wide = [51,52,53].includes(cmd) || cmd === 55 && index < 50
      return reply([...prefix, cmd, index, ...(wide ? [(raw>>15&1)|(raw>>6&2), raw>>8&127, raw&127] : [raw]), 247])
    }
    if (bytes.length === 8) reply([...prefix, cmd, cmd===30&&midiIn?1:0, 247])
  } }
  const zaqInput = { id:'zaq-in',name:'BCR-32 ZAQ',state:'connected',type:'input',onmidimessage:null }
  const zaqOutput = { id:'zaq-out',name:'BCR-32 ZAQ',state:'connected',type:'output',send() { throw Error('Sequencer port must not be used') } }
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable:true, value:async () => ({ sysexEnabled:true, inputs:new Map([[zaqInput.id,zaqInput],[input.id,input]]), outputs:new Map([[zaqOutput.id,zaqOutput],[output.id,output]]), onstatechange:null }) })
}
;(async()=>{const browser=await chromium.launch({headless:true});try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(fakeMidi,{pushFixtures:Object.fromEntries(require('./fixtures/controller-pushes-102.json').presets.map(p=>[p.track,Array.from({length:32},(_,i)=>({index:i+16,fields:Object.fromEntries(p.replies.filter(b=>b[7]===i+16).map(b=>[b[6],b.length===9?null:b.length===12?((b[9]|(b[8]&1)<<7)<<8)|(b[10]|(b[8]&2)<<6):b[8]]))}))]))})
 await page.goto(process.argv[2]||'http://127.0.0.1:5183/?editor=bcr32-editor&native=0')
 const complete=()=>page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Controller read complete'),{},{timeout:30000})
 await complete();console.log('read complete',await page.evaluate(()=>window.__tracks()))
 for(let id=1;id<=8;id++){
   await page.getByRole('button',{name:`Encoder ${id} push`,exact:true}).click()
   assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'pc')
   assert.equal(await page.getByRole('combobox',{name:'Mode',exact:true}).inputValue(),'momentary')
   assert.equal(await page.getByRole('spinbutton',{name:'Channel',exact:true}).inputValue(),'11')
   assert.equal(await page.getByRole('spinbutton',{name:'Value 1',exact:true}).inputValue(),String(16+id))
   assert.equal(await page.getByRole('checkbox',{name:'Bank Off',exact:true}).isChecked(),true)
 }
 await page.evaluate(()=>window.__track(1))
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Reading controller'))
 await complete();console.log('read complete',await page.evaluate(()=>window.__tracks()))
 await page.getByRole('button',{name:'Encoder 1 push',exact:true}).click()
 assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'cc')
 assert.equal(await page.getByRole('combobox',{name:'Mode',exact:true}).inputValue(),'toggle')
 assert.equal(await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).inputValue(),'33')
 await page.evaluate(()=>window.__track(3))
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Reading controller'))
 await complete();console.log('read complete',await page.evaluate(()=>window.__tracks()))
 await page.getByRole('button',{name:'Encoder 1 push',exact:true}).click()
 assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'note')
 assert.equal(await page.getByRole('spinbutton',{name:'Note number',exact:true}).inputValue(),'52')
 assert.equal(await page.getByRole('spinbutton',{name:'Value 1',exact:true}).inputValue(),'100')
 await page.evaluate(()=>window.__track(2))
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Preset restored from UI cache'))
 await page.getByRole('button',{name:'Encoder 9 push',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Controller assignment cannot be represented'}).waitFor()
 await page.evaluate(()=>window.__track(4))
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Reading controller'))
 await complete();console.log('read complete',await page.evaluate(()=>window.__tracks()))
 for(let id=1;id<=2;id++){
   await page.getByRole('button',{name:`Encoder ${id} push`,exact:true}).click()
   assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'cc')
   assert.equal(await page.getByRole('combobox',{name:'Mode',exact:true}).inputValue(),'inc_dec')
   assert.equal(await page.getByRole('spinbutton',{name:'CC / Parameter',exact:true}).inputValue(),id===1?'68':'43')
 }
 await page.getByRole('button',{name:'Encoder 3 push',exact:true}).click()
 assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'off')
 const before=await page.evaluate(()=>window.__sent.filter(b=>b.length===9&&b[6]>=49&&b[6]<=56).length)
 await page.evaluate(()=>window.__track(2))
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Preset restored from UI cache'))
 await page.getByRole('button',{name:'Encoder 1 push',exact:true}).click()
 assert.equal(await page.getByRole('combobox',{name:'Type',exact:true}).inputValue(),'pc')
 assert.equal(await page.getByRole('spinbutton',{name:'Value 1',exact:true}).inputValue(),'17')
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b.length===9&&b[6]>=49&&b[6]<=56).length),before)
 assert.deepEqual(errors,[])
 assert.ok(!await page.evaluate(()=>window.__sent.some(b=>b.length===3||[34,114,119].includes(b[6]))))
 console.log('PASS: four captured presets, T1 CC, T3 notes, T2 PC pushes 1–8, bank Off and Toggle Off; unsupported warning; T4 CC/increment/OFF; warm T2 PC cache; no value/setter/STORE/reset')
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
