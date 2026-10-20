import {createRequire} from 'node:module'

export const nativePresencePath='/__midi-studio/native-ports'
/** Enumerate only. Never call openPort/openVirtualPort/sendMessage or install a MIDI callback. */
export function createNativeInventory(load=()=>createRequire(import.meta.url)('@julusian/midi'),now=()=>Date.now()){
  let input,output
  return {read(){
    if(!input||!output){const midi=load();input=new midi.Input();output=new midi.Output()}
    const names=port=>{const count=port.getPortCount();if(!Number.isInteger(count)||count<0||count>1024)throw Error('Invalid native inventory');return Array.from({length:count},(_,i)=>{const name=port.getPortName(i);if(typeof name!=='string'||!name.trim()||name.length>512||/[\x00-\x1f\x7f]/.test(name))throw Error('Invalid native port name');return name})}
    return {format:'midi-studio-native-ports',version:1,complete:true,observedAt:now(),platform:process.platform,inputs:names(input),outputs:names(output)}
  }}
}

const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host)
export function createNativePresenceHandler({read,origins=[]}){
  const allowed=new Set(origins.map(value=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.origin!==value)throw Error('Invalid allowed origin');return value}))
  return async(req,res,next)=>{
    let url,authority
    try{authority=new URL(`http://${req.headers.host}`);url=new URL(req.url??'/',authority)}catch{res.statusCode=400;res.end();return}
    if(url.pathname!==nativePresencePath){if(next)next();else{res.statusCode=404;res.end()}return}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
    const address=req.socket.remoteAddress,origin=req.headers.origin
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||!loopback(authority.hostname)||authority.username||authority.password||url.origin!==authority.origin||
      origin!==undefined&&!allowed.has(origin)||!origin&&req.headers['sec-fetch-site']==='cross-site'){
      res.statusCode=403;res.end('Forbidden');return
    }
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
    if(req.method==='OPTIONS'&&origin){res.setHeader('Access-Control-Allow-Methods','GET');if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');res.statusCode=204;res.end();return}
    if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET, OPTIONS');res.end();return}
    try{const snapshot=await read();res.setHeader('Content-Type','application/json');res.end(JSON.stringify(snapshot))}
    catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Native MIDI inventory unavailable'}))}
  }
}
