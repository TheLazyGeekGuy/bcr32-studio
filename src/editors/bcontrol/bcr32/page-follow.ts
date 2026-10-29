import {decodeControllerDump} from './controller-dump'
import {decodeZaqBlock} from './zaquencer'
import {midiFrame} from './firmware-codec'

export type EditorPage='controller'|'sequencer'
// ControlTribe1.12.4 ExportCurrentPage, physically compared in CTRL/ZQR on1.0.3.
// Advances the export cursor, never selects a page or writes a preset.
export const currentPageQuery=()=>midiFrame(8)
export function pageFromExport(bytes:readonly number[]):EditorPage|null{
  if(bytes.length!==273||bytes[4]!==127||bytes[8]!==2||bytes[11]>7)return null
  const controller=decodeControllerDump(bytes)
  if(controller?.checksumOk)return 'controller'
  return decodeZaqBlock(bytes)?'sequencer':null
}
// No automatic follower is provided. Physical acceptance showed that repeated export08
// blocks the device mode key. This pure parser documents captured exports only.
