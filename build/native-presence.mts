import type {Plugin} from 'vite'
import {createNativeInventory,createNativePresenceHandler} from '../native/midi-presence.mjs'

/** Local development only. The production bundle contains no native driver or server endpoint. */
export function nativePresencePlugin():Plugin{
  return {name:'local-native-midi-presence',configureServer(server){
    const inventory=createNativeInventory(),port=server.config.server.port??5173
    const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`,`http://[::1]:${port}`]
    server.middlewares.use(createNativePresenceHandler({read:()=>inventory.read(),origins}))
  }}
}
