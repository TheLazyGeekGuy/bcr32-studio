// Hardware test of the T1–T4 shortcuts on a connected BCR32 (firmware 1.0.2), through the editor's own code:
// createPresetReader, createBclSender and applyControllerTracks. Read-only unless --apply is given.
//   node scripts/hw/bcr32-tracks-test.mjs                 # read: firmware, device, preset names, current T1–T4
//   node scripts/hw/bcr32-tracks-test.mjs --apply --t4 N  # set T4 → slot N, read back, then restore the original T1–T4
// Guards: every outgoing frame must be a known read (00, 40, 41, 42) or a BCL line (20); STORE (72) and bootloader (77)
// are refused, as is any "$store" line. Slot 1 is never a target, and the test stops if T4 is the selected track (that
// would reload another preset into the working memory). Foreign SysEx on the port during a 3 s quiet check aborts.
// Backups (globals, working preset, names) are written to output/hw/ before any write.
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const args=process.argv.slice(2),apply=args.includes('--apply'),t4=args.includes('--t4')?Number(args[args.indexOf('--t4')+1]):null
const dir=mkdtempSync(join(tmpdir(),'bcr32-hw-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {createPresetReader} from './src/editors/bcontrol/bcr32/controller-presets';export {createBclSender} from './src/editors/bcontrol/bcr32/preset-store';export {applyControllerTracks,controllerTracksFromBcl} from './src/editors/bcontrol/bcr32/controller-tracks';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),m=require(bundle);rmSync(dir,{recursive:true})
const midi=require('@julusian/midi')
const find=(port,name)=>{for(let i=0;i<port.getPortCount();i++)if(port.getPortName(i).includes(name))return i;return -1}
const input=new midi.Input(),output=new midi.Output()
const inPort=find(input,'BCR-32'),outPort=find(output,'BCR-32')
if(inPort<0||outPort<0)throw Error('BCR-32 MIDI ports not found')
input.ignoreTypes(false,true,true);input.openPort(inPort);output.openPort(outPort)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const allowed=new Set([0x00,0x20,0x40,0x41,0x42]),sent=[]
const send=bytes=>{
  const b=Array.from(bytes)
  if(b[0]!==0xf0||b[1]!==0||b[2]!==0x20||b[3]!==0x32||b[5]!==0x64||!allowed.has(b[6])||b.at(-1)!==0xf7)throw Error('Guard: frame refused '+b.slice(0,8).map(x=>x.toString(16)).join(' '))
  if(b[6]===0x20&&/^\s*\$store/i.test(String.fromCharCode(...b.slice(9,-1))))throw Error('Guard: $store refused')
  sent.push(b[6]);output.sendMessage(b)
}
let listener=()=>{}
input.on('message',(_dt,msg)=>listener(msg))
const close=()=>{try{input.closePort();output.closePort()}catch{}}
try{
  // 1. Quiet check: another editor talking to the BCR32 would interleave replies.
  let foreign=0;listener=msg=>{if(msg[0]===0xf0)foreign++};await sleep(3000)
  if(foreign)throw Error(`Abort: ${foreign} SysEx message(s) on the port without any request (another editor is probably connected). Close it and retry.`)
  // 2. Firmware and device.
  let firmware=null,device=null;listener=msg=>{const fw=m.parseFirmwareReply(msg);if(fw){firmware=fw;device=msg[4]}}
  send(m.productQuery);await sleep(800)
  if(firmware!=='1.0.2'||device===null||device===127)throw Error(`Abort: firmware ${firmware} device ${device}; 1.0.2 with a device ID is required`)
  const reader=m.createPresetReader(send,device,4000),sender=m.createBclSender(send,device,1500,15)
  listener=msg=>{const b=Array.from(msg);reader.receive(b);sender.receive(b)}
  const read=async request=>{const r=await reader.read(request);if(r.status!=='complete')throw Error(`Read ${request.kind} ${r.status}`);return r}
  const names=(await read({kind:'names'})).names,globals=(await read({kind:'global'})).text,working=(await read({kind:'working'})).text
  const tracks=m.controllerTracksFromBcl(globals)
  const label=slot=>`${slot}:${JSON.stringify(names[slot-1]??'')}`
  console.log(`BCR32 firmware ${firmware}, device ${device}`)
  console.log('Preset names:',Array.from({length:64},(_,i)=>label(i+1)).join(' '))
  console.log('T1–T4 now:',tracks?`${tracks.presets.map(label).join(' | ')} · selected T${tracks.selected}`:'unreadable')
  if(!apply){console.log('Read-only run: nothing written.');process.exitCode=0}
  else{
    if(!tracks)throw Error('Abort: current T1–T4 unreadable')
    if(!Number.isInteger(t4)||t4<2||t4>64)throw Error('Abort: --t4 must be a slot 2–64 (slot 1 is never a target)')
    if(tracks.selected===4)throw Error('Abort: T4 is the selected track; select another track on the BCR32 first')
    const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true})
    writeFileSync(join(out,`${stamp}-before.json`),JSON.stringify({firmware,device,tracks,names,globals,working},null,1))
    const backups=[];const backup=contents=>backups.push(contents)
    const transfer=lines=>sender.transfer(lines)
    const target=[tracks.presets[0],tracks.presets[1],tracks.presets[2],t4]
    console.log(`Setting T4 → ${label(t4)} …`)
    const changed=await m.applyControllerTracks({read:r=>reader.read(r),transfer,backup,presets:target})
    const check1=m.controllerTracksFromBcl((await read({kind:'global'})).text)
    console.log('Read back:',JSON.stringify(check1),JSON.stringify(check1?.presets)===JSON.stringify(target)?'OK':'DIFFERS')
    console.log('Restoring the original T1–T4 …')
    await m.applyControllerTracks({read:r=>reader.read(r),transfer,backup,presets:tracks.presets})
    const finalGlobals=(await read({kind:'global'})).text,finalWorking=(await read({kind:'working'})).text
    const check2=m.controllerTracksFromBcl(finalGlobals)
    const restored=JSON.stringify(check2)===JSON.stringify(tracks)
    console.log('Restored:',JSON.stringify(check2),restored?'OK':'DIFFERS')
    console.log('Globals identical to the start:',finalGlobals===globals?'yes':'no','· working preset identical:',finalWorking===working?'yes':'no')
    writeFileSync(join(out,`${stamp}-after.json`),JSON.stringify({changed:changed.tracks,check1,check2,finalGlobals,finalWorking,backups},null,1))
    process.exitCode=JSON.stringify(check1?.presets)===JSON.stringify(target)&&restored&&finalGlobals===globals&&finalWorking===working?0:1
  }
  console.log('Commands sent:',Object.entries(sent.reduce((a,c)=>(a[c.toString(16)]=(a[c.toString(16)]??0)+1,a),{})).map(([k,v])=>`${k}×${v}`).join(' '))
}finally{close()}
