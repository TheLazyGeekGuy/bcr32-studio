import type { DeviceDefinition } from './device-definition'
import { sysexHeader, isDevicePort } from './device-definition'
import * as profiles from './profile'
import * as presets from './presets'
import * as midi from './controller-midi'
import * as transport from './cc-transport'
import { automaticPorts } from './auto-midi'
import { parseFirmwareReply } from './web-midi'
import { createBrightnessTransport } from './led-brightness'
import { createGlobalsReader } from './device-globals'
import { decodeControllerDump } from './controller-dump'
import { applySelectionChange } from './multi-selection'
import { applyLearn } from './midi-learn'
import { controlLabelFor } from './control-labels'
import { loadNames } from './parameter-names'
import { parseTheme, themeStorageKey } from './themes'

export type EditorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function createEditorEnvironment(device: DeviceDefinition, instanceId?: string, backing?: EditorStorage) {
  if (instanceId !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(instanceId)) throw Error('Invalid editor instance namespace')
  const key = (name: string) => instanceId ? `bcr-studio.instance.${instanceId}.${name}` :
    device.id === 'bcr32' ? name : name.replace(/^bcr32-studio\./, `bcr-studio.${device.id}.`)
  const store = () => backing ?? window.localStorage
  const storage: EditorStorage = { getItem: name => store().getItem(key(name)), setItem: (name, value) => store().setItem(key(name), value), removeItem: name => store().removeItem(key(name)) }
  const parseState = (value: unknown) => presets.parseControllerState(value, device)
  const createProfile = () => profiles.createProfile(device)
  const storageKey = 'bcr32-studio.profile.v1', draftStorageKey = 'bcr32-studio.draft.v1', presetStorageKey = 'bcr32-studio.presets.v1', workspaceKey = 'bcr32-studio.workspace.v1'
  function loadProfile() { try { const json = storage.getItem(storageKey); if (json) return profiles.parseProfile(JSON.parse(json), device) } catch { /* Preserve inaccessible data. */ } return createProfile() }
  function loadDraft() { try { const json = storage.getItem(draftStorageKey); if (json) return parseState(JSON.parse(json)) } catch { /* Recover from the profile. */ } return { profile: loadProfile(), labels: presets.emptyLabels(device), values: presets.emptyValues(device), ringMode: 'bar' as const } }
  return {
    device, instanceId, storage, storageKey, draftStorageKey, presetStorageKey, workspaceKey, key,
    seedLegacy() {
      if (!instanceId) return
      const keys = [storageKey,draftStorageKey,presetStorageKey,workspaceKey,themeStorageKey,'bcr32-studio.parameter-names.v2',
        'bcr32-studio.auto-zoom','bcr32-studio.show-numbers','bcr32-studio.name-screen','bcr32-studio.display-style','bcr32-studio.monitor-open','bcr32-studio.device-autoload']
      for (const name of keys) {
        const legacy = device.id === 'bcr32' ? name : name.replace(/^bcr32-studio\./, `bcr-studio.${device.id}.`)
        try { if (storage.getItem(name) === null) { const value = store().getItem(legacy); if (value !== null) storage.setItem(name, value) } } catch { /* Preserve legacy data. */ }
      }
    },
    createProfile, loadDraft,
    parseProfile: (value: unknown) => profiles.parseProfile(value, device),
    parseControllerState: parseState,
    emptyLabels: () => presets.emptyLabels(device), emptyValues: () => presets.emptyValues(device),
    controlIndex: (kind: presets.ControlGroup, id: number) => presets.controlIndex(kind, id, device),
    parsePreset: (value: unknown) => presets.parsePreset(value, device),
    parseLibrary: (value: unknown) => presets.parseLibrary(value, device),
    makePreset: (state: presets.ControllerState, name: string, id?: string, at?: string) => presets.makePreset(state, name, id, at, device),
    sameState: (a: presets.ControllerState, b: presets.ControllerState) => JSON.stringify(parseState(a)) === JSON.stringify(parseState(b)),
    loadLibrary() { try { return presets.parseLibrary(JSON.parse(storage.getItem(presetStorageKey) || 'null'), device) } catch { return [] } },
    loadWorkspace() { try { const v = JSON.parse(storage.getItem(workspaceKey) || 'null'); if (v && typeof v.id === 'string' && typeof v.name === 'string' && v.name.length <= 80) return v as { id: string; name: string } } catch { /* Fresh instance. */ } return { id: '', name: 'My preset' } },
    loadTheme: () => { try { return parseTheme(storage.getItem(themeStorageKey)) } catch { return 'original' as const } },
    loadNames: () => loadNames(storage),
    modesFor: (type: profiles.EncoderType, rotation: boolean) => profiles.modesFor(type, rotation, device),
    createMidiDecoder: (profile: profiles.ControllerProfile) => midi.createMidiDecoder(profile, device),
    decoderKey: (profile: profiles.ControllerProfile) => midi.decoderKey(profile, device),
    encoderMessages: (encoder: profiles.Encoder, value: number, previous?: number) => transport.encoderMessages(encoder, value, previous, device),
    buttonValue: (encoder: profiles.Encoder, previous: number | null, pressed: boolean) => midi.buttonValue(encoder, previous, pressed, device),
    transportIssue: (encoder: profiles.Encoder) => midi.transportIssue(encoder, device),
    createCcSender: (send: (bytes: number[]) => void, sent: (bytes: number[]) => void, failed: (e: unknown) => void) => transport.createCcSender(send, sent, failed, 33, device),
    isBcrOutput: (port?: import('./web-midi').MidiPort): port is import('./web-midi').MidiPort => !!port?.send && isDevicePort(device, port),
    automaticPorts: (access: import('./web-midi').MidiAccess, input = '', output = '') => automaticPorts(access, input, output, device),
    productQuery: [...sysexHeader(device), 0, 247],
    parseFirmwareReply: (bytes: number[]) => parseFirmwareReply(bytes, device),
    createBrightnessTransport: (send: (bytes: number[]) => void, changed: (state: import('./led-brightness').BrightnessState) => void) => createBrightnessTransport(send, changed, 80, 2000, device),
    createGlobalsReader: (send: (bytes: number[]) => void) => createGlobalsReader(send, 400, undefined, device),
    decodeControllerDump: (bytes: number[]) => decodeControllerDump(bytes, device),
    applySelectionChange: (profile: profiles.ControllerProfile, targets: import('./multi-selection').ControlSelection[], change: import('./multi-selection').ControlChange) => applySelectionChange(profile, targets, change, device),
    applyLearn: (control: profiles.Encoder, kind: import('./controller-midi').Control['kind'], result: import('./midi-learn').LearnResult) => applyLearn(control, kind, result, device),
    controlLabel: (kind: presets.ControlGroup, id: number, labels: presets.VisualLabels) => controlLabelFor(device, kind, id, labels),
  }
}
export type EditorEnvironment = ReturnType<typeof createEditorEnvironment>
