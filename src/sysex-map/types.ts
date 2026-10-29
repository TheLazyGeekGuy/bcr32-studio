/** SXM 1.0 public file contract. No host, UI, BCL or MIDI transport dependency. */
export type ValueToken={value:{shift:number;bits:number;add:number}}
export type FieldToken={field:string;add:number}
export type ChecksumToken={checksum:{algorithm:'sum7'|'complement7'|'xor7';from:number;to:number}}
export type SxmToken=number|ValueToken|FieldToken|ChecksumToken
export interface SxmField {name:string;minimum:number;maximum:number;default:number}
export interface SxmParameter {
 id:string;name:string;value:{minimum:number;maximum:number;default?:number;unit?:string;labels?:Record<string,string>}
 fields:Record<string,SxmField>;messages:{bytes:SxmToken[]}[]
 effect:'edit-buffer'|'request'|'global-change'|'persistent-write'|'reset'|'firmware'
 evidence:'manufacturer-documented'|'local-observation'|'unverified'
 extensions?:Record<string,unknown>
}
export interface SxmDevice {
 id:string;manufacturer:string;name:string;notes:string;documentation:{sources:string[];section:string}
 parameters:SxmParameter[];extensions?:Record<string,unknown>
}
export interface SxmSource {title:string;url:string;sha256:string|null;retrieved:string;bytes?:number;retrieval?:string}
export interface SxmValue {device:string;parameter:string;value:number;fields:Record<string,number>;origin:'user'|'preset'|'observed'}
export interface SysExMap {
 format:'SysEx Map';version:'1.0';id:string;name:string;description?:string
 devices:SxmDevice[];sources:Record<string,SxmSource>;values?:SxmValue[]
 extensions?:Record<string,unknown>;requiredExtensions?:string[]
}
