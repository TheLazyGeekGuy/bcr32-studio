// Sequencer view logic: step entry (computer or MIDI keyboard), MIDI file import onto T1–T4 with a chosen source track
// per slot, and MIDI export of the pattern, checked on the synthetic fixtures of scripts/fixtures/sequencer.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'bcr32-sequencer-')),file=join(dir,'b.cjs')
await build({stdin:{contents:`export {emptyPattern,enterNote,applyMidiTracks,patternToMidi,keyboardNotes,noteName,plays,trackHeader,ccValue,ccRaw} from './src/editors/bcontrol/bcr32/SequencerView';export {readStep,patchStep} from './src/editors/bcontrol/bcr32/zaquencer';export {parseMidiFile,suggestStepTicks,trackToSteps} from './src/editors/bcontrol/bcr32/midi-file';export {firstNoteBar} from './src/editors/bcontrol/bcr32/MidiImportDialog';export {applyTemplate,randomPattern,templates,scales} from './src/editors/bcontrol/bcr32/sequencer-templates'`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:file,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'})
const m=createRequire(import.meta.url)(file);rmSync(dir,{recursive:true})
const fixture=name=>new Uint8Array(readFileSync(`scripts/fixtures/sequencer/${name}`))

// Step entry: note and velocity on the selected step, step switched on, cursor advanced, nothing else changed.
const empty=m.emptyPattern().data
assert.ok([0,1,2,3].every(tr=>Array.from({length:32},(_,s)=>m.readStep(empty,tr,s)).every(x=>x.note===60&&x.velocity===100&&x.gate===2&&m.plays(x))),'a new pattern plays the BCR32 defaults on every step: C3, velocity 100, length 32 (code 2)')
const {data:one,next}=m.enterNote(empty,1,31,60,90)
assert.equal(next,0,'the cursor wraps after step 32')
assert.deepEqual([m.readStep(one,1,31).note,m.readStep(one,1,31).velocity,m.plays(m.readStep(one,1,31))],[60,90,true],'the entered step plays (not muted, not skipped)')
assert.equal(one.filter((v,i)=>v!==empty[i]).length>0&&[0,2,3].every(tr=>Array.from({length:32},(_,s)=>JSON.stringify(m.readStep(one,tr,s))===JSON.stringify(m.readStep(empty,tr,s))).every(Boolean)),true,'other tracks untouched')
assert.equal(m.readStep(m.enterNote(empty,0,0,60,0).data,0,0).velocity,1,'velocity 0 from a keyboard becomes 1 (audible)')
assert.throws(()=>m.enterNote(empty,0,0,128,100),/Note/,'note out of range refused')
assert.deepEqual(Object.values(m.keyboardNotes),[0,1,2,3,4,5,6,7,8,9,10,11,12],'one chromatic octave on the computer keyboard')
assert.deepEqual([0,60,127].map(m.noteName),['C-2','C3','G8'],'notes named like the BCR32 display (octaves −2 to +8, default step C3 = 60)')
{ const notes=[{tick:0,duration:10,note:60,velocity:100},{tick:24+11,duration:10,note:62,velocity:100},{tick:48-11,duration:10,note:64,velocity:100}]
  const {data}=m.applyMidiTracks(empty,[{notes}],24,0)
  assert.deepEqual([0,1,2].map(s=>m.readStep(data,0,s).delay),[0,3,-3],'MIDI offsets become clock ticks: a fraction of a 1/16 step × 6, within ±5') }

// MIDI import: choose which source tracks go to T1–T4 (here from a 20-track, 64-step file), grid and start bar.
const long=m.parseMidiFile(fixture('long-20tracks-64steps.mid')),withNotes=long.tracks.filter(t=>t.notes.length)
assert.ok(withNotes.length>=20,'20 source tracks available')
const pick=[withNotes[19],withNotes[4],null,withNotes[0]].map(t=>t?{notes:t.notes}:null)
const stepTicks=m.suggestStepTicks(withNotes.flatMap(t=>t.notes),long.ppq)
const first=m.applyMidiTracks(empty,pick,stepTicks,0),second=m.applyMidiTracks(empty,pick,stepTicks,stepTicks*32)
assert.ok(first.report.beyond>0,'notes past step 32 are reported, not silently lost')
for(const [slot,src] of [[0,19],[1,4],[3,0]]){
  const expected=m.trackToSteps(withNotes[src].notes,{stepTicks,startTick:0,steps:32}).steps
  expected.forEach((e,s)=>{const got=m.readStep(first.data,slot,s);if(e)assert.deepEqual([got.note,got.velocity,m.plays(got)],[e.note,e.velocity,true],`T${slot+1} step ${s+1}`);else assert.equal(got.rest,true,`T${slot+1} step ${s+1} muted`)})
}
assert.deepEqual(first.data.slice(512,768),empty.slice(512,768),'T3 left unchanged when no source is chosen')
const later=m.trackToSteps(withNotes[19].notes,{stepTicks,startTick:stepTicks*32,steps:32}).steps
later.forEach((e,s)=>{const got=m.readStep(second.data,0,s);assert.equal(m.plays(got),!!e,`start bar: T1 step ${s+1}`);if(e)assert.deepEqual([got.note,got.velocity],[e.note,e.velocity])})
assert.ok(later.some(Boolean),'the second half of the 64-step file has notes')

// MIDI export → import gives the same notes and velocities on T1–T4.
const groove=m.parseMidiFile(fixture('groove-4tracks-16th.mid')),gNotes=groove.tracks.filter(t=>t.notes.length)
const imported=m.applyMidiTracks(empty,gNotes.slice(0,4).map(t=>({notes:t.notes})),m.suggestStepTicks(gNotes.flatMap(t=>t.notes),groove.ppq)).data
const back=m.parseMidiFile(m.patternToMidi(imported)),bNotes=back.tracks.filter(t=>t.notes.length)
const again=m.applyMidiTracks(empty,bNotes.slice(0,4).map(t=>({notes:t.notes})),back.ppq/4).data
for(let tr=0;tr<4;tr++)for(let s=0;s<32;s++){const a=m.readStep(imported,tr,s),b=m.readStep(again,tr,s),pa=m.plays(a),pb=m.plays(b);assert.deepEqual([pa,pa?a.note:0,pa?a.velocity:0],[pb,pb?b.note:0,pb?b.velocity:0],`round trip T${tr+1} step ${s+1}`)}

// Public field meanings: header decode and signed CC values (−1 = off).
const h=m.trackHeader(m.patchStep(m.patchStep(empty,0,3,{mask:true}),0,7,{mask:true}),0)
assert.equal(h.skipped,2,'skip flags counted from bytes 0–3')
assert.deepEqual([m.ccValue(255),m.ccValue(64),m.ccRaw(-1),m.ccRaw(64)],[-1,64,255,64],'CC value −1 = off stored as 255')

// Import preview: each slot takes its own source track and its own start (a song that starts at bar 19, sections per slot).
const late=[{tick:18*384,duration:24,note:60,velocity:100},{tick:18*384+96,duration:24,note:62,velocity:90}]
assert.equal(m.firstNoteBar({index:0,name:'',channels:[0],notes:late},384),18,'first note in bar 19 (index 18)')
assert.equal(m.firstNoteBar(undefined,384),0)
const sections=m.applyMidiTracks(empty,[{notes:late,startTick:18*384},{notes:late,startTick:0},null,null],24)
assert.ok(m.plays(m.readStep(sections.data,0,0))&&m.readStep(sections.data,0,0).note===60&&m.readStep(sections.data,0,4).note===62,'T1 from bar 19: notes on steps 1 and 5')
assert.ok(Array.from({length:32},(_,s)=>m.readStep(sections.data,1,s)).every(x=>!m.plays(x)),'T2 from bar 1 of the same track: nothing in its 32 steps')
assert.equal(sections.report.beyond,2,'notes outside a slot window are reported')

// Templates and random patterns: steps only, the track headers (bytes 0–15 of each track) are never touched.
for(const tp of m.templates){const d=m.applyTemplate(empty,tp.id);assert.ok(d.length===1024&&[0,1,2,3].every(tr=>d.slice(tr*256,tr*256+4).every((v,i)=>v===empty[tr*256+i])),`${tp.id}: no skip flag set`);assert.ok(Array.from({length:32},(_,s2)=>m.readStep(d,0,s2)).some(m.plays),`${tp.id}: T1 plays`)}
const fourFloor=m.applyTemplate(empty,'four-on-the-floor');assert.deepEqual(Array.from({length:32},(_,s2)=>m.plays(m.readStep(fourFloor,0,s2))).map((p,i)=>p?i:-1).filter(i=>i>=0),[0,4,8,12,16,20,24,28],'kick on every beat')
let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647
const r1=m.randomPattern(empty,{tracks:[1],scale:'minor pentatonic',root:45,octaves:2,density:.6,random:rnd});seed=1
const r2=m.randomPattern(empty,{tracks:[1],scale:'minor pentatonic',root:45,octaves:2,density:.6,random:rnd})
assert.deepEqual(r1,r2,'random patterns are reproducible with the same random source')
const played=Array.from({length:32},(_,s2)=>m.readStep(r1,1,s2)).filter(m.plays)
assert.ok(played.length>8&&played.length<28,'density respected roughly')
assert.ok(played.every(x=>[0,3,5,7,10].includes((x.note-45)%12)&&x.note>=45&&x.note<45+24),'notes from the chosen scale and span')
assert.deepEqual(r1.slice(0,256),empty.slice(0,256),'other tracks untouched')
assert.throws(()=>m.randomPattern(empty,{tracks:[0],scale:'nope',root:45}),/scale/)

// The view never sends pattern data: no output port use; start/stop goes through the Workbench's clock master, which
// only lets Start, Clock and Stop through (scripts/test-sequencer-clock.mjs).
const view=readFileSync('src/editors/bcontrol/bcr32/SequencerView.tsx','utf8'),bench=readFileSync('src/editors/bcontrol/bcr32/Workbench.tsx','utf8')
assert.ok(!/\.send\(|output|sendRead|requestBcl/.test(view),'the sequencer view has no sending path')
assert.match(view,/' ': \(\) => \{ if \(transport\.available\) transport\.toggle\(\) \}/,'Space starts and stops through the transport')
assert.match(bench,/available: usbClockFollowed && !!clockMaster && !locked/,'start/stop stays off while the BCR32 does not follow a USB clock')
assert.match(bench,/createClockMaster\(\(bytes, at\) => \{\s*if \(!isBcrOutput\(output\) \|\| !isClockMessage\(bytes\)\) throw/,'the clock sender refuses anything but FA, F8, FC')
assert.match(view,/<button disabled>\{t\('Send to a slot…'\)\}<\/button>/,'sending to the BCR32 stays disabled')
console.log('PASS BCR32 sequencer: step entry from the keyboard, MIDI import with a chosen source track per slot (20-track file, grid, start bar, overflow reported), MIDI export round trip, no pattern sending path, Space = start/stop via the clock master')
