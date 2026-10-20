import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/themes.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const module={};new Function('exports',code)(module)
const {themes,parseTheme,loadTheme,themeStorageKey}=module
assert.equal(themes.length,7);assert.equal(new Set(themes.map(t=>t.id)).size,7)
assert.deepEqual(themes.slice(0,6).map(t=>t.id),['original','graphite','glacier','amethyst','brass','silver'],'Existing themes are unchanged; Midnight is additive')
for(const t of themes)assert.equal(parseTheme(t.id),t.id)
for(const t of [null,undefined,'unknown',{},0])assert.equal(parseTheme(t),'original')
assert.equal(loadTheme(),'original')
globalThis.window={localStorage:{getItem:key=>key===themeStorageKey?'glacier':null}}
assert.equal(loadTheme(),'glacier')
globalThis.window.localStorage.getItem=()=>{throw Error('storage blocked')};assert.equal(loadTheme(),'original')
delete globalThis.window
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
assert.match(css,/\.editor-brand::before\s*\{\s*filter:var\(--panel-filter\)/)
assert.match(css,/\.panel-plate\s*\{[^}]*filter:var\(--panel-filter\)/,'Themes tint the procedural plate')
assert.ok(!/\.front-panel\s*\{[^}]*filter:/.test(css),'Do not filter interactive layer / USB / OLED')
for(const t of themes.filter(t=>t.id!=='original'))assert.ok(css.includes(`[data-theme=${t.id}]`))
console.log('PASS: seven valid themes, additive Midnight, safe persistence/fallback, plate+bezel filter only, interactive states unaffected, rendered swatches follow the stored theme')
// Swatches checked on the rendered App: seven titled buttons, only the stored theme pressed.
const {existsSync}=await import('node:fs'),{createRequire}=await import('node:module'),React=(await import('react')).default,{renderToStaticMarkup}=await import('react-dom/server')
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
const swatches=stored=>{globalThis.window={localStorage:{getItem:key=>key===themeStorageKey?stored:null,setItem(){},removeItem(){}}};try{const html=renderToStaticMarkup(React.createElement(App));return html.slice(html.indexOf('<div class="theme-swatches"'),html.indexOf('</div>',html.indexOf('<div class="theme-swatches"')))}finally{delete globalThis.window}}
for(const [stored,pressed] of [[null,'original'],['glacier','glacier']]){
  const html=swatches(stored)
  assert.equal((html.match(/<button class="theme-swatch swatch-/g)??[]).length,7,'Seven swatches rendered')
  for(const t of themes)assert.ok(html.includes(`class="theme-swatch swatch-${t.id}" aria-label="Theme ${t.name}" aria-pressed="${t.id===pressed}" title="${t.name}"`),`${t.id} swatch, pressed=${t.id===pressed} when stored=${stored}`)
}
assert.match(css,/\.theme-swatch:focus-visible \.swatch-tooltip/)
assert.ok(css.includes('.studio[data-theme=silver] .silver-dial-label'))
