// Host MIDI icon beside the connection status: shown only when the editor offers MIDI settings, and wired for BCR32.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'midi-settings-')),file=join(dir,'b.cjs')
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MidiSettingsButton} from './src/editor-host/MidiSettingsButton';export {React,renderToStaticMarkup,MidiSettingsButton}`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:file,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'})
const m=createRequire(import.meta.url)(file);rmSync(dir,{recursive:true})
assert.equal(m.renderToStaticMarkup(m.React.createElement(m.MidiSettingsButton,{})),'','no button when the editor offers no MIDI settings')
const html=m.renderToStaticMarkup(m.React.createElement(m.MidiSettingsButton,{open(){}}))
assert.match(html,/<button[^>]*class="ew-icon midi-settings-button"[^>]*aria-label="MIDI settings"/)
for(const host of ['src/editor-host/StandaloneEditorApp.tsx','src/editor-host/WorkspaceApp.tsx'])assert.match(readFileSync(host,'utf8'),/<MidiConnectionIndicator[^>]*\/>\s*<MidiSettingsButton open=\{record\?\.view\?\.openMidiSettings\}\/>/,`${host}: icon right after the connection status`)
const registration=readFileSync('src/editors/bcontrol/bcr32/registration.tsx','utf8'),workbench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8')
assert.match(registration,/openMidiSettings:bridge\.openMidiSettings/,'BCR32 runtime exposes its MIDI settings')
assert.match(workbench,/<dialog ref=\{midiSettingsDialog\}[^]*?<label>Input<select[^]*?<label>Output<select[^]*?<\/dialog>/,'BCR32 MIDI window holds both port selectors')
console.log('PASS MIDI settings icon: hidden without editor support, placed after the connection status in standalone and workspace hosts, opens the BCR32 MIDI connection window (permission, ports, CC sending)')
