// Passive recorder of everything a connected BCR32 sends (notes, CC, program changes, clock and transport, SysEx): opens
// the input port only (nothing can be sent). Writes output/hw/<time>-all.log, one line per message (realtime clock
// bytes are counted per second instead of logged), and prints a summary at the end.
//   node scripts/hw/bcr32-listen-all.mjs [seconds=600; 0 = until interrupted]
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs'
import {join} from 'node:path'
const require=createRequire(import.meta.url),midi=require('@julusian/midi'),seconds=Number(process.argv[2]??600)
const input=new midi.Input();let port=-1;for(let i=0;i<input.getPortCount();i++)if(input.getPortName(i).includes('BCR-32'))port=i
if(port<0)throw Error('BCR-32 input not found')
const out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true});const file=join(out,`${new Date().toISOString().replace(/[:.]/g,'-')}-all.log`);writeFileSync(file,'')
const t0=Date.now(),counts={},clock={};const hex=m=>m.map(b=>b.toString(16).padStart(2,'0')).join(' ')
const kind=m=>{const s=m[0];if(s===0xf0)return `sysex ${m[6]?.toString(16)}`;if(s>=0xf8)return({0xf8:'clock',0xfa:'start',0xfb:'continue',0xfc:'stop',0xfe:'active sensing'})[s]??`rt ${s.toString(16)}`;return({0x80:'note off',0x90:'note on',0xa0:'poly at',0xb0:'cc',0xc0:'program',0xd0:'chan at',0xe0:'pitch bend'})[s&0xf0]+` ch${(s&15)+1}`}
input.ignoreTypes(false,false,false)
input.on('message',(_d,msg)=>{const m=Array.from(msg),k=kind(m),sec=Math.floor((Date.now()-t0)/1000);counts[k]=(counts[k]??0)+1
  if(k==='clock'||k==='active sensing'){clock[sec]=(clock[sec]??0)+1;return}
  appendFileSync(file,`${((Date.now()-t0)/1000).toFixed(3)} ${k} ${m.length>40?hex(m.slice(0,24))+' …':hex(m)}\n`)})
input.openPort(port);console.log(`Listening on "${input.getPortName(port)}" for ${seconds===0?'until interrupted':seconds+'s'} (input only). Log: ${file}`)
let stopped=false
const stop=()=>{if(stopped)return;stopped=true;input.closePort();const rates=Object.values(clock);console.log('Summary:',JSON.stringify(counts));if(rates.length)console.log('Clock messages per second (min/max):',Math.min(...rates),Math.max(...rates));process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
if(seconds>0)setTimeout(stop,seconds*1000)
else setInterval(()=>{},60000)
