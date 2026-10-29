// BCR32 editor layout, as in the approved mockup of 2026-10-24: the host header carries the connection status and the
// MIDI icon; a toolbar above the front panel holds history, the CC and assignment switches, the floating display, the
// Display menu and the panel toggle; the panel starts with text tabs and ends with a fixed status bar. Moved controls
// keep the host lock, and opening a window or a menu sends nothing (checked in the browser separately).
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const workbench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8'),css=readFileSync('src/editors/bcontrol/bcr32/workbench.css','utf8')
const slice=(from,to)=>{const i=workbench.indexOf(from);assert.ok(i>=0,from);const j=workbench.indexOf(to,i);assert.ok(j>i,to);return workbench.slice(i,j)}

// Host header: the MIDI settings icon is a DIN connector.
assert.match(readFileSync('src/editor-host/MidiSettingsButton.tsx','utf8'),/<Icon name="din" \/>/,'MIDI settings icon is a DIN connector')
assert.match(readFileSync('src/Icon.tsx','utf8'),/ din: \['M12 21a9 9 0 1 0 0-18/,'DIN icon drawn')

// Panel: tabs first (no connection line, no icons), a SysEx warning only when SysEx is missing, status bar last.
const top=slice('<aside className="sidebar"','<div className="sidebar-content">')
assert.ok(!top.includes('connection-summary')&&!top.includes('<FirmwareIdentity')&&!top.includes('studio-version')&&!top.includes('routing-status'),'no connection line above the tabs')
assert.match(top,/<nav className="tool-tabs"[^]*\{\['Control', 'Presets', 'Device', 'Files', 'Log'\]\[i\]\}<\/button>\)\}<\/nav>/,'five text tabs')
assert.ok(!/<nav className="tool-tabs"[^]*?<Icon /.test(top.split('</nav>')[0]),'tabs carry no icon')
assert.match(top,/\{!access\?\.sysexEnabled && <p className="mock-warn sidebar-midi-warning">/,'warning only without SysEx')
for(const moved of ['cc-toggle','editor-history-tools','floating-toggle','theme-swatches'])assert.ok(!top.includes(moved),`panel top no longer holds ${moved}`)
const dialog=slice('<dialog ref={midiSettingsDialog}','</dialog>')
for(const kept of ['<FirmwareIdentity','className="routing-status"',"indicators.routeSource === 'bcl'"])assert.ok(dialog.includes(kept),`MIDI window holds ${kept}`)
assert.ok(!dialog.includes('cc-toggle')&&dialog.includes('className="midi-settings-cc" role="status"'),'MIDI window shows the CC state only')
assert.match(dialog,/<fieldset className="midi-settings-at-connection" disabled=\{locked\}>[^]*checked=\{autoReadController\}[^]*checked=\{autoLoadDevice\}/,'connection-time reads in the MIDI window, locked with the host')
assert.equal(workbench.match(/className="sidebar-notice"/g)?.length,1,'one notice')
assert.match(workbench,/<\/fieldset><\/div>\s*<footer className="sidebar-meta sidebar-statusbar"><p className="sidebar-summary"[^]*?'CC → BCR32 on' : 'CC → BCR32 off'[^]*?<\/p><p className="sidebar-notice" role="status" title=\{notice\} hidden=\{notice === initialNotice\}>\{notice\}<\/p><\/footer>\s*<\/aside>/,'status bar after the scrolling content: summary, then the latest action')

// Toolbar above the front panel.
const toolbar=slice('<div className="editor-toolbar" role="toolbar"','<FrontPanel ')
for(const part of ["moveHistory('undo')","moveHistory('redo')",'className={`cc-toggle tb-switch ','CC → BCR32</button>','assignment-toggle','Assignments → BCR32</button>','{floatingScreenSupported() && <button className="floating-toggle" aria-pressed={videoFloating}','className="display-menu-toggle" aria-haspopup="dialog" aria-expanded={displayOpen}','<span className="tb-spacer" />','className="bcr32-tools-toggle"'])assert.ok(toolbar.includes(part),`toolbar holds ${part}`)
assert.match(toolbar,/disabled=\{locked\|\|presetBusy\|\|!historyCounts\.undo\}[^]*disabled=\{locked\|\|presetBusy\|\|!historyCounts\.redo\}/,'undo and redo stay locked with the host')
assert.match(toolbar,/aria-pressed=\{assignmentLive\} disabled=\{locked\}/,'assignment switch locked with the host')
assert.match(toolbar,/<div className="display-menu" role="dialog"[^>]*>.*?<fieldset className="host-lock-fields" disabled=\{locked\|\|presetBusy\}>/s,'Display menu keeps the host lock')
assert.match(toolbar,/<label className="mock-field">Display style<select/,'display style as a list')
assert.match(toolbar,/checked=\{inheritsPresentation\}[^]*?presentationStore\.reset\(\)/,'inherit the global presentation as a checkbox')
assert.match(toolbar,/<PresentationTools preferences=\{presentation\} screens=\{sharedScreens\} inline zoom=\{false\} floating=\{false\}\/>/,'host presentation tools without a second zoom nor a second floating button')
assert.match(toolbar,/onClick=\{\(\) => \{ void toggleVideoFloating\(\) \}\}/,'toolbar floating display is the borderless video picture-in-picture')
assert.match(toolbar,/\{floatingSupported\(\) && <button className="mock-link display-interactive-window"[^]*?toggleFloatingDisplay\(\)/,'interactive browser window offered in the Display menu')
assert.match(toolbar,/checked=\{testMode\} onChange=\{event => setTestMode\(event\.target\.checked\)\} \/>Test mode/,'Test mode option in the Display menu')
assert.equal(workbench.match(/>Zoom while adjusting</g)?.length,1,'one zoom option')
assert.match(workbench,/if\(displayOpen\)\{setDisplayOpen\(false\);event\.preventDefault\(\)\}/,'Escape closes the Display menu first')

// Control tab, in the mockup order: search, kind, name, Rotation/Push, selection, MIDI message, Display, Test, Advanced.
const inspector=slice('<section className="inspector mock-inspector"','<section className="lower">')
const order=['<ControlSearch ','className="mock-caption mock-kind"','className="mock-title"','className="mock-seg"','className="selection-tools mock-selection"','>MIDI message</h3>','>Display</h3>','{testMode && <>','>Test</h3>','<details className="adv"><summary>Advanced</summary>']
const test=inspector.slice(inspector.indexOf('{testMode && <>'),inspector.indexOf('<details className="adv"><summary>Advanced</summary>'))
assert.ok(test.includes('className="value-preview"')&&test.trimEnd().endsWith('</>}'),'the whole Test block, fader included, only in test mode')
order.reduce((at,part)=>{const i=inspector.indexOf(part);assert.ok(i>at,`inspector order: ${part}`);return i},-1)
assert.ok(inspector.slice(inspector.indexOf('<summary>Advanced</summary>')).includes('<ControllerReadValues '),'raw controller read under Advanced')

// Files and help.
const files=slice('<h2 className="sr-only">Files</h2>','<section className="inspector')
assert.deepEqual([...files.matchAll(/<section className="mock-card"[^>]*><b>([^<]+)<\/b>/g)].map(x=>x[1]),['Export','Import'],'Export and Import cards')
assert.ok(files.includes('<ExportImport '),'front-panel export card')
assert.equal(files.match(/<details/g)?.length,1,'one disclosure in Files')
assert.match(files,/<details className="files-advanced adv"><summary>Advanced<\/summary>[^]*<FirmwareTools [^]*download=\{download\} flat \/>[^]*<ParameterTable [^>]*flat \/>[^]*Legacy profile format[^]*<\/details>/,'firmware tools, parameter names and legacy format flat under Advanced')
assert.match(workbench,/\{helpOpen&&<section className="help-view"><button className="help-back" onClick=\{\(\)=>setHelpOpen\(false\)\}>← Back<\/button><Bcr32Help\/><p className="muted studio-version" data-i18n-skip>Studio v\{studioVersion\}<\/p><\/section>\}/,'Documentation opens the help with Back and the Studio version')
assert.match(workbench,/onHelpReady\(\(\)=>setHelpOpen\(true\)\)/,'Documentation opens the help view')

// Narrow screens.
const narrow=[...css.matchAll(/@media\(max-width:760px\)\{([^]*?)\n\}/g)].map(m=>m[1]).join('\n')
assert.match(narrow,/\.sidebar>\.tool-tabs\{position:sticky;top:0;/,'tabs stick to the top on narrow screens')
assert.match(narrow,/\.sidebar>\.sidebar-statusbar\{position:sticky;bottom:0;/,'status bar sticks to the bottom on narrow screens')
assert.match(narrow,/\.studio\.standalone-editor>\.bcr32-workbench\{[^}]*overflow:clip visible/,'standalone wrapper is not a scroll container on narrow screens')
console.log('PASS BCR32 layout as in the mockup: DIN icon in the header; text tabs, SysEx warning only when needed, status bar summary; toolbar with history, CC and assignment switches, floating display, Display menu and panel toggle, all host-locked where they were; Control tab in mockup order; Files cards with one Advanced; help over the tab; sticky tabs and status bar on narrow screens')

// Current preset in the toolbar: rename and store go through the existing save sheet (backup, write, read-back);
// the ZQR / CTRL key shares the toolbar action and cannot be disabled by an old preference.
const presetsSrc=readFileSync('src/editors/bcontrol/bcr32/ControllerPresets.tsx','utf8')
assert.match(presetsSrc,/if \(!storeRequest\?\.seq \|\| currentSlot === null\) return; autoStore\.current = !!storeRequest\.auto; setSource\('working'\); setDestination\(currentSlot - 1\);[^]*setSaveOpen\(true\)/,'store request opens the save sheet prefilled (in place: destination = current slot)')
assert.match(presetsSrc,/if \(!autoStore\.current \|\| !saveOpen \|\| destination === null \|\| !name\.trim\(\)\) return; autoStore\.current = false; void store\(\)/,'Enter stores through store() and its checks, once')
assert.match(workbench,/if\(e\.key==='Enter'&&renaming\.trim\(\)\)requestStore\(renaming\.trim\(\),true\)/,'only Enter in the rename field stores directly')
assert.match(workbench,/onClick=\{\(\)=>requestStore\(renaming\?\?currentPreset\?\.name\?\?''\)\}>Store…<\/button>/,'Store… opens the sheet without writing')
assert.match(workbench,/const requestStore=\(name:string,auto=false\)=>\{setTab\('presets'\);setHelpOpen\(false\);setPresetLocation\('hardware'\)/,'Store… and rename lead to Presets › BCR32')
assert.ok(!/requestStore[^\n]*(sendWrite|transfer|output\.send)/.test(workbench),'the toolbar never writes by itself')
assert.ok(!workbench.includes('mode-key-link'),'old view-only preference cannot disable synchronized mode switching')
assert.match(workbench,/<FrontPanel onModeKey=\{\(\) => chooseEditorMode\('sequencer'\)\}/,'panel key uses the toolbar hardware action')
console.log('PASS BCR32 toolbar preset: rename and Store… open the checked save sheet, ZQR / CTRL shares the hardware-aware toolbar mode action')
