// BCR32 Device tab (sidebar reorganisation, steps 5–6): every global once in grouped rows, writes still disabled,
// assignment synchronization under Presets › BCR32, connection-time reads chosen in the MIDI window.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'device-tab-')),file=join(dir,'b.cjs')
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';export {DeviceSettings,deviceGroups} from './src/editors/bcontrol/bcr32/DeviceSettings';export {editableGlobals,valueOf,withValue,globalWritesEnabled} from './src/editors/bcontrol/bcr32/device-globals';export {defaultSettings} from './src/editors/bcontrol/bcr32/profile';export {React,renderToStaticMarkup}`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:file,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'})
const m=createRequire(import.meta.url)(file);rmSync(dir,{recursive:true})
const base=m.defaultSettings(),results=m.editableGlobals.map(g=>({cmd:g.cmd,name:g.name,value:m.valueOf(g.cmd,base)??0,label:null,status:'value'}))
const render=props=>m.renderToStaticMarkup(m.React.createElement(m.DeviceSettings,{results,settings:base,change(){},update(){},autoLoad:true,canRead:true,busy:false,read(){},reset(){},readAt:'12:04',brightness:5,draft:5,setDraft(){},brightnessEnabled:true,brightnessStatus:'',editFootswitch(){},...props}))
const html=render({})
assert.equal((html.match(/<select /g)??[]).length,m.editableGlobals.length,'one choice list per editable setting, no duplicate')
const groups=[...html.matchAll(/<section id="device-group-([a-z]+)"/g)].map(x=>x[1])
assert.deepEqual(groups,['footswitches','routing','mode','clock','sequencer','led'],'groups in order, LED last')
assert.ok(!html.includes('<details class="device-group'),'groups are not collapsible')
assert.equal((html.match(/<details/g)??[]).length,1,'one Advanced disclosure')
assert.match(html,/<details class="device-advanced"><summary>Advanced<\/summary><label>Device ID<input type="number"/,'Device ID under Advanced')
assert.equal(m.globalWritesEnabled,false)
const changed=render({settings:m.withValue(0x18,4,m.withValue(0x17,1,base))})
assert.equal((changed.match(/class="device-row device-row-differs"/g)??[]).length,2,'changed values are marked')
assert.ok(!changed.includes('device-write')&&!changed.includes('Write all changes'),'no write button while writes are disabled')
assert.ok(changed.includes('Writing to the BCR32 is disabled: it froze the controller.'),'reason shown')
assert.match(changed,/Read from the BCR32 at 12:04\. <span data-i18n-skip="true">2 ≠<\/span>/,'read time and difference count')
assert.equal((html.match(/ ⚠</g)??[]).length,2,'the two settings that can cut the USB link are flagged')
assert.match(html,/aria-label="LED brightness" type="range"/,'live LED brightness kept')
assert.ok(!render({}).includes('Load the settings from the BCR32 at connection'),'connection-time load chosen in the MIDI window')

const workbench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8')
assert.match(workbench,/\(\['control', 'presets', 'device', 'files', 'log'\] as const\)/,'five tabs: Device replaces Config, no Help tab')
assert.ok(!/'config'/.test(workbench)&&!workbench.includes('<StudioConfig'),'no Config tab nor duplicated StudioConfig sections left')
assert.match(workbench,/if\(tab==='device'&&brightness===null\)brightnessTransport\.current\?\.read\(\)/,'opening Device still reads the LED brightness')
const hardware=workbench.slice(workbench.indexOf("<div className=\"hardware-presets\" hidden={presetLocation!=='hardware'}>"),workbench.indexOf('<div className="browser-presets"'))
assert.ok(hardware.includes('<ControllerReadPanel '),'assignment synchronization under Presets › BCR32')
assert.ok(!/<ControllerReadPanel[^>]*autoRead=/.test(workbench),'auto-read moved out of the card')
const dialog=workbench.slice(workbench.indexOf('<dialog ref={midiSettingsDialog}'),workbench.indexOf('</dialog>'))
assert.match(dialog,/<fieldset className="midi-settings-at-connection" disabled=\{locked\}>[^]*checked=\{autoReadController\}[^]*checked=\{autoLoadDevice\}/,'both connection-time reads in the MIDI window, locked with the host')
assert.match(workbench,/aria-pressed=\{assignmentLive\} disabled=\{locked\}[^>]*onClick=\{\(\) => setAssignmentLive\(on => !on\)\}/,'assignment sending switch in the toolbar keeps the host lock')
assert.ok(!workbench.includes('<AssignmentWritePanel'),'no second assignment switch')
console.log('PASS BCR32 Device tab: every global once in open groups (footswitches, routing, mode, clock, sequencer, LED) with editor and BCR32 values, writes still disabled, Advanced for Device ID; sync card under Presets › BCR32; connection-time reads in the MIDI window; assignment switch in the toolbar, all locked with the host')
