// Read-only: reads one preset slot (and the working preset) from a connected BCR32 with the editor's own reader.
// Tolerates another editor polling the device: a read counts only when it is well formed and two successive reads
// are identical. Sends only the product query, 0C and 40 reads.  node scripts/hw/bcr32-read-slot.mjs <slot 1–64>
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const slot=Number(process.argv[2]);if(!Number.isInteger(slot)||slot<1||slot>64)throw Error('slot 1–64')
const dir=mkdtempSync(join(tmpdir(),'bcr32-read-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {createPresetReader} from './src/editors/bcontrol/bcr32/controller-presets';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(false,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const allowed=new Set([0x00,0x0c,0x40]),send=b=>{if(b[5]!==0x64||!allowed.has(b[6]))throw Error('Guard: refused '+b[6]);output.sendMessage(Array.from(b))}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let device=null,listener=()=>{};input.on('message',(_d,msg)=>listener(Array.from(msg)))
listener=msg=>{if(m.parseFirmwareReply(msg))device=msg[4]};send(m.productQuery);await sleep(800)
if(device===null||device===127)throw Error('No product reply')
const reader=m.createPresetReader(send,device,4000);listener=msg=>reader.receive(msg)
const wellFormed=(text,kind)=>{if(text==='$rev BCR32\n$end')return true;const l=text.split('\n');return l[0]==='$rev BCR32'&&l[1]===kind&&l.at(-1)==='$end'&&l.filter(x=>x.trim()===kind).length===1}
async function stable(request){let last=null;for(let i=0;i<8;i++){const r=await reader.read(request);console.error('read',request.kind,r.status,JSON.stringify(r.text.split('\n').length<12?r.text.split('\n'):r.text.split('\n').slice(0,3)));if(r.status==='complete'&&wellFormed(r.text,'$preset')){if(r.text===last)return r.text;last=r.text}await sleep(300)}throw Error(`No two identical well-formed reads of ${JSON.stringify(request)}`)}
try{
  const stored=await stable({kind:'slot',slot:slot-1}),working=await stable({kind:'working'})
  const name=t=>(t.match(/^\s*\.name '(.*)'$/m)??[])[1]
  console.log(JSON.stringify({slot,storedName:name(stored),storedLines:stored.split('\n').length,workingName:name(working),workingLines:working.split('\n').length,storedEqualsWorking:stored===working}))
}finally{reader.close();input.closePort();output.closePort()}
