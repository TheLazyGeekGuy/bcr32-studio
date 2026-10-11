import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
const result=await build({entryPoints:[new URL('../src/multi-selection.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'})
const m=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const pResult=await build({entryPoints:[new URL('../src/profile.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'})
const {createProfile}=await import(`data:text/javascript;base64,${Buffer.from(pResult.outputFiles[0].text).toString('base64')}`)
const p=createProfile(),enc=id=>({kind:'encoders',id}),push=id=>({kind:'pushes',id}),button=id=>({kind:'buttons',id})
assert.deepEqual(m.selectControls([enc(1)],enc(3),enc(1),{toggle:true},p),[enc(1),enc(3)])
assert.deepEqual(m.selectControls([enc(1),enc(3)],enc(3),enc(1),{toggle:true},p),[enc(1)])
assert.deepEqual(m.selectControls([enc(1)],enc(1),enc(1),{toggle:true},p),[enc(1)])
const rect={x1:20,y1:460,x2:520,y2:870}
assert.deepEqual(m.controlsInRectangle(p,'encoders',rect),[enc(1),enc(2),enc(3),enc(9),enc(10),enc(11)])
assert.deepEqual(m.controlsInRectangle(p,'encoders',{x1:520,y1:870,x2:20,y2:460}),m.controlsInRectangle(p,'encoders',rect))
assert.deepEqual(m.controlsInRectangle(p,'pushes',rect),[push(1),push(2),push(3),push(9),push(10),push(11)])
assert.deepEqual(m.controlsInRectangle(p,'buttons',{x1:1400,y1:1050,x2:1700,y2:1300}),[button(65),button(66),button(67),button(68)])
assert.deepEqual(m.controlsInRectangle(p,'encoders',{x1:0,y1:0,x2:10,y2:10}),[])
assert.equal(m.controlsInRectangle(p,'encoders',{x1:0,y1:0,x2:1717,y2:1440}).length,56)
assert.deepEqual(m.selectControls([enc(1)],enc(4),enc(1),{range:true},p),[enc(1),enc(2),enc(3),enc(4)])
assert.deepEqual(m.selectControls([enc(1)],enc(4),enc(2),{toggle:true,range:true},p),[enc(1),enc(2),enc(3),enc(4)])
assert.deepEqual(m.selectControls([button(65)],button(74),button(65),{range:true},p),[button(65),button(66),button(67),button(68),button(74)])
p.encoders[0].parameter=10;p.encoders[1].parameter=74
const list=[enc(1),enc(2)]
let n=m.applySelectionChange(p,list,{type:'cc',mode:'rel2',ledMode:'spread',channel:3})
assert.deepEqual(n.encoders.slice(0,2).map(e=>[e.type,e.mode,e.ledMode,e.channel,e.parameter]),[['cc','rel2','spread',3,10],['cc','rel2','spread',3,74]])
assert.equal(n.encoders[2],p.encoders[2]);assert.equal(p.encoders[0].type,'off')
assert.throws(()=>m.applySelectionChange(p,list,{parameter:99}),/The parameter cannot be edited/)
for(const change of [{parameterOff:true},{aftertouchAll:true},{mmc:{command:'Stop'}}])assert.throws(()=>m.applySelectionChange(p,list,change),/The parameter cannot be edited/)
assert.equal(m.applySelectionChange(p,[enc(1)],{parameter:99}).encoders[0].parameter,99)
assert.throws(()=>m.applySelectionChange(p,[enc(1),push(1)],{type:'pb'}),/incompatible/)
n=m.applySelectionChange(p,[enc(1),push(1)],{ledMode:'pan'})
assert.equal(n.encoders[0].ledMode,'pan');assert.equal(n.pushes[0].ledMode,undefined)
const high={...p,encoders:p.encoders.map(e=>({...e,type:'nrpn',parameter:500}))}
assert.throws(()=>m.applySelectionChange(high,list,{type:'cc'}),/Existing parameters are incompatible/)
assert.equal(high.encoders[0].parameter,500)
assert.throws(()=>m.applySelectionChange(n,list,{type:'cc',mode:'abs_14'}),/0–31/)
assert.equal(m.sharedField(['cc','cc']),'cc');assert.equal(m.sharedField(['cc','nrpn']),'')
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../src/FrontPanel.tsx',import.meta.url),'utf8')
// Toggle checked on the rendered App (off by default); the Escape/"Single" handlers need a DOM renderer, so those stay source-level guards.
const React=(await import('react')).default,{renderToStaticMarkup}=await import('react-dom/server'),{existsSync}=await import('node:fs'),{createRequire}=await import('node:module'),ts=(await import('typescript')).default
const native=createRequire(import.meta.url),cache=new Map()
function load(name){
  if(!name.startsWith('.'))return native(name)
  if(cache.has(name))return cache.get(name)
  const base=new URL(`../src/${name.replace(/^\.\//,'')}`,import.meta.url).pathname
  if(name.endsWith('.json'))return JSON.parse(readFileSync(base,'utf8'))
  const out=ts.transpileModule(readFileSync(existsSync(`${base}.tsx`)?`${base}.tsx`:`${base}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const exports={};cache.set(name,exports);new Function('require','exports',out)(load,exports);return exports
}
const App=load('./App').default
assert.ok(renderToStaticMarkup(React.createElement(App)).includes('<button aria-pressed="false">Multi-select</button>'),'Mouse multi-select toggle rendered, off by default')
assert.ok(app.includes('setMouseMulti(false);selectUi(selection,{},true)'),'Escape and "Single" leave mouse multi-select')
assert.ok(panel.includes('toggle:mouseMulti||event.metaKey||event.ctrlKey'))
assert.ok(panel.includes('if (mouseMulti || event.button !== 0'),'Mouse selection must not start a value drag')
assert.ok(panel.includes('event.currentTarget.focus({preventScroll:true})'),'Marquee owns keyboard focus for cancellation')
assert.ok(panel.includes('!autoZoom || mouseMulti'),'Zoom cannot obstruct mouse multiselect')
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
assert.match(css,/\.front-panel \{ user-select:none;/)
assert.match(css,/\.front-panel input \{ user-select:text;/)
assert.match(css,/\.selection-rectangle \{[^}]*pointer-events:none;/)
console.log('PASS: add/remove/range/mixed groups, atomic batch changes, independent CC numbers, parameter guard, invalid type rejection, rotation-only LEDs and mixed values')
