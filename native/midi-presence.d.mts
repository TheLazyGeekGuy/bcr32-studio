import type {IncomingMessage,ServerResponse} from 'node:http'
interface PortInventory {getPortCount():number;getPortName(index:number):string}
export const nativePresencePath:'/__midi-studio/native-ports'
export function createNativeInventory(load?:()=>{Input:new()=>PortInventory;Output:new()=>PortInventory},now?:()=>number):{
  read():{format:'midi-studio-native-ports';version:1;complete:true;observedAt:number;platform:string;inputs:string[];outputs:string[]}
}
export function createNativePresenceHandler(options:{read:()=>unknown|Promise<unknown>;origins?:string[]}):
  (req:IncomingMessage,res:ServerResponse,next?:()=>void)=>Promise<void>
