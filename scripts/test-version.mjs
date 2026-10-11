import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'))
assert.match(pkg.version,/^\d+\.\d+\.\d+$/)
assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version)
assert.equal(pkg.name,'bcr32-studio')
assert.ok(read('CHANGELOG.md').split('\n').some(line=>line.startsWith(`## [${pkg.version}]`)),'CHANGELOG.md has a heading starting with ## [version]')
assert.ok(read('README.md').split('\n').includes(`Current version: **${pkg.version}** · [Changelog](CHANGELOG.md)`),'README.md has the exact current-version line')
const native=createRequire(import.meta.url),cache=new Map()
function load(name){
  if(!name.startsWith('.'))return native(name)
  if(cache.has(name))return cache.get(name)
  const base=fileURLToPath(new URL(`../src/${name.replace(/^\.\//,'')}`,import.meta.url))
  if(name.endsWith('.json'))return JSON.parse(readFileSync(base,'utf8'))
  const code=ts.transpileModule(readFileSync(existsSync(`${base}.tsx`)?`${base}.tsx`:`${base}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const exports={};cache.set(name,exports);new Function('require','exports',code)(load,exports);return exports
}
// The App reads its draft from window.localStorage (every access is try/catch'd), so a Map-backed shim
// lets a static render show a stored firmware next to the Studio version.
const store=new Map()
globalThis.window={localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}}
const App=load('./App').default,{createProfile}=load('./profile')
const render=firmware=>{store.clear();if(firmware)store.set('bcr32-studio.profile.v1',JSON.stringify({...createProfile(),device:{model:'BCR-32',firmwareObserved:firmware}}));return renderToStaticMarkup(React.createElement(App))}
const fresh=render(null)
assert.ok(fresh.includes(`<span class="firmware-status studio-version" data-i18n-skip="true">Studio v${pkg.version}</span>`),'Studio version shown from package.json')
assert.ok(!fresh.includes('Firmware:')&&!fresh.includes('0.56.0'),'No firmware shown before the device replied; none is hard-coded')
for(const firmware of ['0.56.0','9.9.9']){
  const html=render(firmware)
  assert.ok(html.includes(`Studio v${pkg.version}`)&&!html.includes(`Studio v${firmware}`),'Studio version unaffected by the stored firmware')
  assert.ok(html.includes(`<span class="firmware-status"><span>Firmware:</span> ${firmware}</span>`),'Firmware shown from the profile, distinct from the Studio version')
}
// The observed firmware must not survive as a literal in the app (code or catalog); only comments may cite it.
const srcDir=new URL('../src/',import.meta.url)
for(const file of readdirSync(srcDir).filter(f=>/\.tsx?$/.test(f))){
  const code=readFileSync(new URL(file,srcDir),'utf8').split('\n').filter(line=>!/^\s*(\/\/|\/?\*)/.test(line)).join('\n')
  assert.ok(!code.includes('0.56.0'),`Hard-coded firmware literal in src/${file}`)
}
console.log(`PASS: Studio ${pkg.version}, lockfile, changelog, README and rendered UI synchronized; firmware rendered from the profile, never from package.json or a source literal`)
