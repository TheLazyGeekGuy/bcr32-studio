import {hex,validMessage} from './core'
export interface LearnedMidi {incoming:string;processing:string[];description:string;bytes:number[]}
/** One complete wire message, never a guessed device parameter or encoder mode. */
export function learnMidi(bytes:number[]):LearnedMidi|null{
  if(!validMessage(bytes))return null
  const status=bytes[0],kind=status&240,channel=(status&15)+1
  let incoming:string,processing:string[]=[],description:string
  if(status===240){incoming=hex(bytes);description='SysEx'}
  else if(status>=128&&status<240){
    // Do not capture a key release as the first action. The resulting Note On pattern accepts release velocity 0 too.
    if(kind===128||kind===144&&bytes[2]===0)return null
    const prefix=hex([status])
    if(kind===224){incoming=`${prefix} {lsb} {msb}`;processing=['value=lsb+(msb<<7)'];description=`Pitch Bend · CH ${channel}`}
    else if(kind===192||kind===208){incoming=`${prefix} {value}`;description=`${kind===192?'Program Change':'Channel Pressure'} · CH ${channel}`}
    else {incoming=`${prefix} ${hex([bytes[1]])} {value}`;description=`${kind===176?'CC':kind===144?'Note':'Poly Pressure'} ${bytes[1]} · CH ${channel}`}
  }else return null // Clock, sensing, timecode and system traffic must not steal the learn gesture.
  return {incoming,processing,description,bytes:[...bytes]}
}
