import {bcr32} from '../../../device-bcr32'
import type {EditorModule} from '../../../editor-host/contracts'
import {createControllerSession} from '../../../editor-host/controller-session'
import {parseControllerState} from './presets'
import {validateQuery,validateEditBuffer,validatePresetStore} from './host-policy'

// Compatible replacement of the existing B-Control BCR32 leaf. Other two family modules are unchanged.
export const bcr32Module:EditorModule={
 manifest:{id:'bcr32-editor',modelId:'bcr32',name:'BCR32',version:'0.1.0',sdkVersion:1,stateSchemaVersion:2,capabilities:['controller-profile','live-midi-values']},
 validateState:parseControllerState,validateQuery,validateEditBufferWrite:validateEditBuffer,validatePresetStoreWrite:validatePresetStore,
 create:(context,restored)=>createControllerSession(bcr32,context,restored===undefined?undefined:parseControllerState(restored)),
}
