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
  let state=emptyPlayback(),timings:readonly TrackTiming[]|null=null,skips:readonly boolean[][]=[],binding='',tick=0,last:number|null=null,lastTempo=0,clockIndex=0,clockWindow:{at:number;index:number}[]=[],qualified:boolean[]=[],signature=''
  const emit=()=>{const next=JSON.stringify(state);if(next!==signature){signature=next;changed({...state,positions:[...state.positions]})}}
  const position=(phase:number)=>timings?.map((t,i)=>qualified[i]?((t.start-1+(t.offset+Math.floor(phase/dividerTicks[t.divider]))%t.length)%32):null)??[null,null,null,null]
  const invalidate=()=>{state.synced=false;state.positions=[null,null,null,null];state.reason=timings?'waiting':'unbound';tick=0}
  return {
    configure(source:string,tracks:readonly TrackTiming[]|null,masked:readonly boolean[][]=[]) {
      const next=JSON.stringify([source,tracks,masked]);if(next===binding)return
      binding=next;timings=tracks?.length===4?tracks:null;skips=masked
      qualified=timings?.map((t,i)=>t.start>=1&&t.start<=32&&t.length>=1&&t.length<=32&&t.offset<=31&&dividerTicks[t.divider]!==undefined&&t.direction===0&&t.shuffleEven===0&&t.shuffleOdd===0&&!Array.from({length:t.length},(_,n)=>(t.start-1+n)%32).some(n=>skips[i]?.[n]))??[]
      state=emptyPlayback();last=null;clockWindow=[];clockIndex=0;lastTempo=0;invalidate();emit()
    },
    receive(bytes:readonly number[],at=now()) {
      if(bytes.length!==1||![248,250,251,252].includes(bytes[0]))return
      const status=bytes[0]
      if(status===250){tick=0;state.running=true;state.synced=!!timings;state.positions=state.synced?position(0):[null,null,null,null];state.reason=!timings?'unbound':qualified.every(Boolean)?'following':'unsupported';last=null;clockWindow=[];clockIndex=0;emit();return}
      if(status===252){state.running=false;invalidate();state.reason='stopped';emit();return}
      if(status===251){state.running=true;if(!state.synced)invalidate();emit();return}
      if(last!==null){const gap=at-last;if(gap>1000){invalidate();clockWindow=[]}else if(gap<0)clockWindow=[]}
      last=at;state.clockSeen=true
      clockWindow.push({at,index:clockIndex++});while(clockWindow.length>257||(clockWindow.length>2&&at-clockWindow[0].at>1000))clockWindow.shift()
      // Fit the clock-index/time slope over a window, not individual ~8ms gaps. Millisecond rounding and
      // batched delivery must not turn 300 BPM into 277.8 or leave an old value stuck at the upper bound.
      if(clockWindow.length>=8&&at-clockWindow[0].at>=250&&at-lastTempo>=250){
        const origin=clockWindow[0],n=clockWindow.length;let sx=0,sy=0,sxx=0,sxy=0
        for(const p of clockWindow){const x=p.index-origin.index,y=p.at-origin.at;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y}
        const slope=(sxy-sx*sy/n)/(sxx-sx*sx/n),bpm=60000/(24*slope)
        if(Number.isFinite(bpm)&&bpm>0)state.bpm=Math.round(bpm*10)/10
        lastTempo=at
      }
      if(state.synced&&state.running)state.positions=position(tick++)
      emit()
    },
    checkStale(at=now()) {if(last!==null&&at-last>1000){last=null;clockWindow=[];state.clockSeen=false;invalidate();emit()}},
    snapshot:()=>({...state,positions:[...state.positions]}),
  }
}
