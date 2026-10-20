import { bclLine } from './bcl'
import { presetStorePlan } from './preset-store'
import type { PresetRead, PresetReadResult } from './controller-presets'
export type ControllerTracks = { presets: [number, number, number, number]; selected: number }
export type TrackFeedback = { tracks: ControllerTracks | null }
export const controllerTrackColors = ['green', 'orange', 'blue', 'green'] as const // Operator observation on CTRL/1.0.2; labels only.
export function controllerTracksFromBcl(text: string): ControllerTracks | null {
  const lines=text.split('\n').map(s=>s.trim())
  if(lines[0]!=='$rev BCR32'||!lines.includes('$global')||lines.at(-1)!=='$end')return null
  const entries=lines.filter(s=>s.startsWith('.tracks'))
  if(entries.length!==1||!/^\.tracks(?: \d+){5}$/.test(entries[0]))return null
  const values=entries[0].split(' ').slice(1).map(Number)
  if(values.slice(0,4).some(n=>n<1||n>64)||values[4]<1||values[4]>4)return null
  return {presets:values.slice(0,4) as ControllerTracks['presets'],selected:values[4]}
}
export function tracksLines(tracks: ControllerTracks) {
  const lines=['$rev BCR32','$global',`  .tracks ${tracks.presets.join(' ')} ${tracks.selected}`,'$end']
  if(!controllerTracksFromBcl(lines.join('\n')))throw Error('Four preset slots 1–64 and a selected track 1–4 are required')
  lines.forEach((line,i)=>bclLine(i,line));return lines
}
export function trackTextColor(index: number, feedback: TrackFeedback) {
  return feedback.tracks?.selected===index+1?'green':'red'
}
// Physically checked on1.0.2: four ACK=0, independent global read-back. This reloads the
// selected preset, even if only an inactive binding changed. No STORE or other global directive.
export async function applyControllerTracks({read,transfer,backup,presets,selected}:{
  read:(request:PresetRead)=>Promise<PresetReadResult>;transfer:(lines:readonly string[])=>Promise<void>;backup:(contents:string)=>void;
  presets?:ControllerTracks['presets'];selected?:number
}) {
  const complete=async(request:PresetRead)=>{const r=await read(request);if(r.status!=='complete')throw Error('Complete controller backup required');return r.text}
  const globals=await complete({kind:'global'}),working=await complete({kind:'working'}),before=controllerTracksFromBcl(globals)
  if(!before)throw Error('Controller shortcuts have not been read')
  const next={presets:presets??before.presets,selected:selected??before.selected};const lines=tracksLines(next)
  if(JSON.stringify(next)===JSON.stringify(before))return {tracks:next,globals}
  const samePreset=next.selected===before.selected&&next.presets[next.selected-1]===before.presets[before.selected-1]
  if(samePreset&&(!working.startsWith('$rev BCR32\n$preset\n')||!working.endsWith('\n$end')))throw Error('A complete working preset is required for restoration')
  if(samePreset)presetStorePlan(working,before.presets[before.selected-1]-1,'Shortcut backup') // Validate restoration directives; do not use the STORE plan.
  backup(JSON.stringify({at:new Date().toISOString(),globals,working,before,next}))
  await transfer(lines)
  const after=await complete({kind:'global'})
  if(JSON.stringify(controllerTracksFromBcl(after))!==JSON.stringify(next)||after.replace(/^\s*\.tracks.*$/m,'')!==globals.replace(/^\s*\.tracks.*$/m,''))throw Error('Shortcut/global read-back differs; backup retained')
  if(samePreset){await transfer(working.split('\n'));if(await complete({kind:'working'})!==working)throw Error('Working preset restoration differs; backup retained')}
  return {tracks:next,globals:after}
}
