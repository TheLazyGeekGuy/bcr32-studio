import {isFrame,isFirmwareRead} from './firmware-codec'
import {deviceGlobals} from './device-globals'
import {isEncoderAssignmentWrite} from './controller-write'
import {isBclWrite,presetStorePlan} from './preset-store'
import {controllerTracksFromBcl} from './controller-tracks'

/** Model-specific framing. These validators add no grant or automatic device operation. */
export function validateQuery(bytes:readonly number[]) {
 if(!isFrame(bytes)||bytes[4]!==127)return false
 if(isFirmwareRead(bytes))return true
 return bytes.length===8&&([0,12,80,81,82].includes(bytes[6])||deviceGlobals.some(g=>g.cmd===bytes[6]))
}
export function validateBclPacket(bytes:readonly number[],persistent:boolean) {
 if(!isBclWrite(bytes,bytes[4]))return false
 const line=String.fromCharCode(...bytes.slice(9,-1)).trim()
 if(line.startsWith('$'))return ['$rev BCR32','$preset','$end',...(!persistent?['$global']:[])].includes(line)||/^\$encoder (?:[1-9]|[12]\d|3[0-2])$/.test(line)||/^\$button (?:[1-9]|[1-4]\d|50)$/.test(line)||persistent&&/^\$store (?:[1-9]|[1-5]\d|6[0-4])$/.test(line)
 return /^\.(?:name|snapshot|request|init|easypar|showvalue|mode|default|tx)(?:\s|$)/.test(line)||!persistent&&/^\.tracks(?: \d+){5}$/.test(line)
}
export function validateEditBuffer(bytes:readonly number[]) {return isEncoderAssignmentWrite(bytes,bytes[4])||validateBclPacket(bytes,false)}
export function validatePresetStore(bytes:readonly number[]) {return validateBclPacket(bytes,true)}

/** Full job preflight is stricter than a frame validator. Prepared frames are consumed exactly once by the view. */
export function plannedOperation(frames:readonly (readonly number[])[]) {
 if(!frames.length||frames.length>16384)throw Error('Invalid BCR32 transfer size')
 const device=frames[0][4]
 if(frames.some((b,i)=>!isBclWrite(b,device)||b[7]*128+b[8]!==i))throw Error('BCR32 transfer address or sequence differs')
 const lines=frames.map(b=>String.fromCharCode(...b.slice(9,-1)))
 if(lines[1]==='$global'){
  if(lines.length!==4||!controllerTracksFromBcl(lines.join('\n'))||!lines[2].trim().startsWith('.tracks '))throw Error('Only four-line shortcut globals may be written')
  return 'edit-buffer' as const
 }
 const store=lines.filter(l=>l.trim().startsWith('$store'))
 if(store.length>1||store.length===1&&!/^\$store (?:[1-9]|[1-5]\d|6[0-4])$/.test(store[0].trim()))throw Error('Invalid preset destination')
 if(store.length&&lines.at(-2)!==store[0])throw Error('STORE must immediately precede the final boundary')
 const source=lines.filter(l=>!l.trim().startsWith('$store')).join('\n')
 const name=/^\s*\.name '([^']+)'$/m.exec(source)?.[1]
 if(!name)throw Error('Complete single preset required')
 presetStorePlan(source,store.length?Number(store[0].trim().split(' ')[1])-1:0,name)
 if(frames.some(b=>!validateBclPacket(b,!!store.length)))throw Error('Unexpected preset line')
 return store.length?'preset-store' as const:'edit-buffer' as const
}
