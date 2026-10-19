#!/usr/bin/env node
// Optional browser regression: simulated Web MIDI only; no device or credentials.
// PLAYWRIGHT_CORE=/path/to/playwright node scripts/e2e-firmware-workbench.cjs [url]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const assert = require('node:assert/strict')
function fakeMidi() {
  localStorage.setItem('bcr32-studio.language.v1', 'en')
  const input = { id: 'fw-in', name: 'BCR-32 SIM', state: 'connected', type: 'input', onmidimessage: null }
  const reply = data => setTimeout(() => input.onmidimessage?.({ data: new Uint8Array(data) }), 10)
  const prefix = [240,0,32,50,127,100]
  window.__sent = []
  const output = { id: 'fw-out', name: 'BCR-32 SIM', state: 'connected', type: 'output', onmidimessage: null, send(bytes) {
    window.__sent.push([...bytes])
    const cmd = bytes[6]
    if (cmd === 0 && bytes.length === 8) return reply([...prefix,0,1,0,0,1,0,2,247])
    if (cmd >= 49 && cmd <= 56 && bytes.length === 9) return reply([...prefix,cmd,bytes[7],8,247])
    if (cmd === 44 && bytes.length === 9) return reply([...prefix,44,bytes[7],1,124,247])
    if (cmd >= 41 && cmd <= 45 && bytes.length === 9) return reply([...prefix,cmd,bytes[7],0,247])
    if ((cmd === 64 && bytes.length === 9) || cmd === 65 && bytes.length === 8) {
      for (const [i,line] of ['$rev BCR32','$preset','$encoder 1',' .tx F0 7D val F7'].entries()) reply([...prefix,32,0,i,...Array.from(line,c=>c.charCodeAt(0)),247])
      return
    }
    if (bytes.length === 8) reply([...prefix,cmd,5,247])
  } }
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => ({ sysexEnabled: true, inputs: new Map([[input.id,input]]), outputs: new Map([[output.id,output]]), onstatechange: null }) })
}
function pattern() {
  const data = Array(1024).fill(0)
  for (let track=0;track<4;track++) for(let step=0;step<32;step++){data[track*256+16+step]=60;data[track*256+48+step]=100}
  const frames = []
  for (let i=0;i<8;i++) {
    const frame=[240,0,32,50,127,100,4,11,1,0,0,i,...data.slice(i*128,(i+1)*128).flatMap(v=>[v>>4,v&15])]
    const sum=frame.reduce((n,v)=>n+v,0)&65535;frames.push([...frame,...[12,8,4,0].map(shift=>sum>>shift&15),247])
  }
  return Buffer.from(frames.flat())
}
async function downloaded(download) {
  const stream=await download.createReadStream(),chunks=[]
  for await(const chunk of stream)chunks.push(chunk)
  return Buffer.concat(chunks)
}
;(async()=>{
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
    page.on('pageerror',e=>errors.push(String(e)))
    await page.addInitScript(fakeMidi);await page.goto(process.argv[2]||'http://127.0.0.1:5173/')
    await page.getByText('1.0.2',{exact:false}).first().waitFor()
    await page.getByRole('button',{name:'Files',exact:true}).click()
    await page.locator('.firmware-tools > summary').click()
    const tools=page.locator('.firmware-tools')
    await tools.getByRole('button',{name:'Read parameter',exact:true}).click()
    await tools.locator('output').first().filter({hasText:'8'}).waitFor()
    await tools.getByRole('button',{name:'Read BCL preset',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.firmware-tools textarea')?.value.includes('.tx'))
    await tools.getByRole('button',{name:'Stop BCL capture',exact:true}).click()
    await tools.getByRole('textbox',{name:'BCL source',exact:true}).fill('$rev BCR32\n$preset\n$encoder 1\n .tx F0 7D val F7')
    const bclDownload=page.waitForEvent('download');await tools.getByRole('button',{name:'Save BCL SysEx file',exact:true}).click()
    const bclBytes=await downloaded(await bclDownload);assert.ok(bclBytes.includes(Buffer.from('.tx F0 7D val F7')))
    await tools.locator('input[type=file]').setInputFiles({name:'pattern.syx',mimeType:'application/octet-stream',buffer:pattern()})
    await tools.getByRole('spinbutton',{name:'Step 1 · Note',exact:true}).fill('67')
    await tools.getByRole('spinbutton',{name:'Step 25 · Gate code',exact:true}).fill('15')
    await tools.getByRole('spinbutton',{name:'Step 1 · Velocity',exact:true}).fill('91')
    assert.equal(await tools.getByRole('spinbutton',{name:'Step 25 · Gate code',exact:true}).inputValue(),'15')
    const patternDownload=page.waitForEvent('download');await tools.getByRole('button',{name:'Save edited pattern (.syx)',exact:true}).click()
    const edited=await downloaded(await patternDownload);assert.equal(edited.length,8*273)
    await tools.locator('input[type=file]').setInputFiles({name:'edited.syx',mimeType:'application/octet-stream',buffer:edited})
    assert.equal(await tools.getByRole('spinbutton',{name:'Step 1 · Note',exact:true}).inputValue(),'67')
    assert.equal(await tools.getByRole('spinbutton',{name:'Step 1 · Velocity',exact:true}).inputValue(),'91')
    assert.equal(await tools.getByRole('spinbutton',{name:'Step 25 · Gate code',exact:true}).inputValue(),'15')
    // A failed import cannot replace an edited draft.
    await tools.locator('input[type=file]').setInputFiles({name:'truncated.syx',mimeType:'application/octet-stream',buffer:edited.subarray(0,273)})
    await tools.getByText('Import rejected: invalid or incomplete firmware data.',{exact:true}).waitFor()
    assert.equal(await tools.getByRole('spinbutton',{name:'Step 1 · Note',exact:true}).inputValue(),'67')
    await page.getByRole('button',{name:'Config',exact:true}).click()
    await page.getByText('LED brightness',{exact:true}).first().click().catch(()=>{})
    assert.ok(await page.getByRole('slider',{name:'LED brightness',exact:true}).isDisabled(),'1.x slider read-only')
    const sent=await page.evaluate(()=>window.__sent)
    assert.ok(sent.some(m=>m[6]===82&&m.length===8),'new brightness read')
    assert.ok(!sent.some(m=>[4,32,34,67,114,119].includes(m[6])),'no import/BCL lines/recall/snapshot/store/bootloader sends')
    assert.ok(!sent.some(m=>m[6]===82&&m.length>8),'no new brightness write')
    assert.deepEqual(errors,[])
    console.log('PASS: browser with fake 1.0.2 MIDI — live-gated target read, BCL capture/download, pattern edits/download/reimport, corrupt-file rejection, shared bits and no write sends')
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
