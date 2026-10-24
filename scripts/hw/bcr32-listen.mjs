// Passive recorder for front-panel exports from a connected BCR32: opens the input port only (no output port at all,
// so nothing can be sent), saves every SysEx message to output/hw/<time>-capture.syx, and reports the Zaquencer
// pattern exports (04 0B) it could assemble, with a byte comparison between consecutive patterns of the same slot.
//   node scripts/hw/bcr32-listen.mjs [seconds=600]
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,appendFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
const seconds=Number(process.argv[2]??600)
const dir=mkdtempSync(join(tmpdir(),'bcr32-listen-')),bundle=join(dir,'b.cjs')
await build({stdin:{contents:`export {decodeZaqBlock,createZaqAssembler} from './src/editors/bcontrol/bcr32/zaquencer'`,resolveDir:process.cwd(),loader:'ts'},bundle:true,outfile:bundle,platform:'node',format:'cjs',logLevel:'error'})
const require=createRequire(import.meta.url),z=require(bundle);rmSync(dir,{recursive:true})
const midi=require('@julusian/midi'),input=new midi.Input()
let port=-1;for(let i=0;i<input.getPortCount();i++)if(input.getPortName(i).includes('BCR-32'))port=i
if(port<0)throw Error('BCR-32 input not found')
const out=join(process.cwd(),'output','hw');mkdirSync(out,{recursive:true})
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),file=join(out,`${stamp}-capture.syx`),log=join(out,`${stamp}-capture.log`)
writeFileSync(file,Buffer.alloc(0));writeFileSync(log,'')
const note=line=>{const text=`${new Date().toISOString()} ${line}`;console.log(text);appendFileSync(log,text+'\n')}
const assembler=z.createZaqAssembler(),seen=new Map();let sysex=0,blocks=0
input.ignoreTypes(false,true,true)
input.on('message',(_dt,msg)=>{
  if(msg[0]!==0xf0)return
  sysex++;appendFileSync(file,Buffer.from(msg))
  const block=z.decodeZaqBlock(msg)
  if(!block){if(msg[6]===0x04)note(`04 ${msg[7]?.toString(16)} message, ${msg.length} bytes, not a valid pattern block`);return}
  blocks++;note(`pattern block kind ${block.kind} bank ${block.bank} page ${block.page} block ${block.block}`)
  const pattern=assembler.receive(block);if(!pattern)return
  const hash=createHash('sha256').update(Buffer.from(pattern.data)).digest('hex').slice(0,16),previous=seen.get(pattern.identity)
  note(`PATTERN complete ${pattern.identity} sha256:${hash}${previous?(previous===hash?' — identical to the previous export of this slot':' — DIFFERS from the previous export of this slot'):''}`)
  seen.set(pattern.identity,hash)
})
input.openPort(port)
note(`Listening on "${input.getPortName(port)}" for ${seconds}s. Nothing is sent (no output port is opened). File: ${file}`)
setTimeout(()=>{input.closePort();note(`Stopped: ${sysex} SysEx message(s), ${blocks} pattern block(s), ${seen.size} pattern(s).`)},seconds*1000)
