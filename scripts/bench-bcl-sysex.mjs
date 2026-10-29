import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
const built=await build({entryPoints:['src/bcl-tx.ts'],bundle:true,write:false,format:'cjs',platform:'node'}),mod={exports:{}}
new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports)
const {parseCustomAssignment,evaluateAssignment}=mod.exports
const simple='.minmax 0 127\n.tx $F0 $7D val $F7',large=Array(250).fill('; '+'.'.repeat(200)).join('\n')+'\n'+simple
const run=(name,source,n)=>{
 for(let i=0;i<100;i++)parseCustomAssignment(source)
 const samples=[];let messages=0
 for(let i=0;i<n;i++){const t=performance.now(),p=parseCustomAssignment(source);if(p.conversionStatus==='exact')messages+=evaluateAssignment(p,i%128).length;samples.push(performance.now()-t)}
 samples.sort((a,b)=>a-b);const total=samples.reduce((a,b)=>a+b,0),p95=samples[Math.floor(samples.length*.95)]
 return {name,sourceBytes:Buffer.byteLength(source),iterations:n,messagesSimulated:messages,p50Ms:samples[Math.floor(n*.5)],p95Ms:p95,p99Ms:samples[Math.floor(n*.99)],maxMs:samples.at(-1),operationsPerSecond:n/total*1000,budgetMs:16.7,budgetMet:p95<16.7}
}
const output={capturedAt:new Date().toISOString(),reader:'Codex primary; exact model/effort unavailable',sourceCommit:execFileSync('rtk',['proxy','git','rev-parse','HEAD'],{encoding:'utf8'}).trim(),uncommitted:!!execFileSync('rtk',['proxy','git','status','--porcelain'],{encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(['src/bcl-tx.ts','src/bcl-document.ts','src/editors/bcontrol/bcr32/CustomProgramEditor.tsx'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,node:process.version},scope:'Initial local codec baseline, not a before/after improvement or physical MIDI/paint measurement; pure module with no sender',results:[run('simple parse + preview',simple,5000),run('51KB source parse + preview',large,1000),run('opaque retention','.tx $F0 $7D cks-1 2 $F7\n.vendor-extension 42',5000)]}
const file=process.argv[2]??'output/performance/bcl-sysex/codec.json';mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2))
