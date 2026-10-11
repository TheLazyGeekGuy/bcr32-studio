import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const native=createRequire(import.meta.url),cache=new Map()
function load(name){if(!name.startsWith('./'))return native(name);if(cache.has(name))return cache.get(name);const base=fileURLToPath(new URL(`../src/${name.slice(2)}`,import.meta.url));const exports={};cache.set(name,exports);new Function('require','exports',ts.transpileModule(readFileSync(existsSync(`${base}.tsx`)?`${base}.tsx`:`${base}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(load,exports);return exports}
const {createProfile}=load('./profile'),{emptyLabels}=load('./presets'),{controlSearchOptions:search}=load('./control-search')
const p=createProfile(),labels=emptyLabels()
assert.equal(search(p,labels).length,90)
assert.equal(search(p,labels,'footsw 1')[0].key,'buttons:74')
assert.equal(search(p,labels,'footsw 1').length,1,'CH1 must not also match FOOTSW2')
assert.equal(search(p,labels,'push 8')[0].key,'pushes:8')
assert.equal(search(p,labels,'encodeur 32')[0].key,'encoders:32')
assert.ok(search(p,labels,'clock').some(o=>o.key==='encoders:2'))
labels.encoders[0]='Cutoff Überblendung';p.encoders[0]={...p.encoders[0],type:'cc',parameter:74}
assert.equal(search(p,labels,'cutoff uberblendung')[0].key,'encoders:1','Diacritics ignored in the query')
assert.ok(search(p,labels,'CC74').some(o=>o.key==='encoders:1'))
assert.ok(search(p,labels,'bpm').some(o=>o.key==='encoders:1'),'Original name remains searchable')
assert.deepEqual(search(p,labels,'nonexistent'),[])
// What the user sees in de/fr/… must be typeable: translated titles join the index, French aliases stay.
assert.equal(search(p,labels,'druck','de').length,32);assert.equal(search(p,labels,'druck','en').length,0)
assert.ok(search(p,labels,'touche 65','en').some(o=>o.key==='buttons:65'),'French alias works in English')
assert.ok(search(p,labels,'taste 65','de').some(o=>o.key==='buttons:65'));assert.ok(search(p,labels,'encoder 1','ja').some(o=>o.key==='encoders:1'))
assert.ok(search(p,labels,'encodeur 32','de').some(o=>o.key==='encoders:32'),'French alias still works in German')
const html=renderToStaticMarkup(React.createElement(load('./ControlSearch').ControlSearch,{profile:p,labels,selection:{kind:'encoders',id:1},select(){}}))
assert.match(html,/<input type="text" role="combobox" aria-label="Control search" aria-autocomplete="list" aria-expanded="false" aria-controls="[^"]+"/,'Closed combobox semantics')
assert.ok(html.includes('value="Encoder 1 · Cutoff Überblendung"'),'Current selection shown with its custom label')
assert.ok(!html.includes('role="listbox"')&&!html.includes('aria-activedescendant'),'Results list closed until focus')
// Keyboard navigation needs a DOM renderer to exercise; until one exists these stay source-level guards.
const component=readFileSync(new URL('../src/ControlSearch.tsx',import.meta.url),'utf8')
for(const feature of ['role="listbox"','aria-activedescendant','ArrowDown','ArrowUp',"e.key==='Enter'","e.key==='Escape'",'onBlur'])assert.ok(component.includes(feature),feature)
assert.ok(component.includes("e.key==='Escape'&&open"),'Closed search must allow Escape to cancel panel selection')
console.log('PASS: 90 controls, names, aliases, custom labels, accents, CC and keyboard combobox semantics')
