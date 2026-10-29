import assert from 'node:assert/strict'
import {build} from 'esbuild'
const built=await build({stdin:{contents:`export * from './src/bcl-tx';export * from './src/bcl-document';export {presetToProfile,profileToBcl} from './src/bcl';export {createProfile as legacyProfile} from './src/profile';export * from './src/editors/bcontrol/bcr32/custom-program';export * from './src/editors/bcontrol/bcr32/profile';export * from './src/editors/bcontrol/bcr32/presets';export * from './src/editors/bcontrol/bcr32/controller-write';export * from './src/editors/bcontrol/bcr32/cc-transport';export * from './src/editors/bcontrol/bcr32/multi-selection';export * from './src/editors/bcontrol/bcr32/controller-read';export * from './src/editors/bcontrol/bcr32/bcl'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports)
const m=mod.exports
const body='; keep this comment\n.minmax 0 127\n.default 0\n.tx $F0 $42 $31 $03 $41 $0F val $F7 ; inline comment\n.showvalue on'
const p=m.parseCustomAssignment(body)
assert.equal(p.kind,'custom-sysex');assert.equal(p.hardwareValidated,false);assert.equal(p.sourceBcl,body)
for(const value of [0,63,64,127])assert.deepEqual(m.evaluateAssignment(p,value),[[240,66,49,3,65,15,value,247]])
for(const value of [-1,128,NaN,1.5])assert.throws(()=>m.evaluateAssignment(p,value))
const tx=m.sysexToTx('F0 42 31 03 41 0F {val} F7');assert.equal(m.txToSysex(tx),'F0 42 31 03 41 0F {val} F7')
assert.deepEqual(m.evaluateTx(m.parseTx(tx.originalText),32),[240,66,49,3,65,15,32,247])
const wide=m.parseCustomAssignment('.minmax 0 16383\n.tx $F0 $7D val0.6 val7.13 $F7')
assert.deepEqual(m.evaluateAssignment(wide,16383),[[240,125,127,127,247]])
for(const text of ['F0 7D 80 F7','F0 F7','F0 7D {bad} F7','B0 07 40','F0 7D {val} F6','F0 7D 0 F7'])assert.throws(()=>m.sysexToTx(text),text)
for(const text of ['.minmax 64 0\n.tx $F0 $7D val $F7','.minmax 0 63\n.default 64\n.tx $F0 $7D val $F7','.tx $F0 $7D $100 $F7','.tx $F0 $7D val14.15 $F7','$store 1','.tx $F0 $7D val $F7\n$end\n$encoder 2'])assert.throws(()=>m.parseCustomAssignment(text),text)
for(const token of ['val0','rel2s','reloffs','relsign','cks-1','cks-2','cks-3','ifp','ifn','ntimes','vendor-token','val2.6']){
 const source=`; unknown retained\n.tx $F0 $7D ${token} $F7\n.vendor-mode 42`,program=m.parseCustomAssignment(source)
 assert.equal(program.kind,'opaque-bcl');assert.equal(program.sourceBcl,source);assert.ok(program.messages[0].tokens.some(t=>t.kind==='unsupported'));assert.throws(()=>m.evaluateAssignment(program,32))
}
assert.equal(m.parseCustomAssignment('.tx $B0 $07 val').kind,'opaque-bcl','non-SysEx BCL is preserved, not reinterpreted')
const mixed=m.parseCustomAssignment('.easypar CC 1 16 0 127 absolute\n.tx $F0 $7D val $F7');assert.equal(mixed.kind,'opaque-bcl');assert.ok(mixed.diagnostics.some(s=>s.includes('rejects')))
assert.ok(m.validCustomAssignment(JSON.parse(JSON.stringify(p))));assert.ok(!m.validCustomAssignment({...p,hardwareValidated:true}));assert.ok(!m.validCustomAssignment({...p,messages:[]}))
const baseline=m.createProfile();baseline.encoders[0]={...baseline.encoders[0],type:'cc',parameter:16}
const custom=m.withCustomProgram(baseline.encoders[0],p);assert.equal(custom.type,'sysex');assert.equal(custom.fallbackType,'cc');assert.deepEqual(m.withoutCustomProgram(custom),baseline.encoders[0])
const profile=m.parseProfile({...baseline,encoders:[custom,...baseline.encoders.slice(1)]})
const state={profile,labels:m.emptyLabels(),values:m.emptyValues(),ringMode:'bar'}
const preset=m.makePreset(state,'Custom fixture','fixture','2026-10-29T00:00:00.000Z'),bank=m.parseLibrary(m.libraryFile([preset]))
assert.equal(bank[0].profile.encoders[0].customAssignment.sourceBcl,body)
assert.equal(bank[0].profile.encoders[1].type,'off','other controls unchanged')
assert.throws(()=>m.parseProfile({...profile,encoders:[{...custom,type:'off'},...profile.encoders.slice(1)]}),'custom program cannot masquerade as OFF')
assert.equal(m.encoderMessages(custom,32),null);assert.equal(m.encoderCC(custom,32),null)
assert.throws(()=>m.changedEncoderFields(custom,{...custom,type:'off'}));assert.throws(()=>m.changedControllerFields(custom,{...custom,type:'off'},{index:50,fields:{}}))
assert.throws(()=>m.applySelectionChange(profile,[{kind:'encoders',id:1}],{type:'off'}))
assert.equal(m.assignmentFromRead(custom,{index:50,fields:{}}),null,'indexed reads do not destroy local BCL drafts')
const target={kind:'encoders',id:1},file=m.controlProgramFile(target,p)
assert.ok(!file.includes('$preset')&&!file.includes('$store'));assert.equal(m.programSelector({kind:'pushes',id:1}),'$button 17');assert.equal(m.programSelector({kind:'buttons',id:74}),'$button 49');assert.equal(m.programSelector({kind:'buttons',id:65}),null)
for(const model of [20,21,100,127]){
 const lines=['$rev '+(model===100?'BCR32':model===21?'F1':'R1'),'$encoder 1',...body.split('\n'),'$end'],bytes=m.bclToSyx(lines,model),decoded=m.bclLinesFromSyx(bytes)
 assert.deepEqual(decoded.lines,lines);assert.deepEqual(decoded.issues,[]);assert.equal(decoded.model,model===127?null:model)
 if(model===100){const imported=m.importControlProgram(new Uint8Array(bytes),target);assert.equal(imported.program.sourceBcl,body)}
 else assert.throws(()=>m.importControlProgram(new Uint8Array(bytes),target),'historical numbering is not implicitly BCR32')
}
assert.equal(m.importControlProgram(new TextEncoder().encode(file),target).program.sourceBcl,body)
assert.throws(()=>m.importControlProgram(new TextEncoder().encode(file),{kind:'encoders',id:2}))
assert.ok(m.bclLinesFromSyx(m.bclFile(file).slice(0,-1)).issues.length)
assert.throws(()=>m.bclToSyx(['; non-ASCII é'],100));assert.throws(()=>m.bclToSyx(['ok'],0x65))
const historical=m.parseBcl('$rev R1\n$preset\n$encoder 1\n.easypar CC 1 16 0 127 absolute\n$encoder 2\n.easypar NRPN 2 255 0 127 absolute\n$encoder 3\n'+body+'\n.vendor-feature 23\n$end')
assert.equal(historical.issues.length,0);assert.ok(historical.warnings.length)
const projection=m.presetToProfile(historical.presets[0],m.legacyProfile()).profile,roundtrip=m.profileToBcl(projection,'Fixture').lines.join('\n')
assert.equal(projection.encoders[0].type,'cc');assert.equal(projection.encoders[1].type,'nrpn');assert.ok(roundtrip.includes(body+'\n.vendor-feature 23'))
assert.equal(m.parseBcl('$rev BCR32\n$encoder 1\n'+body+'\n$end').issues.length,0)
assert.equal(m.parseBcl('$rev BCR32\n$preset\n$button 50\n'+body+'\n$store 64\n$end').issues.length,0)
for(const selector of ['$encoder 33','$button 51','$fader 1'])assert.ok(m.parseBcl('$rev BCR32\n'+selector+'\n'+body+'\n$end').issues.length,selector)
assert.ok(m.parseBcl('$rev BCR32\n$rev R1').issues.length,'BCR32 and BCR2000 model identity remains distinct')
console.log('PASS BCL/SysEx: model64 + historical files, exact source/comments/unknown retention, 7/14-bit simulation, malformed/opaque refusal, JSON/history-compatible descriptors, selected target mapping, no OFF coercion, no standard sender and no hardware access')
