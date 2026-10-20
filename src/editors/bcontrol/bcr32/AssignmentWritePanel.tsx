import {controllerTargets} from './controller-read'
import {displayControlId} from './profile'
import { translate, useLanguage } from './i18n'
import type { AssignmentWriteState } from './controller-write'

export function AssignmentWriteStatus({ enabled, available, state }: { enabled: boolean; available: boolean; state: AssignmentWriteState }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const text = !enabled ? 'Assignment edits stay local' : !available ? 'Assignment sending waits for a complete controller read' : {
    idle: 'Immediate assignment sending ready · CC/NRPN encoders and OFF', pending: 'Assignment changes queued', writing: 'Writing controller assignment', confirmed: 'Assignment read-back confirmed', failed: 'Assignment not confirmed · remaining writes stopped', cancelled: 'Assignment sending cancelled',
  }[state.status]
  const target=state.index===undefined?undefined:controllerTargets[state.index]
  return <p className="assignment-write-status" role="status">{t(text)}{target && <span> · {t(target.kind==='encoders'?'Encoder':target.kind==='pushes'?'Push':'Button')} {displayControlId(target.kind,target.id)}</span>}</p>
}
export function AssignmentWritePanel({ enabled, setEnabled, available, state }: { enabled: boolean; setEnabled: (on: boolean) => void; available: boolean; state: AssignmentWriteState }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  return <section className="controller-read-panel" aria-label={t('Assignment sending')}>
    <h3>{t('Assignment sending')}</h3>
    <label className="zoom-option"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{t('Send assignment edits immediately')}</label>
    <AssignmentWriteStatus enabled={enabled} available={available} state={state} />
    <p className="surface-help">{t('CC/NRPN encoder settings and Type OFF for buttons, pushes and encoders. Each change is read back. Preset saving stays manual.')}</p>
  </section>
}
