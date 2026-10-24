import assert from 'node:assert/strict'
import {build} from 'esbuild'
const b=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/preset-store'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const mod={exports:{}};new Function('module','exports',b.outputFiles[0].text)(mod,mod.exports);const {storeHardwarePreset,presetStorePlan}=mod.exports
const working="$rev BCR32\n$preset\n  .name 'Working'\n  .init\n$end",destination=working.replace('Working','Old name'),plan=presetStorePlan(working,61,' Test ')
let stored=false,restored=false,acknowledged=0,resume,awaiting;const requests=[],events=[]
const blocked=new Promise(r=>awaiting=r),gate=new Promise(r=>resume=r)
const done=storeHardwarePreset({source:'working',slot:61,name:' Test ',backup(){events.push('backup')},transfer:async lines=>{if(lines.some(l=>l.startsWith('$store '))){stored=true;events.push('store-ACK')}else{restored=true;events.push('restore-ACK')}},read:async request=>{
 requests.push(request)
 if(stored&&!restored){events.push('verify-start');awaiting();await gate}
 return{status:'complete',request,names:{},frames:[],text:request.kind==='working'?working:stored?plan.expected:destination}
},onAcknowledged:p=>{acknowledged++;assert.equal(p.slot,61);assert.equal(p.name,'Test');events.push('name-cache')}})
await blocked;assert.equal(acknowledged,1);assert.equal(restored,false);assert.deepEqual(events,['backup','store-ACK','name-cache','verify-start']);resume();assert.deepEqual(await done,plan);assert.ok(!requests.some(r=>r.kind==='names'))
let failedAcknowledgements=0
await assert.rejects(()=>storeHardwarePreset({source:'working',slot:61,name:'Test',read:async request=>({status:'complete',request,names:{},frames:[],text:working}),backup(){},transfer:async()=>{throw Error('missing ACK')},onAcknowledged:()=>failedAcknowledgements++}),/missing ACK/);assert.equal(failedAcknowledgements,0)
let mismatchAcknowledged=0
await assert.rejects(()=>storeHardwarePreset({source:'working',slot:61,name:'Test',read:async request=>({status:'complete',request,names:{},frames:[],text:working}),backup(){},transfer:async()=>{},onAcknowledged:()=>mismatchAcknowledged++}),/Stored preset differs/);assert.equal(mismatchAcknowledged,1)
// An initialized preset (read on 1.0.2 as "$rev BCR32 / $preset / .snapshot off / .request off / .init / $end", no name)
// gets its name line after "$preset"; a source with two names is still refused.
const init="$rev BCR32\n$preset\n  .snapshot off\n  .request off\n  .init\n$end",initPlan=presetStorePlan(init,12,'test Fred')
assert.equal(initPlan.expected,"$rev BCR32\n$preset\n  .name 'test Fred'\n  .snapshot off\n  .request off\n  .init\n$end",'name inserted after $preset')
assert.deepEqual(initPlan.lines.slice(-2),['$store 13','$end'],'stored into slot 13')
assert.throws(()=>presetStorePlan("$rev BCR32\n$preset\n  .name 'a'\n  .name 'b'\n$end",12,'x'),/complete single/,'two names refused')
// An initialized working preset is stored from the default template under the new name; the working preset is
// still restored as it was. A named working preset ignores the template.
{
  const {isInitializedPreset}=mod.exports,preset1="$rev BCR32\n$preset\n  .name 'all controls'\n  .egroups 4\n$end"
  assert.ok(isInitializedPreset(init)&&!isInitializedPreset(working),'initialized preset detected')
  const reads=[],transfers=[];let slot13="$rev BCR32\n$end"
  const plan=await storeHardwarePreset({source:'working',slot:12,name:'test Fred',template:preset1,backup(){},
    read:async r=>{reads.push(r);const text=r.kind==='working'?init:slot13;return {status:'complete',request:r,names:{},frames:[],text}},
    transfer:async lines=>{transfers.push(lines);if(lines.some(l=>l.startsWith('$store ')))slot13=lines.filter(l=>!l.startsWith('$store ')).join('\n')}})
  assert.equal(plan.expected,"$rev BCR32\n$preset\n  .name 'test Fred'\n  .egroups 4\n$end",'preset 1 contents stored under the new name')
  assert.ok(!reads.some(r=>r.kind==='slot'&&r.slot===0),'preset 1 on the device is not read: the stored template is used')
  assert.deepEqual(transfers.at(-1),init.split('\n'),'initialized working preset restored as it was')
}
{
  const b2=await build({stdin:{contents:`export * from './src/editors/bcontrol/bcr32/default-preset'`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
  const d={exports:{}};new Function('module','exports',b2.outputFiles[0].text)(d,d.exports)
  const p=presetStorePlan(d.exports.defaultPresetBcl,12,'test Fred')
  assert.ok(p.expected.includes("  .name 'test Fred'")&&p.lines.at(-2)==='$store 13','the stored default template is a valid single preset')
}
// The first read after $store may time out: the verification read is retried, then the store completes.
{
  let stored=false,timeouts=0;const working="$rev BCR32\n$preset\n  .name 'W'\n  .init\n$end",p=presetStorePlan(working,20,'Retry')
  await storeHardwarePreset({source:'working',slot:20,name:'Retry',pause:1,backup(){},transfer:async lines=>{if(lines.some(l=>l.startsWith('$store ')))stored=true},
    read:async r=>{if(stored&&r.kind==='slot'&&timeouts<2){timeouts++;return {status:'timeout',request:r,names:{},frames:[],text:''}}return {status:'complete',request:r,names:{},frames:[],text:r.kind==='working'?working:stored?p.expected:working.replace("'W'","'old'")}}})
  assert.equal(timeouts,2,'two timeouts after the store were retried')
}
console.log('PASS BCR32 preset store: slot62 Test cache event immediately after ACK, before independent verification/restoration; no names query, trimmed name, no event on failed transfer, failed readback still rejects after acknowledgement')
