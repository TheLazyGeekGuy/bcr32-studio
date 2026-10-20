import { useEffect, useState } from 'react'
import { changeParameter, fieldValue, validateParameter, type ParameterSchema, type ParameterScope, type ParameterField } from './parameter-schema'
import type { ParameterState } from './parameter-state'
function Field({ field, state, protocol, change, disabled }: { field: ParameterField; state?: ParameterState; protocol: string; change: (state: ParameterState) => void; disabled?: boolean }) {
  const source = fieldValue(state, field), [draft, setDraft] = useState(source)
  useEffect(() => setDraft(source), [source])
  const error = validateParameter(field, draft)
  const update = (value: string) => { setDraft(value); if (!validateParameter(field, value)) change(changeParameter(state, protocol, field, value)) }
  return <label className="protocol-field" data-i18n-skip><span>{field.label}</span>
    {field.kind === 'choice' ? <select aria-label={field.label} disabled={disabled} value={source} onChange={e => update(e.target.value)}><option value="">—</option>{source && !field.choices?.includes(source) && <option value={source}>{source}</option>}{field.choices?.map(v => <option key={v}>{v}</option>)}</select> :
      field.kind === 'flag' ? <input aria-label={field.label} type="checkbox" disabled={disabled} checked={state?.statements.includes('.' + field.id) ?? false} onChange={e => change({ ...state, protocol, statements: e.target.checked ? [...(state?.statements ?? []).filter(l => l !== '.' + field.id), '.' + field.id] : (state?.statements ?? []).filter(l => l !== '.' + field.id) })} /> :
      field.kind === 'lines' ? <textarea aria-label={field.label} disabled={disabled} value={draft} rows={3} spellCheck={false} onChange={e => update(e.target.value)} /> :
      <input aria-label={field.label} disabled={disabled} value={draft} placeholder="—" aria-invalid={!!error} onChange={e => update(e.target.value)} />}
    {error && <small role="alert">{error}</small>}
  </label>
}
export function ParameterFields({ schema, scope, state, change, disabled, capabilities }: { schema: ParameterSchema; scope: ParameterScope; state?: ParameterState; change: (state: ParameterState) => void; disabled?: boolean; capabilities?: string[] }) {
  return <div className="protocol-fields">{schema.fields.filter(f => f.scopes.includes(scope) && (capabilities === undefined || f.requires?.every(c => capabilities.includes(c)) !== false)).map(field => <Field key={field.id} field={field} state={state} protocol={schema.id} change={change} disabled={disabled} />)}</div>
}
