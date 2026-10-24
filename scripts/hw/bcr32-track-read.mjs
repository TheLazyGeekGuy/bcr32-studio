// Read-only: the four Zaquencer track parameters (commands 29–2D: mode, port, channel, alpha, beta) from a connected
// BCR32, each read twice with the editor's own track reader. Sends only the product query and 29–2D reads.
//   node scripts/hw/bcr32-track-read.mjs
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-track-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {createTrackReader,trackFields} from './src/editors/bcontrol/bcr32/firmware-codec';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(false,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const send=b=>{b=Array.from(b);if(b[5]!==0x64||!(b[6]===0x00||b[6]>=0x29&&b[6]<=0x2d))throw Error('Guard: refused '+b[6]);output.sendMessage(b)}
let device=null,listener=()=>{};input.on('message',(_d,x)=>listener(Array.from(x)))
listener=x=>{if(m.parseFirmwareReply(x))device=x[4]};send(m.productQuery);await new Promise(r=>setTimeout(r,800))
if(device===null||device===127)throw Error('No product reply')
const reader=m.createTrackReader(send,1500,device);listener=x=>reader.receive(x)
const rows=[]
try{
  for(let track=0;track<4;track++){const row={track:`T${track+1}`}
    for(const field of m.trackFields){const a=await reader.read(track,field),b=await reader.read(track,field)
      const show=r=>r.value?r.value.signed:r.status;row[field]=show(a)===show(b)?show(a):`${show(a)}/${show(b)}`}
    rows.push(row)}
  console.table(rows)
}finally{reader.close();input.closePort();output.closePort()}
