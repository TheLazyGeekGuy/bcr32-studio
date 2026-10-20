import { useEffect, useRef, useState } from 'react'
import { elementToEncoder, encoderToElement, parseBcl, preserveElement, profileToBcl, type FaderMap } from './bcl'
import type { Bcr32Profile, Encoder } from './profile'
import type { Selection } from './FrontPanel'
import { translate, useLanguage } from './i18n'

// BCL text of the selected control, editable: what the controller would receive for it. Checked on every keystroke
// (line numbers marked, errors listed); a valid text replaces the control's assignment after a short pause, like the
// form. The whole preset's text is shown read-only. B-Control models only (src/bcl.ts).
const isFader = (s: Selection, faders?: FaderMap) => s.kind === 'encoders' && !!faders && s.id >= faders.first && s.id < faders.first + faders.count
const selector = (s: Selection, faders?: FaderMap) => isFader(s, faders) ? `$fader ${s.id - faders!.first + 1}` : s.kind === 'encoders' ? `$encoder ${s.id}` : `$button ${s.id}`
export function controlBcl(s: Selection, e: Encoder, faders?: FaderMap): string {
  const body = encoderToElement(e, s.kind === 'encoders', s.kind === 'encoders' && !isFader(s, faders))
  return [selector(s, faders), ...(typeof body === 'string' ? [`  ; ${body}`, ...(e.parameterState?.statements ?? []).map(l => '  ' + l)] : body)].join('\n')
}
// Text -> assignment, or the problems by line.
export function readControlBcl(s: Selection, current: Encoder, text: string, faders?: FaderMap): { encoder: Encoder | null; errors: { line: number; message: string }[] } {
  const doc = parseBcl(['$rev R1', ...text.split(/\r?\n/)])
  const errors = doc.issues.map(i => ({ line: i.line - 1, message: i.message }))
  const elements = doc.presets.flatMap(p => p.elements)
  const first = text.split(/\r?\n/).findIndex(l => l.trim() && !l.trim().startsWith(';'))
  if (first < 0 || text.split(/\r?\n/)[first].trim().replace(/\s*;.*$/, '') !== selector(s, faders)) errors.unshift({ line: Math.max(1, first + 1), message: `The text must start with ${selector(s, faders)}` })
  if (elements.length > 1) errors.push({ line: elements[1].line - 1, message: 'Only one control here; use a BCL file for several' })
  if (errors.length || !elements.length) return { encoder: null, errors }
  const result = elementToEncoder(elements[0], current, s.kind === 'encoders')
  if (typeof result === 'string') {
    if (elements[0].custom) return { encoder: preserveElement(elements[0], { ...current, type: 'off' }, true), errors: [] }
    return { encoder: null, errors: [{ line: elements[0].line - 1, message: result }] }
  }
  return { encoder: { ...result, id: current.id }, errors: [] }
}

export function BclText({ selection, config, profile, presetName, apply, model = 'R', faders }: { selection: Selection; config: Encoder; profile: Bcr32Profile; presetName: string; apply: (encoder: Encoder) => void; model?: 'R' | 'F'; faders?: FaderMap }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [scope, setScope] = useState<'control' | 'preset'>('control')
  const source = controlBcl(selection, config, faders)
  const [text, setText] = useState(source)
  const editing = useRef(false)
  // Follow the control (selection change, form edits, undo) unless the user is typing in the text.
  useEffect(() => { if (!editing.current) setText(source) }, [source])
  const check = readControlBcl(selection, config, text, faders)
  useEffect(() => {
    if (!editing.current || !check.encoder || text === source) return
    const timer = window.setTimeout(() => { editing.current = false; apply(check.encoder!) }, 300)
    return () => window.clearTimeout(timer)
  }, [text])
  const bad = new Set(check.errors.map(e => e.line))
  const shown = scope === 'control' ? text : profileToBcl(profile, presetName || 'MIDI Studio', model, null, faders).lines.join('\n')
  return <div className="bcl-text">
    <div className="bcl-text-bar"><div className="action-tabs" role="group" aria-label={t('Text scope')}>
      <button aria-pressed={scope === 'control'} onClick={() => setScope('control')}>{t('This control')}</button>
      <button aria-pressed={scope === 'preset'} onClick={() => setScope('preset')}>{t('Whole preset')}</button></div>
      {scope === 'control' && <span className={check.errors.length ? 'bcl-status bad' : 'bcl-status ok'} role="status" data-i18n-skip>{check.errors.length ? `${check.errors.length} ${t('error(s)')}` : check.encoder?.parameterState?.opaque ? 'BCL retained · no live interpretation' : t('Syntax OK')}</span>}</div>
    <div className="bcl-editor">
      <ol className="bcl-gutter" aria-hidden="true">{shown.split('\n').map((_, i) => <li key={i} className={scope === 'control' && bad.has(i + 1) ? 'bad' : undefined}>{i + 1}</li>)}</ol>
      <textarea aria-label={t(scope === 'control' ? 'BCL text of this control' : 'BCL text of the preset')} spellCheck={false} readOnly={scope === 'preset'} value={shown} rows={Math.max(6, shown.split('\n').length + 1)}
        onFocus={() => { if (scope === 'control') editing.current = true }} onBlur={() => { editing.current = false }}
        onChange={event => { editing.current = true; setText(event.target.value) }} data-i18n-skip />
    </div>
    {scope === 'control' && check.errors.length > 0 && <ul className="bcl-errors" data-i18n-skip>{check.errors.map((e, i) => <li key={i}>{`L${e.line} · ${e.message}`}</li>)}</ul>}
    <p className="surface-help">{t(scope === 'control' ? 'A valid text applies to the control after a short pause and can be undone like any change.' : 'Exactly what a BCL file or a transfer would contain for this preset.')}</p>
  </div>
}
