// Hardware test of renaming/storing the working preset into one slot, through the editor's own storeHardwarePreset
// (backup → import with $store → read-back → working preset restored → read-back). Requires --apply; otherwise it only
// reads and prints the plan. Guards: only reads (00, 0C, 40, 42) and BCL lines (20) leave; no bootloader (77) or global
// STORE (72) command; slot 1 is refused; foreign SysEx during a 3 s quiet check aborts. Backups go to output/hw/.
//   node scripts/hw/bcr32-store-test.mjs --slot 13 --name "test Fred" [--apply]
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const arg=k=>{const i=process.argv.indexOf(k);return i<0?null:process.argv[i+1]},apply=process.argv.includes('--apply')
const slot=Number(arg('--slot')),name=arg('--name')??''
if(!Number.isInteger(slot)||slot<2||slot>64)throw Error('--slot 2–64 (slot 1 is never a target)')
const dir=mkdtempSync(join(tmpdir(),'bcr32-store-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {createPresetReader} from './src/editors/bcontrol/bcr32/controller-presets';export {createBclSender,storeHardwarePreset,presetStorePlan,isInitializedPreset} from './src/editors/bcontrol/bcr32/preset-store';export {defaultPresetBcl} from './src/editors/bcontrol/bcr32/default-preset';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(false,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const allowed=new Set([0x00,0x0c,0x20,0x40,0x42]),sent={}
const send=b=>{b=Array.from(b);if(b[5]!==0x64||!allowed.has(b[6]))throw Error('Guard: refused command '+b[6]?.toString(16));if(b[6]===0x20&&/^\$store/i.test(String.fromCharCode(...b.slice(9,-1)))&&!String.fromCharCode(...b.slice(9,-1)).startsWith(`$store ${slot}`))throw Error('Guard: $store to another slot');sent[b[6].toString(16)]=(sent[b[6].toString(16)]??0)+1;output.sendMessage(b)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let listener=()=>{};input.on('message',(_d,msg)=>listener(Array.from(msg)))
try{
  let foreign=0;listener=x=>{if(x[0]===0xf0)foreign++};await sleep(3000)
  if(foreign)throw Error(`Abort: ${foreign} SysEx message(s) without request: another editor talks to the BCR32.`)
  let device=null;listener=x=>{if(m.parseFirmwareReply(x))device=x[4]};send(m.productQuery);await sleep(800)
  if(device===null||device===127)throw Error('No product reply')
  const reader=m.createPresetReader(send,device,4000),sender=m.createBclSender(send,device,1500,15)
  listener=x=>{reader.receive(x);sender.receive(x)}
  const working=(await reader.read({kind:'working'})).text,base=m.isInitializedPreset(working)?m.defaultPresetBcl:working,plan=m.presetStorePlan(base,slot-1,name)
  console.log('Working preset lines:',working.split('\n').length,'· plan lines:',plan.lines.length,'· last lines:',JSON.stringify(plan.lines.slice(-2)))
  if(!apply){console.log('Read-only run: nothing written.')}else{
    const out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-')
    let backupText=''
    try{
      await m.storeHardwarePreset({read:r=>reader.read(r),transfer:lines=>sender.transfer(lines),source:'working',slot:slot-1,name,template:m.defaultPresetBcl,backup:c=>{backupText=c;writeFileSync(join(out,`${stamp}-store-backup.json`),c)},onAcknowledged:p=>console.log('STORE acknowledged:',p.slot+1,JSON.stringify(p.name))})
      console.log('Store complete: read back identical, working preset restored and identical.')
    }catch(e){console.log('Store stopped:',String(e))}
    const after=(await reader.read({kind:'slot',slot:slot-1})).text,names=(await reader.read({kind:'names'})).names
    writeFileSync(join(out,`${stamp}-store-after.json`),JSON.stringify({after,plan:plan.expected,backup:!!backupText},null,1))
    console.log('Slot',slot,'name now:',JSON.stringify(names[slot-1]),'· slot lines:',after.split('\n').length,'· equals plan:',after===plan.expected)
    if(after!==plan.expected){const a=after.split('\n'),p=plan.expected.split('\n');console.log('read back:',JSON.stringify(a.slice(0,8)),'… plan:',JSON.stringify(p.slice(0,8)))}
  }
  console.log('Commands sent:',JSON.stringify(sent))
}finally{input.closePort();output.closePort()}
