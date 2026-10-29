import {encoderToElement} from '../../../bcl'
import {programSelector,type ProgramTarget} from './custom-program'
import type {Encoder} from './profile'

/** Reuse the shared BCL encoder; the BCR32 adapter owns its distinct physical selectors. */
export function standardProgramBody(target:ProgramTarget,control:Encoder){
 if(!programSelector(target)||target.id!==control.id||control.customAssignment||control.type==='sysex'||control.type==='bcl')throw Error('A standard assignment for one programmable BCR32 control is required')
 if(control.type==='off')return '.easypar OFF'
 // The indexed BCR32 PC bank field is not the legacy two-bank BCL object. Do not silently lose it.
 if(control.type==='pc')throw Error('Native BCR32 Program Change bank serialization is not qualified; no hardware write')
 const values=target.kind!=='encoders'&&control.buttonValues
 const body=encoderToElement(values?{...control,maximum:values[0],minimum:values[1]}:control,target.kind==='encoders')
 if(typeof body==='string')throw Error(body)
 return body.join('\n')
}
