// Production browser workload; fake MIDI only. No screenshots, device enumeration or physical output.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const {fakeMidi}=require('./e2e-zaq-host.cjs')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
async function measure(browser,base,round){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(fakeMidi,{sync:true});await page.goto(base+'/editor/?native=0')
 await page.getByRole('button',{name:'Sequencer',exact:true}).click()
 await page.getByText('Current pattern read · 4 tracks / 32 steps · no STORE sent',{exact:true}).waitFor()
 await page.evaluate(()=>window.__running=1)
 await page.getByText('Hardware playing',{exact:true}).waitFor()
 const session=await page.context().newCDPSession(page)
 await session.send('Emulation.setCPUThrottlingRate',{rate:4});await session.send('Performance.enable')
 const before=(await session.send('Performance.getMetrics')).metrics
 const result=await page.evaluate(async()=>{
  const start=performance.now()+30,total=960,period=1000/120,latencies=[]
  let sent=0,maxBatch=0
  const observer=new MutationObserver(()=>{
   const rows=[...document.querySelectorAll('.seq-row')],actual=rows.map(row=>[...row.querySelectorAll('.seq-cell')].findIndex(n=>n.dataset.playing==='true'))
   const expected=Math.floor(Math.max(0,sent-1)/6)%32
   if(actual.length===4&&actual.every(i=>i===expected)&&sent)latencies.push(performance.now()-(start+Math.floor((sent-1)/6)*6*period))
  })
  observer.observe(document.querySelector('.seq-grid'),{subtree:true,attributes:true,attributeFilter:['data-playing']})
  await new Promise(resolve=>{
   let started=false
   const pump=()=>{
    const at=performance.now();if(at<start){setTimeout(pump,2);return}
    if(!started){started=true;window.__emit([250],start)}
    const due=Math.min(total,Math.floor((at-start)/period)+1),batch=due-sent;maxBatch=Math.max(maxBatch,batch)
    while(sent<due){window.__emit([248],Math.round(start+sent*period));sent++}
    if(sent<total)setTimeout(pump,2);else requestAnimationFrame(()=>requestAnimationFrame(resolve))
   };pump()
  })
  observer.disconnect();latencies.sort((a,b)=>a-b)
  const rows=[...document.querySelectorAll('.seq-row')],positions=rows.map(row=>[...row.querySelectorAll('.seq-cell')].findIndex(n=>n.dataset.playing==='true'))
  const bpm=document.querySelector('.seq-transport input[type=number]').value
  return {clocks:sent,positions,expected:Math.floor((sent-1)/6)%32,bpm:bpm?Number(bpm):null,maxBatch,markerMutationSamples:latencies.length,markerMutationLatencyMs:{median:latencies[Math.floor(latencies.length*.5)]??null,p95:latencies[Math.floor(latencies.length*.95)]??null,max:latencies.at(-1)??null},writes:window.__sent.filter(b=>b[6]===0x44).length}
 })
 const after=(await session.send('Performance.getMetrics')).metrics
 const delta=name=>after.find(m=>m.name===name).value-before.find(m=>m.name===name).value
 Object.assign(result,{base,round,taskSeconds:delta('TaskDuration'),scriptSeconds:delta('ScriptDuration'),layoutSeconds:delta('LayoutDuration'),errors})
 assert.deepEqual(errors,[]);assert.equal(result.writes,0);assert.deepEqual(result.positions,Array(4).fill(result.expected),'all clocks reach the final playback step')
 if(base===process.argv[3])assert.ok(Math.abs(result.bpm-300)<.5,'candidate measures the 300 BPM source')
 await page.close();return result
}
;(async()=>{
 const [baseline,candidate,report]=process.argv.slice(2);assert.ok(baseline&&candidate,'usage: baselineURL candidateURL [report.json]')
 const browser=await chromium.launch({headless:true}),results=[]
 try{for(let round=1;round<=2;round++)for(const base of round===1?[baseline,candidate]:[candidate,baseline])results.push(await measure(browser,base,round))}finally{await browser.close()}
 const output={capturedAt:new Date().toISOString(),browser:'Headless Chromium; 1440×1000; CPU throttle 4×; two alternating eight-second runs per production build; simulated 300 BPM / 24 PPQ',results}
 if(report){fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify(output,null,2)+'\n')}
 console.log(JSON.stringify(output,null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
