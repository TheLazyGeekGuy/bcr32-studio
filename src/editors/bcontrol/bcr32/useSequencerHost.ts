import { useCallback, useEffect, useRef, useState } from 'react'
import { applyHostLane, changedHostSteps, createZaqHost, isZaqHostWrite, sameHostPatternContext, supportsZaqHost } from './zaq-host'
import {decodeTrackTiming,type TrackTiming} from './sequencer-follow'

export type SequencerConnection = { firmware: string | null; device: number | null; key: string; available: boolean; send: (bytes: number[]) => void }
type Snapshot = { data: number[]; frames: number[][]; state: number[]; timing:TrackTiming[]; timingError?:string; capturedAt: string }
/** View-local lifecycle; reuses the host's lease and never opens another MIDI connection. */
export function useSequencerHost(connection: SequencerConnection | undefined, locked: boolean, onRead: (s: Snapshot) => void) {
  const [status,setStatus]=useState('Offline · nothing is sent to the BCR32'),[busy,setBusy]=useState(false),[live,setLive]=useState(false),[ready,setReady]=useState(false)
  const [running,setRunning]=useState<boolean|null>(null),activePoll=useRef<Promise<void>|null>(null)
  const refreshRead=useRef<((data:readonly number[],selectPage?:boolean)=>Promise<void>)|null>(null)
  const session=useRef<ReturnType<typeof createZaqHost>|null>(null),latest=useRef({connection,locked,onRead}),snapshot=useRef<Snapshot|null>(null)
  latest.current={connection,locked,onRead}
  const enabled=!!connection?.available&&supportsZaqHost(connection.firmware)&&connection.device!==null&&connection.device!==127
  const queue=useRef(new Map<string,{track:number;step:number;field:number;value:number}>()),flushing=useRef(false),armed=useRef(false),reading=useRef(false)
  const followPending=useRef(false)
  const disarm=useCallback(()=>{followPending.current=false;armed.current=false;setLive(false);queue.current.clear()},[])
  const runFollow=useCallback(()=>{
    if(!followPending.current||reading.current||flushing.current||activePoll.current||!session.current||!snapshot.current||latest.current.locked)return
    followPending.current=false;void refreshRead.current?.(snapshot.current.data,false)
  },[])
  useEffect(()=>{
    disarm();setReady(false);setRunning(null);activePoll.current=null;snapshot.current=null;reading.current=false;flushing.current=false;setBusy(false)
    if(!enabled||!connection||connection.device===null){setStatus('Offline · nothing is sent to the BCR32');return}
    const client=createZaqHost(bytes=>{const c=latest.current;if(!c.connection?.available||c.locked&&isZaqHostWrite(bytes))throw Error('Sequencer unavailable');c.connection.send(bytes)},connection.device)
    session.current=client;setStatus('Firmware 1.0.3 · ready to read the current pattern')
    return()=>{session.current=null;client.close();queue.current.clear()}
  },[connection?.key,enabled,disarm])
  // One small state query per second, only while idle. No duplicate ports, concurrent requests or clock flooding.
  useEffect(()=>{
    if(!ready)return
    const timer=setInterval(()=>{
      const client=session.current;if(!client||reading.current||flushing.current||activePoll.current)return
      let follow=false
      const poll=(async()=>{try{
        const state=await client.state();if(session.current!==client)return
        setRunning(Boolean(state.values[0]))
        if(snapshot.current&&!sameHostPatternContext(state.values,snapshot.current.state)){
          follow=armed.current&&!latest.current.locked
          disarm();setReady(false);setStatus('Device state changed; read the current pattern again')
        }
      }catch(e){if(session.current===client){disarm();setReady(false);setStatus(String(e))}}})()
      activePoll.current=poll;void poll.finally(()=>{
        if(activePoll.current===poll)activePoll.current=null
        // Refresh only a live hardware snapshot, never replace a paused local draft or reselect a page during playback.
        if(follow&&session.current===client)followPending.current=true
        runFollow()
      })
    },1000)
    return()=>clearInterval(timer)
  },[ready,connection?.key,disarm,runFollow])
  useEffect(()=>{if(locked)disarm()},[locked,disarm])
  const read=useCallback(async(data: readonly number[],selectPage=true)=>{
    const client=session.current;if(!client||reading.current||flushing.current)return
    disarm();reading.current=true;setBusy(true);setReady(false)
    const frames:number[][]=[]
    try{
      await activePoll.current;if(session.current!==client)return
      if(latest.current.locked)throw Error('Unlock the editor before changing hardware mode')
      if(selectPage)client.enterSequencer()
      const before=await client.state();let next=[...data]
      for(let track=0;track<4;track++)for(let field=0;field<9;field++){
        const r=await client.readLane(track,field);if(session.current!==client)return
        frames.push([track,field,...r.values]);next=applyHostLane(next,track,field,r.values);setStatus(`Reading sequencer · ${frames.length} / 36`)
      }
      const timing:TrackTiming[]=[]
      let timingError:string|undefined
      try{for(let track=0;track<4;track++){
          const values:number[]=[]
          for(let field=0;field<7;field++){const r=await client.readTiming(track,field);if(session.current!==client)return;values.push(r.values[0])}
          timing.push(decodeTrackTiming(values))
      }}catch(e){if(session.current!==client)return;timing.length=0;timingError=String(e)}
      const after=await client.state();if(session.current!==client)return
      if(!sameHostPatternContext(before.values,after.values))throw Error('Device state changed during read; read again')
      setRunning(Boolean(after.values[0]))
      const result={data:next,frames,state:after.values,timing,timingError,capturedAt:new Date().toISOString()};snapshot.current=result
      latest.current.onRead(result);setReady(true);armed.current=!latest.current.locked;setLive(armed.current);setStatus('Current pattern read · 4 tracks / 32 steps · no STORE sent')
    }catch(e){if(session.current===client)setStatus(String(e))}finally{if(session.current===client){reading.current=false;setBusy(false)}}
  },[disarm])
  refreshRead.current=read
  const edit=useCallback((before: readonly number[],after: readonly number[])=>{
    const client=session.current;if(!client||latest.current.locked||reading.current)return
    if(!armed.current){setReady(false);setStatus('Local edits differ from the hardware; read the current pattern before enabling live editing');return}
    try {for(const c of changedHostSteps(before,after))queue.current.set(`${c.track}:${c.step}:${c.field}`,c)}catch(e){disarm();setStatus(String(e));return}
    if(queue.current.size>128){disarm();setStatus('Too many changes: live editing paused; read the device again');setReady(false);return}
    if(flushing.current)return
    flushing.current=true;setBusy(true)
    void(async()=>{try{
      await activePoll.current
      while(queue.current.size&&armed.current&&!latest.current.locked&&session.current===client){
        const state=await client.state()
        if(!armed.current||latest.current.locked||session.current!==client)break
        setRunning(Boolean(state.values[0]))
        if(!snapshot.current||!sameHostPatternContext(state.values,snapshot.current.state))throw Error('Device state changed; read the current pattern again')
        const [key,c]=queue.current.entries().next().value!;queue.current.delete(key)
        const reply=await client.write(c.track,c.step,c.field,c.value)
        if(reply.status!==0||(reply.values[0]&65535)!==(c.value&65535))throw Error('Sequencer write not confirmed')
      }
      if(session.current===client&&armed.current)setStatus('Live edit confirmed · edit buffer only · press STORE on the BCR32 to keep it')
    }catch(e){if(session.current===client){disarm();setReady(false);setStatus(String(e))}}finally{if(session.current===client){flushing.current=false;setBusy(false);runFollow()}}})()
  },[disarm,runFollow])
  return {enabled,busy,ready,live,running,status,read,edit,disarm,snapshot,
    receive:(bytes:number[])=>session.current?.receive(bytes),
    setLive:(value:boolean)=>{if(value&&(!ready||busy||locked))return;armed.current=value;setLive(value);if(!value){followPending.current=false;queue.current.clear()}},
  }
}
