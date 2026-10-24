// Sequencer view logic: step entry (computer or MIDI keyboard), MIDI file import onto T1–T4 with a chosen source track
// per slot, and MIDI export of the pattern, checked on the synthetic fixtures of scripts/fixtures/sequencer.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-sequencer-')),file=join(dir,'b.cjs')
await build({stdin:{contents:`export {emptyPattern,enterNote,applyMidiTracks,patternToMidi,keyboardNotes,noteName} from './src/editors/bcontrol/bcr32/SequencerView';export {readStep,patchStep} from './src/editors/bcontrol/bcr32/zaquencer';export {parseMidiFile,suggestStepTicks,trackToSteps} from './src/editors/bcontrol/bcr32/midi-file'`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:file,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'})
const m=createRequire(import.meta.url)(file);rmSync(dir,{recursive:true})
const fixture=name=>new Uint8Array(readFileSync(`scripts/fixtures/sequencer/${name}`))

// Step entry: note and velocity on the selected step, step switched on, cursor advanced, nothing else changed.
const empty=m.emptyPattern().data
const {data:one,next}=m.enterNote(empty,1,31,60,90)
assert.equal(next,0,'the cursor wraps after step 32')
assert.deepEqual([m.readStep(one,1,31).note,m.readStep(one,1,31).velocity,m.readStep(one,1,31).mask,m.readStep(one,1,31).rest],[60,90,true,false])
assert.equal(one.filter((v,i)=>v!==empty[i]).length>0&&[0,2,3].every(tr=>Array.from({length:32},(_,s)=>JSON.stringify(m.readStep(one,tr,s))===JSON.stringify(m.readStep(empty,tr,s))).every(Boolean)),true,'other tracks untouched')
assert.equal(m.readStep(m.enterNote(empty,0,0,60,0).data,0,0).velocity,1,'velocity 0 from a keyboard becomes 1 (audible)')
assert.throws(()=>m.enterNote(empty,0,0,128,100),/Note/,'note out of range refused')
assert.deepEqual(Object.values(m.keyboardNotes),[0,1,2,3,4,5,6,7,8,9,10,11,12],'one chromatic octave on the computer keyboard')
assert.equal(m.noteName(60),'C4')

// MIDI import: choose which source tracks go to T1–T4 (here from a 20-track, 64-step file), grid and start bar.
const long=m.parseMidiFile(fixture('long-20tracks-64steps.mid')),withNotes=long.tracks.filter(t=>t.notes.length)
assert.ok(withNotes.length>=20,'20 source tracks available')
const pick=[withNotes[19],withNotes[4],null,withNotes[0]].map(t=>t?{notes:t.notes}:null)
const stepTicks=m.suggestStepTicks(withNotes.flatMap(t=>t.notes),long.ppq)
const first=m.applyMidiTracks(empty,pick,stepTicks,0),second=m.applyMidiTracks(empty,pick,stepTicks,stepTicks*32)
assert.ok(first.report.beyond>0,'notes past step 32 are reported, not silently lost')
for(const [slot,src] of [[0,19],[1,4],[3,0]]){
  const expected=m.trackToSteps(withNotes[src].notes,{stepTicks,startTick:0,steps:32}).steps
  expected.forEach((e,s)=>{const got=m.readStep(first.data,slot,s);if(e)assert.deepEqual([got.note,got.velocity,got.mask],[e.note,e.velocity,true],`T${slot+1} step ${s+1}`);else assert.equal(got.mask,false,`T${slot+1} step ${s+1} off`)})
}
assert.ok(Array.from({length:32},(_,s)=>m.readStep(first.data,2,s)).every(x=>!x.mask&&x.velocity===0),'T3 left unchanged when no source is chosen')
const later=m.trackToSteps(withNotes[19].notes,{stepTicks,startTick:stepTicks*32,steps:32}).steps
later.forEach((e,s)=>{const got=m.readStep(second.data,0,s);assert.equal(got.mask,!!e,`start bar: T1 step ${s+1}`);if(e)assert.deepEqual([got.note,got.velocity],[e.note,e.velocity])})
assert.ok(later.some(Boolean),'the second half of the 64-step file has notes')

// MIDI export → import gives the same notes and velocities on T1–T4.
const groove=m.parseMidiFile(fixture('groove-4tracks-16th.mid')),gNotes=groove.tracks.filter(t=>t.notes.length)
const imported=m.applyMidiTracks(empty,gNotes.slice(0,4).map(t=>({notes:t.notes})),m.suggestStepTicks(gNotes.flatMap(t=>t.notes),groove.ppq)).data
const back=m.parseMidiFile(m.patternToMidi(imported)),bNotes=back.tracks.filter(t=>t.notes.length)
const again=m.applyMidiTracks(empty,bNotes.slice(0,4).map(t=>({notes:t.notes})),back.ppq/4).data
for(let tr=0;tr<4;tr++)for(let s=0;s<32;s++){const a=m.readStep(imported,tr,s),b=m.readStep(again,tr,s);assert.deepEqual([a.mask,a.mask?a.note:0,a.mask?a.velocity:0],[b.mask,b.mask?b.note:0,b.mask?b.velocity:0],`round trip T${tr+1} step ${s+1}`)}

// The view never sends: no output port use, receive only.
const view=readFileSync('src/editors/bcontrol/bcr32/SequencerView.tsx','utf8')
assert.ok(!/\.send\(|output|sendRead|requestBcl/.test(view),'the sequencer view has no sending path')
assert.match(view,/<button disabled>\{t\('Send to a slot…'\)\}<\/button>/,'sending to the BCR32 stays disabled')
console.log('PASS BCR32 sequencer: step entry from the keyboard, MIDI import with a chosen source track per slot (20-track file, grid, start bar, overflow reported), MIDI export round trip, no sending path')
