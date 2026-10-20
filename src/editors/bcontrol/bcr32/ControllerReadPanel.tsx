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

export function ControllerReadPanel({ cacheEnabled, setCacheEnabled, fromCache, autoRead, setAutoRead, groups, setGroups, canRead, state, read, cancel }: {
  cacheEnabled: boolean; setCacheEnabled: (on: boolean) => void; fromCache: boolean
  autoRead: boolean; setAutoRead: (on: boolean) => void; groups: ControllerGroup[]; setGroups: (groups: ControllerGroup[]) => void
  canRead: boolean; state: ControllerReadState; read: () => void; cancel: () => void
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const busy = state.status === 'reading'
  const labels = ['Buttons 1–16', 'Encoder pushes 1–32', 'Footswitches 1–2', 'Encoder rotations 1–32']
  const status = { idle: 'Waiting for controller read', reading: 'Reading controller assignments', complete: 'Controller read complete', cancelled: 'Read cancelled', 'no reply': 'Controller read incomplete · missing replies', failed: 'Read failed' }
  return <section className="controller-read-panel" aria-label={t('Controller synchronization')}>
    <h3>{t('Controller synchronization')}</h3>
    <label className="zoom-option"><input type="checkbox" checked={autoRead} onChange={e => setAutoRead(e.target.checked)} />{t('Auto-read controller assignments at connection')}</label>
    <label className="zoom-option"><input type="checkbox" checked={cacheEnabled} onChange={e => setCacheEnabled(e.target.checked)} />{t('UI preset cache · UI is the source of truth')}</label>
    <p className="surface-help">{t('Read each preset once per connection. T1–T4 then restore cached assignments and values, including UI edits. Unobserved hardware changes are ignored. Read controller now refreshes this preset. Cached edits are not automatically resent or stored.')}</p>
    <fieldset disabled={busy}><legend>{t('Controls to read')}</legend>{controllerGroups.map((group, i) => <label className="zoom-option" key={group}><input type="checkbox" checked={groups.includes(group)} onChange={e => setGroups(e.target.checked ? [...groups, group] : groups.filter(g => g !== group))} />{t(labels[i])}</label>)}</fieldset>
    <p className="surface-help">{t('Reads the active controller assignments. No sequencer track reads or preset changes. Live knob positions are separate MIDI values.')}</p>
    <button disabled={!canRead || busy || !groups.length} onClick={read}>{t('Read controller now')}</button>{busy && <button onClick={cancel}>{t('Cancel read')}</button>}
    <p role="status">{t(fromCache ? 'Preset restored from UI cache' : status[state.status])}{!fromCache && state.total > 0 && <span data-i18n-skip> · {state.received}/{state.total}</span>}</p>
    {busy && <progress aria-label={t('Controller read progress')} value={state.done} max={state.total || 1} />}
    <p className="surface-help">{t('In CTRL mode, T1–T4 recall four preset shortcuts. Their bindings and selected track are read separately from the global BCL.')}</p>
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
