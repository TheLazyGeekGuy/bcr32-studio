// Start/stop test of the BCR32 sequencer through the remote CC table: CC 4 ("transport state", values 0–1 qualified,
// 2–4 not) on the channel chosen with ZAQ global 33 TRIGGER ENABLE, which is taken here as the remote channel (the
// firmware's CC table and the BCR2000 manual 1.04 §7.9 both tie pattern-change CCs to it; not verified).
// Sends only CC 4 = 1, waits, then CC 4 = 0 on that channel; no SysEx. Counts the notes the BCR32 plays.
//   node scripts/hw/bcr32-remote-transport.mjs <channel 1–16> [seconds=6]
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),midi=require('@julusian/midi')
const channel=Number(process.argv[2]),seconds=Number(process.argv[3]??6)
if(!Number.isInteger(channel)||channel<1||channel>16)throw Error('Usage: <channel 1–16> [seconds]')
const input=new midi.Input(),output=new midi.Output()
const find=(p,n)=>{for(let i=0;i<p.getPortCount();i++)if(p.getPortName(i).includes(n))return i;return -1}
input.ignoreTypes(true,true,true);input.openPort(find(input,'BCR-32'));output.openPort(find(output,'BCR-32'))
const send=b=>{if(b.length!==3||b[0]!==(0xb0|channel-1)||b[1]!==4||(b[2]!==0&&b[2]!==1))throw Error('Guard: refused');output.sendMessage(b)}
const sleep=t=>new Promise(r=>setTimeout(r,t)),notes={before:0,running:0,after:0},other={};let phase='before'
input.on('message',(_d,x)=>{x=Array.from(x);if((x[0]&0xf0)===0x90&&x[2]>0)notes[phase]++;else if((x[0]&0xf0)!==0x80){const k=x.map(b=>b.toString(16)).join(' ');other[k]=(other[k]??0)+1}})
try{
  await sleep(2000)
  phase='running';send([0xb0|channel-1,4,1]);console.log(`CC 4 = 1 sent on channel ${channel}; listening ${seconds}s`)
  await sleep(seconds*1000)
  send([0xb0|channel-1,4,0]);await sleep(150);phase='after';console.log('CC 4 = 0 sent')
  await sleep(2500)
  console.log({notes,other})
  console.log(notes.running>0&&notes.after===0?'PASS: CC 4 started and stopped the sequencer':'NOT CONFIRMED: see the counts above')
}finally{input.closePort();output.closePort()}
