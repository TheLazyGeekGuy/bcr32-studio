// Presets › On this computer: the browser library keeps the user's order (drag or ↑ ↓), and that order survives an
// export followed by a re-import. Import never overwrites: imported presets get new identifiers and are appended.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-library-')),file=join(dir,'b.cjs')
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';export {LibraryList} from './src/editors/bcontrol/bcr32/LibraryList';export {movePreset,makePreset,libraryFile,parseLibrary,emptyLabels,emptyValues} from './src/editors/bcontrol/bcr32/presets';export {createProfile} from './src/editors/bcontrol/bcr32/profile';export {ledModes} from './src/editors/bcontrol/bcr32/led-modes';export {React,renderToStaticMarkup}`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:file,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'})
const m=createRequire(import.meta.url)(file);rmSync(dir,{recursive:true})

// Moves.
assert.deepEqual(m.movePreset(['a','b','c','d'],3,0),['d','a','b','c'],'last to first')
assert.deepEqual(m.movePreset(['a','b','c','d'],0,2),['b','c','a','d'],'down two')
for(const [from,to] of [[0,0],[-1,1],[1,4],[1.5,0],[0,NaN]])assert.deepEqual(m.movePreset(['a','b','c'],from,to),['a','b','c'],`no-op ${from}→${to}`)
const source=['a','b'];m.movePreset(source,0,1);assert.deepEqual(source,['a','b'],'the input list is not mutated')

// Order survives export → re-import; import appends with new identifiers (the workbench rule).
const state={profile:m.createProfile(),labels:m.emptyLabels(),values:m.emptyValues(),ringMode:m.ledModes[0]}
const library=['Live','Studio','Drums'].map((name,i)=>m.makePreset(state,name,`id-${i}`,`2026-10-2${i}T10:00:00.000Z`))
const reordered=m.movePreset(library,2,0)
const exported=JSON.stringify(m.libraryFile(reordered))
const reimported=m.parseLibrary(JSON.parse(exported))
assert.deepEqual(reimported.map(p=>p.name),['Drums','Live','Studio'],'order kept by the exported file')
assert.deepEqual(reimported,reordered,'re-import is identical to what was exported')
assert.throws(()=>m.parseLibrary(JSON.parse(JSON.stringify(m.libraryFile([...library,library[0]])))),/Duplicate/,'a file with duplicated identifiers is refused')
const workbench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8')
assert.match(workbench,/const imported = incoming\.map\(p => \(\{ \.\.\.p, id: crypto\.randomUUID\(\) \}\)\)[^]*storeLibrary\(\[\.\.\.presets, \.\.\.imported\]\)/,'import appends copies with new identifiers')
assert.match(workbench,/<LibraryList presets=\{presets\} activeId=\{presetId\} recall=\{recallPreset\} reorder=\{next => \{ try \{ storeLibrary\(next\)/,'reordering is saved through storeLibrary (lock-checked, persisted first)')
const browser=workbench.slice(workbench.indexOf('<div className="browser-presets"'),workbench.indexOf('<div className="preset-save-sheet"'))
assert.ok(browser.includes('>Export</button>')&&browser.includes('>Import<input type="file"'),'export and import next to the list')

// List rendering: one row per preset, draggable, active row marked, move buttons bounded.
const html=m.renderToStaticMarkup(m.React.createElement(m.LibraryList,{presets:reordered,activeId:'id-0',recall(){},reorder(){}}))
assert.equal((html.match(/<li draggable="true"/g)??[]).length,3,'three draggable rows')
assert.match(html,/<li draggable="true" data-active="true">[^]*?Live/,'active preset marked')
assert.match(html,/aria-label="Move up" title="Move up" disabled=""/,'first row cannot move up')
assert.match(html,/aria-label="Move down" title="Move down" disabled=""[^]*<\/ol>$/,'last row cannot move down')
const locked=m.renderToStaticMarkup(m.React.createElement(m.LibraryList,{presets:reordered,activeId:'',recall(){},reorder(){},disabled:true}))
assert.ok(!locked.includes('draggable="true"')&&(locked.match(/disabled=""/g)??[]).length===6,'locked: no drag, no move')
assert.match(m.renderToStaticMarkup(m.React.createElement(m.LibraryList,{presets:[],activeId:'',recall(){},reorder(){}})),/No preset on this computer yet\./,'empty library says so')
console.log('PASS BCR32 library: drag or ↑ ↓ reorders without loss, the order survives export and re-import, import appends copies with new identifiers, locked editors cannot reorder')
