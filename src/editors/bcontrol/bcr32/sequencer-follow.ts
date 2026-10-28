/** Passive clock follower. Never sends MIDI or advances from a wall-clock timer.
 * Qualification is deliberately limited to forward, unshuffled tracks without skipped steps.
 * Native timing selectors/captures and physical FA/F8/FC evidence: BCR103-05.
 */
export const dividerTicks = [96,48,24,12,6,3,4,8,16,32] as const
export type TrackTiming = {start:number;length:number;offset:number;divider:number;shuffleEven:number;shuffleOdd:number;direction:number}
export type PlaybackState = {running:boolean|null;clockSeen:boolean;synced:boolean;positions:(number|null)[];bpm:number|null;reason:'waiting'|'stopped'|'following'|'unsupported'|'unbound'}
export const emptyPlayback = ():PlaybackState=>({running:null,clockSeen:false,synced:false,positions:[null,null,null,null],bpm:null,reason:'unbound'})
export function decodeTrackTiming(values:readonly number[]):TrackTiming {
  // Preserve unknown read values. They disqualify the cursor, not the whole pattern read or edit capability.
  if(values.length!==7||values.some(v=>!Number.isInteger(v)||v<0||v>65535))throw Error('Invalid hardware track timing')
  const [start,length,offset,divider,shuffleEven,shuffleOdd,direction]=values
  return {start,length,offset,divider,shuffleEven,shuffleOdd,direction}
}
export function createPlaybackFollower(changed:(state:PlaybackState)=>void,now=()=>performance.now()) {
  let state=emptyPlayback(),timings:readonly TrackTiming[]|null=null,skips:readonly boolean[][]=[],binding='',tick=0,last:number|null=null,lastTempo=0,intervals:number[]=[],qualified:boolean[]=[],signature=''
  const emit=()=>{const next=JSON.stringify(state);if(next!==signature){signature=next;changed({...state,positions:[...state.positions]})}}
  const position=(phase:number)=>timings?.map((t,i)=>qualified[i]?((t.start-1+(t.offset+Math.floor(phase/dividerTicks[t.divider]))%t.length)%32):null)??[null,null,null,null]
  const invalidate=()=>{state.synced=false;state.positions=[null,null,null,null];state.reason=timings?'waiting':'unbound';tick=0}
  return {
    configure(source:string,tracks:readonly TrackTiming[]|null,masked:readonly boolean[][]=[]) {
      const next=JSON.stringify([source,tracks,masked]);if(next===binding)return
      binding=next;timings=tracks?.length===4?tracks:null;skips=masked
      qualified=timings?.map((t,i)=>t.start>=1&&t.start<=32&&t.length>=1&&t.length<=32&&t.offset<=31&&dividerTicks[t.divider]!==undefined&&t.direction===0&&t.shuffleEven===0&&t.shuffleOdd===0&&!Array.from({length:t.length},(_,n)=>(t.start-1+n)%32).some(n=>skips[i]?.[n]))??[]
      state=emptyPlayback();last=null;intervals=[];lastTempo=0;invalidate();emit()
    },
    receive(bytes:readonly number[],at=now()) {
      if(bytes.length!==1||![248,250,251,252].includes(bytes[0]))return
      const status=bytes[0]
      if(status===250){tick=0;state.running=true;state.synced=!!timings;state.positions=state.synced?position(0):[null,null,null,null];state.reason=!timings?'unbound':qualified.every(Boolean)?'following':'unsupported';last=null;intervals=[];emit();return}
      if(status===252){state.running=false;invalidate();state.reason='stopped';emit();return}
      if(status===251){state.running=true;if(!state.synced)invalidate();emit();return}
      if(last!==null){const gap=at-last;if(gap>1000){invalidate();intervals=[]}else if(gap>0){intervals.push(gap);if(intervals.length>24)intervals.shift()}}
      last=at;state.clockSeen=true
      if(intervals.length>=6&&at-lastTempo>=1000){const sorted=[...intervals].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],bpm=Math.round(600000/(24*median))/10;if(bpm>=30&&bpm<=300)state.bpm=bpm;lastTempo=at}
      if(state.synced&&state.running)state.positions=position(tick++)
      emit()
    },
    checkStale(at=now()) {if(last!==null&&at-last>1000){last=null;state.clockSeen=false;invalidate();emit()}},
    snapshot:()=>({...state,positions:[...state.positions]}),
  }
}
