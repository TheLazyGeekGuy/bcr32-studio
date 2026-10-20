import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const native = createRequire(import.meta.url), cache = new Map()
function load(name) {
  if (!name.startsWith('.')) return native(name)
  if (cache.has(name)) return cache.get(name)
  const base = fileURLToPath(new URL(`../src/${name.replace(/^\.\//, '')}`, import.meta.url))
  if (name.endsWith('.json')) return JSON.parse(readFileSync(base, 'utf8'))
  const code = ts.transpileModule(readFileSync(existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports={};cache.set(name,exports);new Function('require','exports',code)(load,exports);return exports
}
const {createProfile,parseProfile,typesFor,modesFor}=load('./profile')
const {emptyLabels,emptyValues,parseControllerState,controlIndex}=load('./presets')
const {brightnessQuery,brightnessWrite,brightnessReply}=load('./led-brightness')
const p=createProfile()
assert.deepEqual(p.buttons.slice(20).map(b=>b.id),[65,66,67,68,74,75])
assert.equal(controlIndex('buttons',65),20);assert.equal(controlIndex('buttons',75),25)
assert.ok(!typesFor(false).includes('pb'));assert.ok(!typesFor(true).includes('note'));assert.ok(!typesFor(true).includes('mmc'))
assert.deepEqual(modesFor('gs',false),['momentary','toggle'])
assert.deepEqual(modesFor('pc',true),['absolute'])
const old={profile:{...p,settings:undefined,buttons:p.buttons.slice(0,20)},labels:{...emptyLabels(),buttons:Array(20).fill('old')},values:{...emptyValues(),buttons:Array(20).fill(12)},ringMode:'bar'}
const upgraded=parseControllerState(old)
assert.equal(upgraded.profile.buttons.length,26);assert.equal(upgraded.labels.buttons.length,26);assert.equal(upgraded.labels.buttons[20],'');assert.equal(upgraded.values.buttons[20],null);assert.equal(upgraded.values.buttons[0],12)
p.buttons[20]={...p.buttons[20],type:'mmc',display:false,mmc:{deviceId:'all',command:'Location',locate:[1,2,3,4],frameRate:'25'}}
p.buttons[24]={...p.buttons[24],type:'at',aftertouchAll:true}
p.settings.outputRouting='USB & MIDI A';p.settings.thruSource='midi';p.settings.thruFiltered=true
assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(p))),p)
for(const change of [{deviceId:256},{outputRouting:'bogus'},{footswitchModes:['ctrl']},{thruFiltered:'yes'}])assert.throws(()=>parseProfile({...p,settings:{...p.settings,...change}}))
assert.throws(()=>parseProfile({...p,buttons:p.buttons.map(b=>({...b,display:'yes'}))}))
// Imported/stored firmware is shown as observed only when it has a version shape.
for(const fw of ['0.56.0','9.9.9'])assert.equal(parseProfile({...p,device:{model:'BCR-32',firmwareObserved:fw}}).device.firmwareObserved,fw)
for(const fw of [42,true,'','v0.56','0.56.0-beta','<b>x</b>',null,undefined])assert.equal(parseProfile({...p,device:{model:'BCR-32',firmwareObserved:fw}}).device.firmwareObserved,null,String(fw))
assert.throws(()=>parseProfile({...p,buttons:p.buttons.map(b=>({...b,mmc:{deviceId:127,command:'Play',locate:[0,0,0,0],frameRate:'24'}}))}))
assert.deepEqual(brightnessQuery,[240,0,32,50,127,100,64,247])
for(const n of [0,5,15]){const m=brightnessWrite(n);assert.deepEqual(m,[240,0,32,50,127,100,64,n,247]);assert.equal(brightnessReply(m),n)}
for(const n of [-1,16,1.5,NaN])assert.throws(()=>brightnessWrite(n))
for(const m of [[],brightnessQuery,[240,0,32,50,127,100,64,16,247],[240,0,32,50,127,101,64,5,247]])assert.equal(brightnessReply(m),null)
// App shell rendered statically: default state is the Control tab with Encoder 1 selected.
const html = renderToStaticMarkup(React.createElement(load('./App').default))
const nav = html.slice(html.indexOf('<nav class="tool-tabs"'), html.indexOf('</nav>'))
const tabs = [...nav.replace(/<svg[\s\S]*?<\/svg>/g, '').matchAll(/<button aria-pressed="(true|false)" title="[^"]*">([^<]*)<\/button>/g)].map(m => [m[2], m[1] === 'true'])
assert.deepEqual(tabs, [['Control', true], ['Presets', false], ['Files', false], ['Config', false], ['Log', false], ['Help', false]], 'Six tool tabs (rail), Config before Log, Help last, no MIDI tab, Control active by default')
assert.ok(!html.includes('Provisional push'))
const inspector = html.indexOf('<section class="inspector" aria-label="Edit encoders 1">')
assert.ok(inspector >= 0 && !/class="inspector" hidden/.test(html), 'Inspector shown while Control is the active tab')
for (const pane of ['class="profile-actions preset-panel" hidden="" aria-label="Preset management"', 'class="profile-actions config-appearance" hidden=""', 'class="profile-actions preset-panel" hidden="" aria-label="Imports and exports"', 'class="ports" hidden=""', 'class="log" hidden=""']) assert.ok(html.includes(pane), 'Other tool panes hidden while Control is active: ' + pane)
const combobox = html.indexOf('role="combobox"')
assert.ok(inspector < combobox && combobox < html.indexOf('class="eyebrow"', inspector), 'Control search sits at the top of the inspector')
assert.ok(!html.includes('aria-label="Config control"'))
assert.match(html.slice(inspector), /<label class="zoom-option" data-i18n-skip="true"><input type="checkbox" checked=""\/>Display On\/Off<\/label>/, 'Per-control Display toggle available in Control')
// Tab switching on selection is a click behaviour; without a DOM renderer these two stay source-level guards.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(app.includes("if(!preserveTab)setTab('control')"), 'Every facade control opens Control, including extra keys')
assert.ok(app.includes("select={s=>{selectUi(s,{},true);setTab('control')}}"), 'Config shortcuts open Control')
// STORE must be absent from what the browser actually runs, so check the built bundle rather than the source:
// a source grep trips on comments and misses a byte reached through a constant. Frames minify to decimal
// arrays, with the SysEx prefix F0 00 20 32 7F 64 (Behringer manufacturer ID, device, product) hoisted into a shared constant that is spread.
const root = fileURLToPath(new URL('..', import.meta.url)), out = mkdtempSync(join(tmpdir(), 'bcr32-dist-'))
let bundle
try {
  const build = spawnSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' })
  assert.equal(build.status, 0, 'vite build')
  bundle = readdirSync(join(out, 'assets')).filter(f => f.endsWith('.js')).map(f => readFileSync(join(out, 'assets', f), 'utf8')).join('\n')
} finally { rmSync(out, { recursive: true, force: true }) }
const command = byte => new RegExp(`(?:240,0,32,50,127,100|\\.\\.\\.[\\w$]+),${byte}[,\\]]`)
assert.match(bundle, command(0x40), 'Witness: the brightness frame is in the bundle, so the frame encoding is the one searched')
assert.doesNotMatch(bundle, command(0x72), 'No STORE command (0x72) in the browser bundle')
assert.doesNotMatch(bundle, command(0x77), 'No bootloader command (0x77) in the browser bundle')
console.log('PASS: Config metadata, special controls/footswitches, legacy state migration, modes/types, persistence validation, verified brightness frames, rendered tool tabs/inspector, no STORE in the built bundle')
