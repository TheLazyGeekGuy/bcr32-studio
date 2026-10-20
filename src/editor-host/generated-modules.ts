// Generated from src/editor-modules.json. Run npm run modules:generate; do not edit.
import type {EditorModule} from './contracts'
import {bcr32Module as entry0} from '../editors/bcontrol/bcr32/module'
export const generatedModules:readonly EditorModule[]=Object.freeze([entry0])
const declaredIds=["bcr32-editor"]
if(generatedModules.some((entry,index)=>entry?.manifest.id!==declaredIds[index]))throw Error('Editor declaration/export mismatch')
