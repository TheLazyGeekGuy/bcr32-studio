// Generated from editor-modules.json and editor-catalog.json; do not edit.
import type {LazyEditorDefinition} from './lazy-installation'
export const generatedLazyEditors:readonly LazyEditorDefinition[]=[
{...{"manifest":{"id":"bcr32-editor","modelId":"bcr32","name":"BCR32","version":"0.1.0","sdkVersion":1,"stateSchemaVersion":2,"capabilities":["controller-profile","live-midi-values"]},"presentation":{"manufacturer":"Behringer","model":"BCR32","preview":{"src":"/editor-previews/bcr32.svg","width":1717,"height":1440,"kind":"schematic"}}},load:async()=>{const entries=await Promise.all([import("../editors/bcontrol/bcr32/module"),import("../editors/bcontrol/bcr32/registration")]);return {module:entries[0].bcr32Module,view:entries[1].bcr32View}}}
]
