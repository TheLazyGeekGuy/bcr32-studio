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
console.log('PASS BCR32 preset store: slot62 Test cache event immediately after ACK, before independent verification/restoration; no names query, trimmed name, no event on failed transfer, failed readback still rejects after acknowledgement')
