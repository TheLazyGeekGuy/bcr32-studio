import {useMemo} from 'react'
import type {MidiMonitor as Monitor,MonitorRow} from './midi-monitor'
import {EditorMidiMonitor} from './EditorMidiMonitor'

/** Compatibility adapter for existing/B-Control callers; no capture or device state is duplicated. */
export function MidiMonitor({monitor,control,canApply,apply}:{
  monitor:Monitor;control:(row:MonitorRow)=>string|null;canApply:boolean;apply:(row:MonitorRow)=>void
}){
  const assignment=useMemo(()=>({canApply:(row:MonitorRow)=>canApply&&row.kind!=='RPN',apply}),[canApply,apply])
  return <EditorMidiMonitor source={monitor} describe={control} assignment={assignment}/>
}
