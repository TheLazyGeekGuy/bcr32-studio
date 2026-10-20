import { ParameterFields } from './ParameterFields'
import schema from './parameter-schemas/bcl.json'
import type { Encoder } from './profile'
import { encoderToElement, elementToEncoder, parseBcl, preserveElement } from './bcl'
import type { ParameterState } from './parameter-state'
import type { ParameterScope } from './parameter-schema'
import { validateParameter } from './parameter-schema'
import { setStatement, statementValue } from './parameter-state'
export const bclSchema = schema
export function controlParameterState(config: Encoder, scope: ParameterScope): ParameterState {
  const body = encoderToElement(config, scope !== 'button', scope === 'encoder')
  return { ...config.parameterState, protocol: 'bcl', statements: typeof body === 'string' ? config.parameterState?.statements ?? [] : body.map(l => l.trim()) }
}
export function applyControlParameters(config: Encoder, scope: ParameterScope, state: ParameterState): Encoder {
  const doc = parseBcl(`$rev R1\n$${scope} ${scope === 'fader' ? 1 : config.id}\n${state.statements.join('\n')}\n$end`)
  if (doc.issues.length) throw new Error(doc.issues.map(i => i.message).join('; '))
  const element = doc.presets[0]?.elements[0]
  if (!element) throw new Error('No control definition')
  const projected = elementToEncoder(element, config, scope !== 'button')
  return typeof projected === 'string' ? preserveElement(element, { ...config, type: 'off' }, true) : projected
}
export function BclParameters({ config, scope, change, capabilities }: { config: Encoder; scope: ParameterScope; change: (encoder: Encoder) => void; capabilities?: string[] }) {
  const state = controlParameterState(config, scope), args = statementValue(state, 'easypar')?.split(/\s+/) ?? []
  const output = schema.outputs.find(o => o.type === args[0])
  return <><div className="protocol-fields">{output?.fields.filter(f => f.scopes.includes(scope)).map(field => <label className="protocol-field" key={field.id} data-i18n-skip><span>{field.label}</span>
    {field.kind === 'choice' ? <select aria-label={field.label} value={args[field.index] ?? ''} onChange={e => { const next = [...args]; next[field.index] = e.target.value; change(applyControlParameters(config, scope, setStatement(state, 'bcl', 'easypar', next.join(' ')))) }}>{('choices' in field ? field.choices : []).map(v => <option key={v}>{v}</option>)}</select> :
    <input aria-label={field.label} value={args[field.index] ?? 'off'} onChange={e => { if (!e.target.value || validateParameter(field, e.target.value)) return; const next = [...args]; next[field.index] = e.target.value; change(applyControlParameters(config, scope, setStatement(state, 'bcl', 'easypar', next.join(' ')))) }} />}
  </label>)}</div><ParameterFields schema={schema} scope={scope} state={state} capabilities={capabilities} change={next => change(applyControlParameters(config, scope, next))} /></>
}
