// BCR32 sidebar layout: a one-line connection summary above the tabs (details live in the MIDI window) and one fixed
// status bar for feedback on every tab; on narrow screens the tabs and the status bar stay on screen while scrolling.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const workbench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8'),css=readFileSync('src/editors/bcontrol/bcr32/workbench.css','utf8')
const top=workbench.slice(workbench.indexOf('<aside className="sidebar"'),workbench.indexOf('<nav className="tool-tabs"'))
assert.ok(top.length>0,'sidebar top found')
assert.match(top,/<button className="connection-summary" aria-haspopup="dialog"[^>]*onClick=\{\(\)=>setMidiSettingsOpen\(true\)\}>/,'connection summary opens the MIDI window')
for(const moved of ['<FirmwareIdentity','studio-version','routing-status'])assert.ok(!top.includes(moved),`sidebar top no longer holds ${moved}`)
const dialog=workbench.slice(workbench.indexOf('<dialog ref={midiSettingsDialog}'),workbench.indexOf('</dialog>'))
for(const kept of ['<FirmwareIdentity','className="routing-status"',"indicators.routeSource === 'bcl'"])assert.ok(dialog.includes(kept),`MIDI window holds ${kept}`)
assert.match(workbench,/\{tab==='help'&&<><Bcr32Help\/><p className="muted studio-version" data-i18n-skip>Studio v\{studioVersion\}<\/p><\/>\}/,'Studio version shown under the help')
assert.equal(workbench.match(/className="sidebar-notice"/g)?.length,1,'one notice')
assert.match(workbench,/<\/fieldset><\/div>\s*<footer className="sidebar-meta sidebar-statusbar"><p className="sidebar-notice" role="status" title=\{notice\}>\{notice\}<\/p><\/footer>\s*<\/aside>/,'notice is a status bar after the scrolling content, on every tab')
const narrow=[...css.matchAll(/@media\(max-width:760px\)\{([^]*?)\n\}/g)].map(m=>m[1]).join('\n')
assert.match(narrow,/\.sidebar>\.tool-tabs\{position:sticky;top:0;/,'tabs stick to the top on narrow screens')
assert.match(narrow,/\.sidebar>\.sidebar-statusbar\{position:sticky;bottom:0;/,'status bar sticks to the bottom on narrow screens')
assert.match(narrow,/\.studio\.standalone-editor>\.bcr32-workbench\{[^}]*overflow:clip visible/,'standalone wrapper is not a scroll container on narrow screens (sticky would bind to it)')
console.log('PASS BCR32 sidebar: one-line connection summary opening the MIDI window (firmware, version and routing moved out), notice in a status bar after the content, sticky tabs and status bar on narrow screens')
