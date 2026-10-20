import {canvasSize} from './display-canvas'
import {openFloatingScreen,floatingScreenSupported} from './editor-host/floating-screen'
export type {FloatingScreen} from './editor-host/floating-screen'
export const floatingSupported=floatingScreenSupported
// Compatible legacy adapter; only this wrapper knows the old display-canvas dimensions.
export function openFloatingDisplay(draw:(ctx:CanvasRenderingContext2D)=>void,closed:()=>void){
 return openFloatingScreen({...canvasSize,draw},closed)
}
