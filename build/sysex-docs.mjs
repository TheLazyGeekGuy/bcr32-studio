import {readFileSync} from 'node:fs'
import {marked} from 'marked'
import {build} from 'esbuild'

const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const root='docs/formats/sysex-map-v1/'
const downloads=['tx81z.sxm.json','microwave.sxm.json','fs1r.sxm.json','encoding-demo.sxm.json','vectors.json','reference-renderer.py']
const pages=[['SPECIFICATION.md','index.html','Specification'],['ARCHITECTURE.md','architecture.html','Architecture'],['INTEGRATION.md','integration.html','Integration'],['../../SYNTH-SYSEX-CATALOG.md','catalogue.html','20-synth catalogue']]
const style=`:root{color-scheme:dark;--bg:#0c0f12;--surface:#14181e;--ink:#eef1f5;--muted:#a7b1be;--line:#333d49;--accent:#f0a33a}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,sans-serif}header,main,footer{max-width:1080px;margin:auto;padding:28px}header{border-bottom:1px solid var(--line)}nav,.downloads{display:flex;gap:12px 24px;flex-wrap:wrap}nav{margin-top:18px}a{color:var(--accent);text-underline-offset:3px}a[aria-current]{color:var(--ink);font-weight:700}.brand{font-size:20px;font-weight:750;text-decoration:none}.downloads{padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:6px;margin:24px 0}h1,h2,h3{line-height:1.25;scroll-margin-top:20px}h1{font-size:clamp(28px,5vw,42px)}h2{margin-top:48px}h3{margin-top:32px}pre{overflow:auto;padding:20px;background:#151b23;border:1px solid var(--line);border-radius:6px}code{font:0.9em/1.5 ui-monospace,Menlo,monospace;overflow-wrap:anywhere}pre code{overflow-wrap:normal}table{display:block;overflow:auto;border-collapse:collapse;font-size:14px}th,td{padding:12px;border:1px solid var(--line);text-align:left;min-width:160px}th{background:var(--surface)}p,li{max-width:90ch}.meta,footer{color:var(--muted);font-size:14px}footer{border-top:1px solid var(--line)}@media(max-width:600px){header,main,footer{padding:20px}pre{padding:12px}}`
export function sysexDocsPlugin(){return{name:'sysex-map-documentation',apply:'build',async generateBundle(){
 const emit=(name,source)=>this.emitFile({type:'asset',fileName:'docs/sysex-map/'+name,source})
 emit('style.css',style)
 for(const [source,file,title] of pages){
  let markdown=readFileSync(root+source,'utf8')
  markdown=markdown.replace(/\]\(([^)]+)\)/g,(match,target)=>{
   const route=target.endsWith('SPECIFICATION.md')?'./':target.endsWith('ARCHITECTURE.md')?'architecture.html':target.endsWith('INTEGRATION.md')?'integration.html':target.endsWith('src/sysex-map/schema.json')?'schema.json':target.startsWith('formats/sysex-map-v1/')?target.slice('formats/sysex-map-v1/'.length):target.startsWith('work-items/')?'https://github.com/TheLazyGeekGuy/bcr32-studio/blob/main/docs/'+target:null
   return route?`](${route})`:match
  })
  const body=marked.parse(markdown,{gfm:true}),nav=pages.map(([,name,label])=>`<a href="${name==='index.html'?'./':name}"${name===file?' aria-current="page"':''}>${escape(label)}</a>`).join('')
  emit(file,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'"><title>${escape(title)} · SysEx Map · MIDI Studio</title><link rel="stylesheet" href="style.css"></head><body><header><a class="brand" href="../../">MIDI Studio / BCR32 Studio</a><nav aria-label="Documentation">${nav}<a href="../../editor/">Open editor</a></nav></header><main><p class="meta">SysEx Map 1.0 · Open draft · English reference</p><div class="downloads" aria-label="Downloads"><a href="schema.json" download>JSON Schema</a><a href="tx81z.sxm.json" download>TX81Z example</a><a href="microwave.sxm.json" download>Microwave example</a><a href="sysex-map.mjs" download>Standalone ES module</a><a href="reference-renderer.py" download>Python renderer</a><a href="${source.split('/').at(-1)}" download>Markdown source</a></div><article>${body}</article></main><footer>Proposed interchange format, not an official MIDI standard. Local file operations do not authorize MIDI transmission.</footer></body></html>`)
  emit(source.split('/').at(-1),readFileSync(root+source))
 }
 for(const file of downloads)emit(file,readFileSync(root+file))
 emit('schema.json',readFileSync('src/sysex-map/schema.json'))
 const sdk=await build({entryPoints:['src/sysex-map/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022'})
 emit('sysex-map.mjs',sdk.outputFiles[0].contents)
}}}
