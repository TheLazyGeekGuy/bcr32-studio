// Reads, or sets once, the BCR32 sequencer clock source ("Sync mode", global 50 on firmware 1.x: 0 Internal, 1 Sync in,
// 2 MIDI in, 3 USB in). Sends only the product query (00), the 50 read and, with `set`, one 50 write of 0, 2 or 3 followed
// by a read-back and a product query (the device must still answer). Foreign SysEx during a 3 s quiet check aborts.
// Every run is logged to output/hw/<time>-sync.json.
//   node scripts/hw/bcr32-sync-mode.mjs read
//   node scripts/hw/bcr32-sync-mode.mjs set 0|2|3
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const require=createRequire(import.meta.url),midi=require('@julusian/midi')
const [action='read',arg]=process.argv.slice(2),target=Number(arg)
if(!(action==='read'||action==='set'&&[0,2,3].includes(target)))throw Error('Usage: read | set 0|2|3')
const labels=['Internal','Sync in','MIDI in','USB in'],prefix=[0xf0,0x00,0x20,0x32,0x7f,0x64]
const input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(false,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const allowed=b=>b.length===8&&(b[6]===0x00||b[6]===0x50)||b.length===9&&b[6]===0x50&&[0,2,3].includes(b[7])
const sent=[],got=[],send=b=>{if(!prefix.every((v,i)=>b[i]===v)||b.at(-1)!==0xf7||!allowed(b))throw Error('Guard: refused');sent.push(b);output.sendMessage(b)}
const sleep=t=>new Promise(r=>setTimeout(r,t)),hex=x=>x.map(b=>b.toString(16).padStart(2,'0')).join(' ')
let listener=()=>{};input.on('message',(_d,x)=>{x=Array.from(x);if(x[0]===0xf0)got.push(hex(x));listener(x)})
const reply=(cmd,ms=800)=>new Promise(r=>{const t=setTimeout(()=>{listener=()=>{};r(null)},ms);listener=x=>{if(x[0]===0xf0&&x[6]===cmd&&x.at(-1)===0xf7){clearTimeout(t);listener=()=>{};r(x)}}})
const product=async()=>{const p=reply(0x00);send([...prefix,0x00,0xf7]);return !!await p}
const readSync=async()=>{const p=reply(0x50);send([...prefix,0x50,0xf7]);const x=await p;return x&&x.length===9?x[7]:null}
const log={time:new Date().toISOString(),action,target:action==='set'?target:undefined}
try{
  let foreign=0;listener=x=>{if(x[0]===0xf0)foreign++};await sleep(3000);listener=()=>{}
  if(foreign)throw Error(`Abort: ${foreign} SysEx message(s) without request: another editor talks to the BCR32.`)
  if(!await product())throw Error('No product reply')
  log.before=await readSync();console.log('Sync mode before:',log.before,labels[log.before]??'(no reply)')
  if(action==='set'){
    if(log.before===null)throw Error('Abort: the current value could not be read')
    if(log.before===target)console.log('Already set; nothing written.')
    else{
      const p=reply(0x50,1500);send([...prefix,0x50,target,0xf7]);const answer=await p
      log.writeAnswer=answer?hex(answer):null;console.log('Write answer:',log.writeAnswer??'(none)')
      await sleep(300);log.after=await readSync();console.log('Sync mode after:',log.after,labels[log.after]??'(no reply)')
      log.stillAnswers=await product();console.log('Device still answers the product query:',log.stillAnswers)
    }
  }
}finally{
  log.sent=sent.map(hex);log.received=got
  const out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true});writeFileSync(join(out,`${log.time.replace(/[:.]/g,'-')}-sync.json`),JSON.stringify(log,null,1))
  input.closePort();output.closePort()
}
