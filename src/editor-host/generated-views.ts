// Generated from src/editor-modules.json. Run npm run modules:generate; do not edit.
import type {EditorViewRegistration} from './view-contract'
import {bcr32View as entry0} from '../editors/bcontrol/bcr32/registration'
export const generatedViews:readonly EditorViewRegistration[]=Object.freeze([entry0])
const declaredIds=["bcr32-editor"]
if(generatedViews.some((entry,index)=>entry?.moduleId!==declaredIds[index]))throw Error('Editor declaration/export mismatch')
