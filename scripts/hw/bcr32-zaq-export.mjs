// Read-only: asks a connected BCR32 to export its current sequencer pattern over USB (command 07, 8 bytes) and records
// the reply. Sends only the product query (00) and 07; foreign SysEx during a 3 s quiet check aborts. Saves every
// received SysEx to output/hw/<time>-zaq-export.syx and prints the decoded notes of each complete pattern.
//   node scripts/hw/bcr32-zaq-export.mjs [command=07] [seconds=20]
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-zaq-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {decodeZaqBlock,createZaqAssembler,readStep} from './src/editors/bcontrol/bcr32/zaquencer';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi';export {noteName} from './src/editors/bcontrol/bcr32/sequencer-shared'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const command=parseInt(process.argv[2]??'07',16),seconds=Number(process.argv[3]??20)
if(![6,7,8].includes(command))throw Error('Only the export requests 06, 07 and 08 are allowed')
// 2026-10-24: 07 in CTRL mode sent block 0 of 8, then the unit froze until restarted (docs/BCR32-PROTOCOL-1.0.2.md).
if(process.env.BCR32_EXPORT_FREEZE_RISK!=='accepted')throw Error('Refused: 07 froze the BCR32 after block 0; set BCR32_EXPORT_FREEZE_RISK=accepted only with the owner\'s go')
const midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(false,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const send=b=>{b=Array.from(b);if(b.length!==8||b[5]!==0x64||!(b[6]===0x00||b[6]===command))throw Error('Guard: refused '+b[6]);output.sendMessage(b)}
const sleep=t=>new Promise(r=>setTimeout(r,t)),hex=x=>x.map(b=>b.toString(16).padStart(2,'0')).join(' ')
let listener=()=>{};input.on('message',(_d,x)=>listener(Array.from(x)))
try{
  let foreign=0;listener=x=>{if(x[0]===0xf0)foreign++};await sleep(3000)
  if(foreign)throw Error(`Abort: ${foreign} SysEx message(s) without request: another editor talks to the BCR32.`)
  let device=null;listener=x=>{if(m.parseFirmwareReply(x))device=x[4]};send(m.productQuery);await sleep(800)
  if(device===null||device===127)throw Error('No product reply')
  const got=[],assembler=m.createZaqAssembler(),patterns=[]
  listener=x=>{if(x[0]!==0xf0)return;got.push(x);const b=m.decodeZaqBlock(x);if(b){const p=assembler.receive(b);if(p)patterns.push(p)}}
  send([0xf0,0x00,0x20,0x32,device,0x64,command,0xf7]);console.log(`Sent ${command.toString(16).padStart(2,'0')} to device ${device}; listening ${seconds}s`)
  await sleep(seconds*1000)
  const out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true})
  const file=join(out,`${new Date().toISOString().replace(/[:.]/g,'-')}-zaq-export.syx`);writeFileSync(file,Buffer.from(got.flat()))
  const kinds={};for(const x of got){const k=x.length===273?`${hex(x.slice(6,8))} kind ${x[8]}`:`${x.length} bytes ${hex(x.slice(0,Math.min(x.length,12)))}`;kinds[k]=(kinds[k]??0)+1}
  console.log(`${got.length} SysEx message(s) saved to ${file}`);console.table(kinds)
  for(const p of patterns){console.log(`Pattern ${p.identity} (device:kind:bank:page)`)
    for(let t=0;t<4;t++)console.log(`  T${t+1}`,Array.from({length:32},(_,s)=>{const v=m.readStep(p.data,t,s);return v.rest?'--':m.noteName(v.note)}).join(' '))}
}finally{input.closePort();output.closePort()}
