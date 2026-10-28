// Firmware 1.0.3 only. Read current sequencer to JSON, or explicitly test/restore one edit-buffer note.
// node scripts/hw/bcr32-zaq-host.mjs /absolute/capture.json [--test-note-and-restore]
// Never sends STORE, mode changes, transport, firmware commands or legacy command 07.
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
const destination=process.argv[2],test=process.argv.includes('--test-note-and-restore')
if(!destination||!isAbsolute(destination))throw Error('Absolute JSON capture path required')
const result=await build({stdin:{contents:"export * from './src/editors/bcontrol/bcr32/zaq-host';export {parseFirmwareReply,productQuery} from './src/editors/bcontrol/bcr32/web-midi'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports);const z=mod.exports
const require=createRequire(import.meta.url),midi=require('@julusian/midi'),input=new midi.Input(),output=new midi.Output()
const select=port=>{const list=Array.from({length:port.getPortCount()},(_,i)=>({i,name:port.getPortName(i)})).filter(p=>p.name.includes('BCR-32'));if(list.length!==1)throw Error('Need exactly one BCR32 port');return list[0]}
const inPort=select(input),outPort=select(output),frames=[],lanes=[];let reader=null,identify=null,identity=null,original=null,changed=false,restored=false
const send=b=>{if(!(b.length===8&&b[6]===0||z.isZaqHostQuery(b)||test&&z.isZaqHostWrite(b)&&b[8]===0&&b[9]===0&&b[10]===0))throw Error('Hardware script guard');frames.push({direction:'out',at:Date.now(),bytes:b});output.sendMessage(b)}
input.ignoreTypes(false,true,true);input.openPort(inPort.i);output.openPort(outPort.i)
input.on('message',(_,b)=>{b=Array.from(b);if(b[0]!==240||b[3]!==50||b[5]!==100)return;frames.push({direction:'in',at:Date.now(),bytes:b});if(z.parseFirmwareReply(b)){identity={firmware:z.parseFirmwareReply(b),device:b[4]};identify?.()}reader?.receive(b)})
const save=()=>writeFileSync(destination,JSON.stringify({capturedAt:new Date().toISOString(),input:inPort.name,output:outPort.name,identity,original,changed,restored,lanes,frames},null,2),{flag:'w'})
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Identity timeout')),1800);identify=()=>{clearTimeout(timer);resolve()};send(z.productQuery)})
 if(!z.supportsZaqHost(identity.firmware)||identity.device===127)throw Error('Fresh BCR32 firmware 1.0.3 identity required')
 reader=z.createZaqHost(send,identity.device)
 const before=await reader.state()
 for(let track=0;track<4;track++)for(let field=0;field<9;field++){lanes.push(await reader.readLane(track,field));await new Promise(r=>setTimeout(r,20))}
 const after=await reader.state();if(JSON.stringify(before.values)!==JSON.stringify(after.values))throw Error('State changed during read')
 save();console.log('Captured',lanes.length,'lanes; state',after.values)
 if(test){
  original=lanes.find(x=>x.track===0&&x.field===0).values[0];const value=original===127?126:original+1
  changed=true;save()
  const ack=await reader.write(0,0,0,value);console.log('Temporary write reply',ack)
  const check=await reader.readLane(0,0);if(check.values[0]!==value)throw Error('Temporary note read-back mismatch')
  console.log('Temporary note verified:',original,'->',value)
 }
}finally{
 if(changed&&reader){try{await reader.write(0,0,0,original);const check=await reader.readLane(0,0);restored=check.values[0]===original;console.log('Original note restored:',restored);if(!restored)process.exitCode=1}catch(e){console.error('RESTORATION REQUIRED',e);process.exitCode=1}}
 save();reader?.close();input.closePort();output.closePort()
}
