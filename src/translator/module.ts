import {translatorManifest} from './model'
import {createTranslatorService} from './service'
import {TranslatorPanel} from './TranslatorPanel'
// Static host-tool contribution. Importing this definition requests no ports, creates no state and starts no timer.
export const midiTranslatorModule=Object.freeze({manifest:translatorManifest,create:createTranslatorService,Panel:TranslatorPanel})
