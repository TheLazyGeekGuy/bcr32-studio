import { useLanguage, translate } from './i18n'
import { controllerGroups, type ControllerGroup, type ControllerReadState, type TargetSnapshot } from './controller-read'
import { targetFields } from './firmware-codec'

export function FirmwareIdentity({ firmware, previous, canProbe, probe }: { firmware: string | null; previous: string | null; canProbe: boolean; probe: () => void }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  return <div className="firmware-identity"><strong>{t('Firmware:')} <span data-i18n-skip>{firmware ?? t('Not detected')}</span></strong>
    {!firmware && previous && <small>{t('Last known firmware:')} <span data-i18n-skip>{previous}</span></small>}
    <button disabled={!canProbe} onClick={probe}>{t('Read firmware version')}</button>
  </div>
}

// Presets › BCR32 › Synchronize assignments: read the active controller assignments. Automatic reading at connection is
// chosen in the MIDI connection window; the groups to read and the preset cache sit under one Read options disclosure.
export function ControllerReadPanel({ cacheEnabled, setCacheEnabled, fromCache, groups, setGroups, canRead, state, read, cancel }: {
  cacheEnabled: boolean; setCacheEnabled: (on: boolean) => void; fromCache: boolean
  groups: ControllerGroup[]; setGroups: (groups: ControllerGroup[]) => void
  canRead: boolean; state: ControllerReadState; read: () => void; cancel: () => void
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const busy = state.status === 'reading'
  const labels = ['Buttons 1–16', 'Encoder pushes 1–32', 'Footswitches 1–2', 'Encoder rotations 1–32']
  const status = { idle: 'Waiting for controller read', reading: 'Reading controller assignments', complete: 'Controller read complete', cancelled: 'Read cancelled', 'no reply': 'Controller read incomplete · missing replies', failed: 'Read failed' }
  return <section className="controller-read-panel mock-card" aria-label={t('Synchronize assignments')}>
    <b>{t('Synchronize assignments')} <span className="info-tip" title={t('Reads the active controller assignments. No sequencer track reads or preset changes. Live knob positions are separate MIDI values.')} aria-label={t('Reads the active controller assignments. No sequencer track reads or preset changes. Live knob positions are separate MIDI values.')}>ⓘ</span></b>
    <p className="mock-caption" role="status">{t(fromCache ? 'Preset restored from UI cache' : status[state.status])}{!fromCache && state.total > 0 && <span data-i18n-skip> · {state.received}/{state.total}</span>}</p>
    <div className="mock-actions"><button className="primary" disabled={!canRead || busy || !groups.length} onClick={read}>{t('Read the BCR32')}</button>{busy && <button onClick={cancel}>{t('Cancel read')}</button>}</div>
    {busy && <progress aria-label={t('Controller read progress')} value={state.done} max={state.total || 1} />}
    <details className="controller-read-options adv"><summary>{t('Read options')}</summary>
      <fieldset disabled={busy}><legend>{t('Controls to read')}</legend>{controllerGroups.map((group, i) => <label className="zoom-option" key={group}><input type="checkbox" checked={groups.includes(group)} onChange={e => setGroups(e.target.checked ? [...groups, group] : groups.filter(g => g !== group))} />{t(labels[i])}</label>)}</fieldset>
      <label className="zoom-option"><input type="checkbox" checked={cacheEnabled} onChange={e => setCacheEnabled(e.target.checked)} />{t('UI preset cache · UI is the source of truth')}<span className="info-tip" title={t('Read each preset once per connection. T1–T4 then restore cached assignments and values, including UI edits. Unobserved hardware changes are ignored. Read controller now refreshes this preset. Cached edits are not automatically resent or stored.')}> ⓘ</span></label>
      <p className="surface-help">{t('In CTRL mode, T1–T4 recall four preset shortcuts. Their bindings and selected track are read separately from the global BCL.')}</p>
    </details>
  </section>
}

export function ControllerReadValues({ snapshot }: { snapshot?: TargetSnapshot }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  if (!snapshot) return null
  return <details className="controller-read-values"><summary>{t('Assignment read from controller')}</summary>
    <p>{t('Raw replies are preserved. Unsupported assignments stay raw and do not replace the local editor fields.')}</p>
    <table><thead><tr><th>{t('Field')}</th><th>BCR32</th></tr></thead><tbody>{targetFields.map((key, i) => <tr key={key}><td>{t(['Type', 'Channel', 'Parameter', 'Value 1', 'Value 2', 'Mode', 'Option', 'Display'][i])}</td><td data-i18n-skip>{snapshot.fields[key]?.signed ?? (snapshot.emptyFields?.includes(key) ? t('Empty reply') : '—')}</td></tr>)}</tbody></table>
  </details>
}
