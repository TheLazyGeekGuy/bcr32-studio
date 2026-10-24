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
