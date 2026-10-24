// Start/stop test of the BCR32 sequencer as a MIDI clock slave (ZAQ global 26 CLOCK INT/EXT set to USB on the device).
// Sends only Start (FA), Clock (F8) and Stop (FC) through the editor's own clock master; no SysEx at all. Counts the
// notes the BCR32 plays while running and after Stop.
//   node scripts/hw/bcr32-clock-test.mjs [bpm=120] [seconds=8]
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-clock-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {createClockMaster,isClockMessage} from './src/editors/bcontrol/bcr32/sequencer-clock'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const bpm=Number(process.argv[2]??120),seconds=Number(process.argv[3]??8)
const midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(true,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const now=()=>performance.now(),sleep=t=>new Promise(r=>setTimeout(r,t))
let sent={0xfa:0,0xf8:0,0xfc:0},phase='before';const notes={before:0,running:0,after:0},times=[]
input.on('message',(_d,x)=>{if((x[0]&0xf0)===0x90&&x[2]>0){notes[phase]++;if(phase==='running')times.push(now())}})
const clock=m.createClockMaster((bytes,at)=>{if(!m.isClockMessage(bytes))throw Error('Guard: refused');setTimeout(()=>{output.sendMessage(bytes);sent[bytes[0]]++},Math.max(0,at-now()))},undefined,{timers:{now,every:(fn,ms)=>setInterval(fn,ms),cancel:h=>clearInterval(h)}})
try{
  await sleep(2000)
  phase='running';clock.start(bpm);console.log(`Start sent, clock at ${clock.bpm} BPM for ${seconds}s`)
  await sleep(seconds*1000)
  clock.stop();await sleep(100);phase='after';console.log('Stop sent')
  await sleep(3000)
  const gaps=times.slice(1).map((t,i)=>t-times[i]),avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:0
  console.log({sent:{start:sent[0xfa],clock:sent[0xf8],stop:sent[0xfc]},notes,averageNoteGapMs:Math.round(avg)})
  console.log(notes.running>0&&notes.after===0?'PASS: the BCR32 followed Start, clock and Stop':'NOT CONFIRMED: see the counts above')
}finally{clock.stop();input.closePort();output.closePort()}
