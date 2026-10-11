import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Encoder } from './profile'
import type { Selection } from './FrontPanel'
import { modeText } from './oled-model'
import { translate, useLanguage } from './i18n'

// Small native SVG dot matrix: sharp at any panel scale, no external font.
const glyphs: Record<string, string> = {
  '/':'00001/00010/00010/00100/01000/01000/10000',
  '_':'00000/00000/00000/00000/00000/00000/11111',
  A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110', C:'01111/10000/10000/10000/10000/10000/01111',
  D:'11110/10001/10001/10001/10001/10001/11110', E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000',
  G:'01111/10000/10000/10111/10001/10001/01111', H:'10001/10001/10001/11111/10001/10001/10001', I:'11111/00100/00100/00100/00100/00100/11111',
  J:'00111/00010/00010/00010/00010/10010/01100', K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/10101/10011/10001/10001/10001', O:'01110/10001/10001/10001/10001/10001/01110',
  P:'11110/10001/10001/11110/10000/10000/10000', Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001',
  S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100', U:'10001/10001/10001/10001/10001/10001/01110',
  V:'10001/10001/10001/10001/10001/01010/00100', W:'10001/10001/10001/10101/10101/10101/01010', X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
  '0':'01110/10001/10011/10101/11001/10001/01110', '1':'00100/01100/00100/00100/00100/00100/01110', '2':'01110/10001/00001/00010/00100/01000/11111',
  '3':'11110/00001/00001/01110/00001/00001/11110', '4':'00010/00110/01010/10010/11111/00010/00010', '5':'11111/10000/10000/11110/00001/00001/11110',
  '6':'01110/10000/10000/11110/10001/10001/01110', '7':'11111/00001/00010/00100/01000/01000/01000', '8':'01110/10001/10001/01110/10001/10001/01110',
  '9':'01110/10001/10001/01111/00001/00001/01110', ':':'00000/00100/00100/00000/00100/00100/00000', '-':'00000/00000/00000/11111/00000/00000/00000',
}
function Dots({ text, x, y, size, right = false }: { text: string; x: number; y: number; size: number; right?: boolean }) {
  const start = right ? x - (text.length * 6 - 1) * size : x
  return <g>{Array.from(text).flatMap((c, i) => (glyphs[c] || '').split('/').flatMap((row, j) => Array.from(row).flatMap((v, k) => v === '1' ? [<rect key={`${i}-${j}-${k}`} x={start + (i * 6 + k) * size} y={y + j * size} width={size * .84} height={size * .84} rx={size * .18} />] : [])))}</g>
}
function ValueInput({ config, value, save, cancel }: { config: Encoder; value: number | null; save: (value: number) => void; cancel: () => void }) {
  const language = useLanguage()
  const [draft, setDraft] = useState(String(value ?? config.minimum))
  const ref = useRef<HTMLInputElement>(null), finished = useRef(false)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const commit = () => { if (finished.current) return; finished.current = true; if (draft.trim() && Number.isFinite(Number(draft))) save(Number(draft)); else cancel() }
  return <input ref={ref} className="oled-value-input" aria-label={translate('Enter the OLED value', language)} type="number" min={config.minimum} max={config.maximum} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); commit() } else if (event.key === 'Escape') { event.preventDefault(); finished.current = true; cancel() } }} />
}

export function OledDisplay({ control, config, value, source, style, inspect, setValue }: {
  control: Selection; config: Encoder; value: number | null; source: 'local' | 'midi' | 'relative'; style: CSSProperties
  inspect: () => void; setValue: (value: number) => void
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [control.kind, control.id])
  const kind = control.kind === 'encoders' ? 'ENC' : control.kind === 'pushes' ? 'PUSH' : 'BTN'
  const parameter = config.type === 'off' || config.parameterOff ? 'OFF' : `${config.type.toUpperCase()} ${config.parameter}:${modeText[config.mode]}`
  const origin = value === null ? 'UNKNOWN' : source === 'relative' ? 'EST' : source === 'midi' ? 'MIDI' : 'LOCAL'
  // Dot-matrix text (kind, parameter, origin) mimics the hardware screen and stays as is; only the spoken description is translated.
  const spokenOrigin = value === null ? t('unknown') : source === 'relative' ? t('estimated') : origin
  const description = `${kind} ${control.id}, ${parameter}, ${t('channel')} ${config.channel}, ${t('value')} ${value ?? t('unknown')}, ${spokenOrigin}`
  return <div className="oled-display" style={style} aria-label={`${t('OLED screen:')} ${description}`} data-control={control.id} data-kind={control.kind} data-value={value ?? ''} data-source={origin}>
    <div className="oled-glass" />
    <svg className="oled-pixels" style={{ visibility: config.display === false ? 'hidden' : 'visible' }} viewBox="0 0 280 112" aria-hidden="true">
      <Dots text={kind} x={15} y={10} size={2.2} />
      <Dots text={String(control.id)} x={24} y={37} size={5.3} />
      <Dots text={parameter} x={265} y={10} size={Math.min(2.2, 172 / (parameter.length * 6))} right />
      <Dots text={value === null ? '--' : String(value)} x={265} y={37} size={Math.min(5.3, 140 / ((value === null ? 2 : String(value).length) * 6))} right />
      <g className="oled-meta"><Dots text={`CH ${config.channel}`} x={15} y={94} size={1.4} /><Dots text={origin} x={265} y={94} size={1.4} right /></g>
    </svg>
    <button className="oled-inspect" aria-label={t(`Inspect ${kind} ${control.id} from the OLED screen`)} onClick={inspect} title={description} />
    <button className="oled-value-hit" aria-label={`${t('OLED value')} ${kind} ${control.id}`} title={t('Arrows: adjust. Double-click: type a value. CC sent only when enabled.')}
      onClick={inspect} onDoubleClick={() => setEditing(true)} onKeyDown={event => {
        const delta = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : 0
        if (delta || ['Home', 'End'].includes(event.key)) { event.preventDefault(); setValue(event.key === 'Home' ? config.minimum : event.key === 'End' ? config.maximum : (value ?? config.minimum) + delta) }
        if (event.key === 'Enter') { event.preventDefault(); setEditing(true) }
      }} />
    {editing && <ValueInput key={`${control.kind}-${control.id}`} config={config} value={value} save={v => { setValue(v); setEditing(false) }} cancel={() => setEditing(false)} />}
  </div>
}
