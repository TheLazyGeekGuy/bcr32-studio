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
assert.match(workbench,/\{helpOpen&&<section className="help-view"><button className="help-back" onClick=\{\(\)=>setHelpOpen\(false\)\}>← Back<\/button><Bcr32Help\/><p className="muted studio-version" data-i18n-skip>Studio v\{studioVersion\}<\/p><\/section>\}/,'Documentation opens the help with a Back button and the Studio version')
assert.equal(workbench.match(/className="sidebar-notice"/g)?.length,1,'one notice')
assert.match(workbench,/<\/fieldset><\/div>\s*<footer className="sidebar-meta sidebar-statusbar"><p className="sidebar-notice" role="status" title=\{notice\}>\{notice\}<\/p><\/footer>\s*<\/aside>/,'notice is a status bar after the scrolling content, on every tab')
const narrow=[...css.matchAll(/@media\(max-width:760px\)\{([^]*?)\n\}/g)].map(m=>m[1]).join('\n')
assert.match(narrow,/\.sidebar>\.tool-tabs\{position:sticky;top:0;/,'tabs stick to the top on narrow screens')
assert.match(narrow,/\.sidebar>\.sidebar-statusbar\{position:sticky;bottom:0;/,'status bar sticks to the bottom on narrow screens')
assert.match(narrow,/\.studio\.standalone-editor>\.bcr32-workbench\{[^}]*overflow:clip visible/,'standalone wrapper is not a scroll container on narrow screens (sticky would bind to it)')
console.log('PASS BCR32 sidebar: one-line connection summary opening the MIDI window (firmware, version and routing moved out), notice in a status bar after the content, sticky tabs and status bar on narrow screens')

// Editor toolbar (steps 3–4): history, CC sending, one floating display and the Display menu sit above the front panel.
const surface=workbench.slice(workbench.indexOf('<section className="surface"'),workbench.indexOf('<FrontPanel '))
for(const part of ['className="editor-toolbar" role="toolbar"',"moveHistory('undo')","moveHistory('redo')",'className={`cc-toggle ','{floatingSupported() && <button className="floating-toggle"','className="display-menu-toggle" aria-haspopup="dialog" aria-expanded={displayOpen}'])assert.ok(surface.includes(part),`toolbar holds ${part}`)
const sidebarTop=workbench.slice(workbench.indexOf('<aside className="sidebar"'),workbench.indexOf('<div className="sidebar-content">'))
for(const moved of ['cc-toggle','editor-history-tools','floating-toggle','theme-swatches'])assert.ok(!sidebarTop.includes(moved),`sidebar no longer holds ${moved}`)
assert.match(surface,/<div className="display-menu" role="dialog"[^>]*>.*?<fieldset className="host-lock-fields" disabled=\{locked\}>/s,'Display menu keeps the host lock')
assert.match(surface,/disabled=\{locked\|\|!historyCounts\.undo\}[^]*disabled=\{locked\|\|!historyCounts\.redo\}/,'undo and redo stay locked with the host')
assert.equal(workbench.match(/>Zoom while adjusting</g)?.length,1,'one zoom option')
assert.match(surface,/<PresentationTools preferences=\{presentation\} screens=\{sharedScreens\} inline zoom=\{false\} floating=\{!floatingSupported\(\)\}\/>/,'host presentation tools without a second zoom; host floating window only as a fallback')
assert.ok(!dialog.includes('cc-toggle')&&dialog.includes('className="midi-settings-cc" role="status"'),'MIDI window shows the CC state only')
assert.match(workbench,/if\(displayOpen\)\{setDisplayOpen\(false\);event\.preventDefault\(\)\}/,'Escape closes the Display menu first')
console.log('PASS BCR32 editor toolbar: history, CC sending, floating display and Display menu above the panel; one zoom option; menu keeps the host lock; MIDI window shows the CC state')

// Files (step 7) and help (step 8): three blocks and one flat Advanced disclosure; Documentation opens the help over the tab.
const files=workbench.slice(workbench.indexOf('<h2>Files</h2>'),workbench.indexOf('<section className="inspector"'))
assert.deepEqual([...files.matchAll(/<h3>([^<]+)<\/h3>/g)].map(x=>x[1]),['Export','Import'],'Export and Import blocks')
assert.ok(files.includes('<ExportImport '),'front-panel export block')
assert.equal(files.match(/<details/g)?.length,1,'one disclosure in Files')
assert.match(files,/<details className="files-advanced"><summary>Advanced<\/summary>[^]*<FirmwareTools [^]*download=\{download\} flat \/>[^]*<ParameterTable [^>]*flat \/>[^]*Legacy profile format[^]*<\/details>/,'firmware tools, parameter names and legacy format flat under Advanced')
for(const f of ['FirmwareTools','ParameterNames']){const src=readFileSync(`src/editors/bcontrol/bcr32/${f}.tsx`,'utf8');assert.match(src,/const Box = \(flat \? 'section' : 'details'\) as 'details', Title = \(flat \? 'h4' : 'summary'\) as 'summary'/,`${f} renders flat on request`)}
assert.match(workbench,/onHelpReady\(\(\)=>setHelpOpen\(true\)\)/,'Documentation opens the help view')
assert.match(workbench,/onClick=\{\(\) => \{setTab\(item\);setHelpOpen\(false\)\}\}/,'a tab closes the help view')
assert.ok(!/setTab\('help'\)/.test(workbench),'no Help tab state left')
console.log('PASS BCR32 Files and help: Export, Import, front-panel export and one flat Advanced disclosure; Documentation opens the help over the current tab, a tab closes it')
