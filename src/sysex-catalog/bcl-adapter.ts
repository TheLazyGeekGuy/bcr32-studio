import {renderParameter,type SxmDevice,type SxmParameter} from '../sysex-map'

/** Local capability adapter only. Rendering a file never grants native execution. */
export function parameterBcl(device:SxmDevice,p:SxmParameter,fields:Readonly<Record<string,number>>={}):string{
 if(!['edit-buffer','request'].includes(p.effect))throw Error(`BCL loading is unavailable for effect ${p.effect}; export the SXM definition instead`)
 if(p.value.minimum<0)throw Error('Signed logical ranges are not supported by this BCL adapter')
 renderParameter(p,p.value.minimum,fields)
 const lines=p.messages.map(message=>{
  const values=message.bytes.filter(t=>typeof t!=='number'&&'value'in t).length
  const words=message.bytes.map((t,i)=>{
   if(typeof t==='number')return '$'+t.toString(16).toUpperCase().padStart(2,'0')
   if('field'in t)return '$'+((fields[t.field]??p.fields[t.field].default)+t.add).toString(16).toUpperCase().padStart(2,'0')
   if('value'in t){const v=t.value;if(v.add!==0)throw Error('Value offsets require a different BCL adapter')
    const token=values===1&&v.shift===0&&v.bits===7?'val':`val${v.shift}.${v.shift+v.bits-1}`
    if(!['val','val0.6','val0.3','val4.7','val8.11','val12.13','val7.13','val1.7'].includes(token))throw Error(`BCL value slice unavailable: ${token}`)
    return token}
   if(t.checksum.to!==i-1)throw Error('BCL checksum cannot stop before the immediately preceding byte')
   return `${t.checksum.algorithm==='sum7'?'cks-2':t.checksum.algorithm==='complement7'?'cks-1':'cks-3'} ${t.checksum.from}`
  })
  return '.tx '+words.join(' ')
 })
 const header=`; ${device.manufacturer} ${device.name} / ${p.name}`.replace(/[^\x20-\x7e]/g,'?')
 const source=[header,`.minmax ${p.value.minimum} ${p.value.maximum}`,...lines,'.showvalue on'].join('\n')
 if(source.length>65536||source.split('\n').some(l=>l.length>600))throw Error('Definition exceeds BCL editor limits')
 return source
}
