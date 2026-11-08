import {customValueMessages} from '../../../custom-value-output'

/** Payloads for another instrument, never BCR32 configuration/firmware or universal system commands. */
export function bcr32CustomValueMessages(source:string,value:number){
  const messages=customValueMessages(source,value)
  if(messages.some(b=>b[1]===0x7e||b[1]===0x7f||b[1]===0&&b[2]===0x20&&b[3]===0x32))throw Error('BCR32 and universal system commands cannot be sent as custom values')
  return messages
}
