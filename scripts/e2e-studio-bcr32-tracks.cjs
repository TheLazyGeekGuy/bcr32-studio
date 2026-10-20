// Browser regression with a simulated controller; never accesses real MIDI ports.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const assert = require('node:assert/strict')
function fakeMidi({ autoRead = true, silent = false, route = 'ua', midiIn = false } = {}) {
  window.__bcrStorage=key=>localStorage.getItem(`bcr-studio.instance.${document.querySelector('[data-bcr32-instance]')?.dataset.bcr32Instance}.${key}`)
  localStorage.setItem('bcr32-studio.language.v1', 'en')
  if (!autoRead) localStorage.setItem('bcr32-studio.controller-autoread', 'false')
  const input = { id: 'sim-in', name: 'BCR-32 SIM', state: 'connected', type: 'input', onmidimessage: null }
  const prefix = [240, 0, 32, 50, 0, 100] // Real 1.0.2 responds with configured device ID 00.
  const reply = data => setTimeout(() => input.onmidimessage?.({ data: new Uint8Array(data) }), 1)
  window.__sent = []
  window.__receive = data => input.onmidimessage?.({data:new Uint8Array(data)})
  let tracks=[63,2,3,4], selected=1,incoming=[]
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
      const raw = assignments.get(`${index}:${cmd}`) ?? {49:2, 50:selected-1, 51:index<16?65+index:index<48?33+index-16:index<50?109+index-48:71, 52:index>=50?0:127, 53:index>=50?127:0, 54:0, 55:index>=50?5:1, 56:1}[cmd]
      const wide = [51,52,53].includes(cmd) || cmd === 55 && index < 50
      return reply([...prefix, cmd, index, ...(wide ? [(raw>>15&1)|(raw>>6&2), raw>>8&127, raw&127] : [raw]), 247])
    }
    if (bytes.length === 8) reply([...prefix, cmd, cmd===30&&midiIn?1:0, 247])
  } }
  const zaqInput = { id:'zaq-in',name:'BCR-32 ZAQ',state:'connected',type:'input',onmidimessage:null }
  const zaqOutput = { id:'zaq-out',name:'BCR-32 ZAQ',state:'connected',type:'output',send() { throw Error('Sequencer port must not be used') } }
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable:true, value:async () => ({ sysexEnabled:true, inputs:new Map([[zaqInput.id,zaqInput],[input.id,input]]), outputs:new Map([[zaqOutput.id,zaqOutput],[output.id,output]]), onstatechange:null }) })
}
;(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(fakeMidi,{});await page.goto(process.argv[2]||'http://127.0.0.1:5183/?editor=bcr32-editor&native=0')
 const complete=async()=>{try{await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Controller read complete'),{},{timeout:30000})}catch(e){console.log('DEBUG',await page.evaluate(()=>({status:document.querySelector('.controller-read-status')?.textContent,preset:document.querySelector('.controller-presets [role=status]')?.textContent,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),tracks:window.__tracks(),tail:window.__sent.slice(-8)})));throw e}}
 const selected=n=>page.locator(`.key-hit[data-track-selected=true][title^="T${n} ·"]`)
 await complete();await selected(1).waitFor();console.log('initial complete')
 assert.equal(await page.locator('.key-hit[data-lamp=green]').count(),17)
 assert.equal(await page.locator('.key-hit[data-track-selected=false][data-lamp=red]').count(),3)
 await page.evaluate(()=>window.__track(2));await selected(2).waitFor();console.log('physical2')
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Reading controller'))
 await page.getByRole('button',{name:'Button 16 DIRECTION',exact:true}).click()
 const valueTx=await page.evaluate(()=>window.__sent.filter(b=>b.length===3).length)
 await page.getByRole('button',{name:'Test press / release',exact:true}).press('Space')
 await page.waitForTimeout(80)
 assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b.length===3).length),valueTx,'old assignment values cannot be sent during shortcut re-read')
 await page.evaluate(()=>window.__track(3));await selected(3).waitFor();console.log('physical3')
 await complete()
 assert.equal(await page.locator('.key-hit[data-lamp=blue]').count(),16)
 await page.getByRole('button',{name:'Button 16 DIRECTION',exact:true}).click()
 assert.equal(await page.getByRole('spinbutton',{name:'Channel',exact:true}).inputValue(),'3','cancel old preset read and apply final track assignments')
 await page.evaluate(()=>window.__receive([178,80,127]));await page.locator('.key-hit[aria-label="Button 16 DIRECTION"][data-lamp=red]').waitFor()
 await page.evaluate(()=>window.__receive([178,80,0]));await page.locator('.key-hit[aria-label="Button 16 DIRECTION"][data-lamp=blue]').waitFor()
 await page.getByRole('button',{name:'Button 24 T4',exact:true}).click();await selected(4).waitFor();console.log('web4 selected');await complete();console.log('web4 complete')
 assert.deepEqual(await page.evaluate(()=>window.__tracks()),{tracks:[63,2,3,4],selected:4})
 assert.ok(await page.evaluate(()=>!!window.__bcrStorage('bcr32-studio.before-shortcut-change.v1')))
 assert.equal(await page.locator('.key-hit[data-lamp=green]').count(),17)
 // Warm return: no indexed assignment reads, cached MIDI state and local edits survive.
 await page.getByRole('button',{name:'Button 16 DIRECTION',exact:true}).click()
 await page.getByRole('spinbutton',{name:'Channel',exact:true}).fill('7')
 await page.getByRole('spinbutton',{name:'Channel',exact:true}).press('Tab')
 await page.evaluate(()=>window.__receive([182,80,127]))
 await page.locator('.key-hit[aria-label="Button 16 DIRECTION"][data-lamp=red]').waitFor()
 const gets=()=>page.evaluate(()=>window.__sent.filter(b=>b.length===9&&b[6]>=49&&b[6]<=56).length)
 const beforeWarm=await gets()
 await page.evaluate(()=>window.__track(3));await selected(3).waitFor()
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Preset restored from UI cache'))
 assert.equal(await gets(),beforeWarm,'warm track3 must skip all indexed GETs')
 assert.equal(await page.getByRole('spinbutton',{name:'Channel',exact:true}).inputValue(),'3')
 await page.evaluate(()=>window.__track(4));await selected(4).waitFor()
 await page.waitForFunction(()=>document.querySelector('.controller-read-status')?.textContent.includes('Preset restored from UI cache'))
 assert.equal(await gets(),beforeWarm,'warm track4 must skip all indexed GETs')
 assert.equal(await page.getByRole('spinbutton',{name:'Channel',exact:true}).inputValue(),'7','UI assignment edits survive warm recall')
 await page.locator('.key-hit[aria-label="Button 16 DIRECTION"][data-lamp=red]').waitFor()
 // Manual read replaces this preset cache with current hardware assignments.
 await page.getByRole('button',{name:'Config',exact:true}).click()
 assert.equal(await page.getByRole('checkbox',{name:'UI preset cache · UI is the source of truth',exact:true}).isChecked(),true)
 await page.getByRole('button',{name:'Read controller now',exact:true}).click()
 await complete()
 assert.equal(await gets()-beforeWarm,656,'manual refresh reads all assignments')
 await page.getByRole('button',{name:'Control',exact:true}).click()
 assert.equal(await page.getByRole('spinbutton',{name:'Channel',exact:true}).inputValue(),'4','manual read refreshes cached UI edit')
 await page.getByRole('button',{name:'Presets',exact:true}).click()
 await page.locator('.track-shortcuts summary').click()
 await page.getByRole('combobox',{name:'T2 preset',exact:true}).selectOption('5')
 await page.getByRole('button',{name:'Assign shortcut presets',exact:true}).click()
 await page.locator('.controller-presets [role=status]').filter({hasText:'Controller shortcuts read back and confirmed'}).waitFor()
 assert.deepEqual(await page.evaluate(()=>window.__tracks()),{tracks:[63,5,3,4],selected:4})
 const tx=await page.evaluate(()=>window.__sent),lines=tx.filter(b=>b[6]===32).map(b=>String.fromCharCode(...b.slice(9,-1)))
 assert.ok(lines.includes('  .tracks 63 5 3 4 4'));assert.ok(!lines.some(s=>s.startsWith('$store')||s.startsWith('$reset')))
 assert.ok(!tx.some(b=>[34,114,119].includes(b[6])))
 await page.getByRole('button',{name:'Files',exact:true}).click();await page.waitForTimeout(300)
 const before=await page.evaluate(()=>window.__sent.filter(b=>b[6]===65).length);await page.waitForTimeout(2400);assert.equal(await page.evaluate(()=>window.__sent.filter(b=>b[6]===65).length),before,'Files workbench owns its BCL session')
 assert.deepEqual(errors,[])
 console.log('PASS: browser — physical T polling, rapid switch cancels stale read, MIDI-driven text, T recall, backed-up binding edit/restoration, Files exclusion and no STORE/reset')
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
