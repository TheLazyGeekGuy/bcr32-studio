import { useEffect, useRef, useState } from 'react'
import type { Bcr32Profile } from './profile'
import type { DeviceDefinition } from './device-definition'
import type { Selection, LiveValues } from './FrontPanel'
import { controlIndex, type PresetValues, type VisualLabels } from './presets'
import { ledSegments } from './led-modes'
import type { SelectionGesture } from './multi-selection'
import { translate, useLanguage } from './i18n'
import { dragMoveProps, type MoveKind, type MoveMode } from './control-move'
import { presetSettings } from './bcl'

// Front panel drawn from a device definition (models without a dedicated drawing, e.g. the BCR2000): rows of encoders
// with their LED rings, push assignments, keys, faders and four-character display.
// All value gestures use the same preview/MIDI transport as the inspector.
const ring = (segments: boolean[]) => <svg viewBox="0 0 64 64" aria-hidden="true">
  {segments.map((on, i) => { const a = (-225 + 270 * i / 20) * Math.PI / 180; return <circle key={i} cx={(32 + 25 * Math.cos(a)).toFixed(1)} cy={(32 + 25 * Math.sin(a)).toFixed(1)} r="2.4" className={on ? 'seg on' : 'seg'} /> })}
  <circle cx="32" cy="32" r="16" className="knob" />
</svg>
export function DevicePanel({ device, profile, selection, selections = [selection], select, values = {}, auxValues, customLabels, screenControl, screenValue, showNumbers = true, move, setValue, mouseMulti = false, selectMany }: {
  device: DeviceDefinition; profile: Bcr32Profile; selection: Selection; selections?: Selection[]
  select: (value: Selection, gesture?: SelectionGesture) => void
  values?: LiveValues; auxValues: PresetValues; customLabels: VisualLabels
  screenControl: Selection; screenValue: { value: number | null }; showNumbers?: boolean
  move?: (kind: MoveKind, from: number, to: number, mode: MoveMode) => void // drag and drop: swap, insert, copy (Alt)
  setValue?: (id: number, value: number) => void // mouse wheel on an encoder: ±4 per notch, ±1 with Shift
  mouseMulti?: boolean
  selectMany?: (values: Selection[]) => void
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const groups = device.encoderGroups ?? 1, available = device.bclModel ? presetSettings(profile).egroups : groups
  // Show the group of a selected push encoder (1–32), wherever the selection came from (panel, search, MIDI).
  const groupOf = (s: Selection) => s.kind !== 'buttons' && groups > 1 && s.id <= 8 * groups ? Math.ceil(s.id / 8) : null
  const [group, setGroup] = useState(() => groupOf(selection) ?? 1)
  useEffect(() => { const g = groupOf(selection); if (g) setGroup(g) }, [selection.kind, selection.id, groups])
  const gesture = (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => ({ toggle: mouseMulti || event.metaKey || event.ctrlKey, range: event.shiftKey })
  const selected = (kind: Selection['kind'], id: number) => selections.some(s => s.kind === kind && s.id === id)
  const label = (kind: Selection['kind'], id: number) => customLabels[kind][controlIndex(kind, id, device)]?.trim() || device.printedName(kind, id)
  // Wheel: a native listener, React's is passive and could not keep the page from scrolling.
  const root = useRef<HTMLDivElement>(null), wheel = useRef({ profile, values, setValue, mouseMulti }); wheel.current = { profile, values, setValue, mouseMulti }
  const [rectangle, setRectangle] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null)
  const marquee = useRef<{ x: number; y: number; pointer: number } | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-encoder]'), { profile: p, values: v, setValue: set } = wheel.current
      const e = cell && p.encoders.find(x => x.id === Number(cell.dataset.encoder))
      if (!e || !set || e.type === 'off' || wheel.current.mouseMulti) return
      event.preventDefault()
      const step = (event.shiftKey ? 1 : 4) * Math.max(1, Math.round((e.maximum - e.minimum) / 127)) * (event.deltaY < 0 ? 1 : -1)
      set(e.id, Math.max(e.minimum, Math.min(e.maximum, (v[e.id]?.value ?? e.minimum) + step)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const shown = screenValue.value === null ? (screenControl.kind === 'buttons' ? '' : 'P-' + String(group)) : String(screenValue.value).slice(-4)
  return <div className="device-panel" ref={root} aria-label={`${device.name} ${t('front panel')}`}
    onPointerDown={event => {
      if (!mouseMulti || !selectMany || event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,a')) return
      const bounds = event.currentTarget.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top
      marquee.current = { x, y, pointer: event.pointerId }; setRectangle({ x, y, endX: x, endY: y })
      event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault()
    }}
    onPointerMove={event => {
      const start = marquee.current
      if (!start || start.pointer !== event.pointerId) return
      const bounds = event.currentTarget.getBoundingClientRect()
      setRectangle({ ...start, endX: event.clientX - bounds.left, endY: event.clientY - bounds.top })
    }}
    onPointerUp={event => {
      const start = marquee.current
      if (!start || start.pointer !== event.pointerId) return
      marquee.current = null; setRectangle(null)
      const bounds = event.currentTarget.getBoundingClientRect(), endX = event.clientX - bounds.left, endY = event.clientY - bounds.top
      if (Math.hypot(endX - start.x, endY - start.y) < 4) return
      const controls: Selection[] = []
      for (const element of event.currentTarget.querySelectorAll<HTMLElement>('[data-control-kind]')) {
        const box = element.getBoundingClientRect(), x = box.left + box.width / 2 - bounds.left, y = box.top + box.height / 2 - bounds.top
        if (x >= Math.min(start.x, endX) && x <= Math.max(start.x, endX) && y >= Math.min(start.y, endY) && y <= Math.max(start.y, endY)) controls.push({ kind: element.dataset.controlKind as Selection['kind'], id: Number(element.dataset.controlId) })
      }
      if (controls.length) selectMany?.(controls)
    }}
    onPointerCancel={() => { marquee.current = null; setRectangle(null) }}>
    {rectangle && <div className="device-selection-rectangle" aria-hidden="true" style={{ left: Math.min(rectangle.x, rectangle.endX), top: Math.min(rectangle.y, rectangle.endY), width: Math.abs(rectangle.endX - rectangle.x), height: Math.abs(rectangle.endY - rectangle.y) }} />}
    <div className="device-panel-head"><span className="device-panel-model" data-i18n-skip>{device.name}</span>
      <output className="led4" aria-label={`${t('Value display')}: ${shown || '—'}`} data-i18n-skip>{shown.padStart(4, ' ')}</output></div>
    {device.panel.sections!.map(section => <section key={section.title} className="device-panel-section">
      <h3><span>{t(section.title)}</span>{section.group && groups > 1 && <span className="encoder-groups" role="group" aria-label={t('Encoder group')}>
        {Array.from({ length: groups }, (_, i) => i + 1).map(g => <button key={g} data-i18n-skip className={g > available ? 'unavailable' : undefined} aria-pressed={group === g} aria-label={`${t('Encoder group')} ${g}`} title={g > available ? `.egroups ${available}` : undefined} onClick={() => setGroup(g)}>{g}</button>)}</span>}</h3>
      <div className="device-panel-grid">{section.ids(group).map(id => {
        if (section.kind === 'encoders') {
          const e = profile.encoders.find(x => x.id === id), v = values[id]?.value ?? null
          const segments = e ? ledSegments(e.ledMode ?? '1dot_in', v ?? e.minimum, e.minimum, e.maximum, e.type !== 'off', v !== null) : []
          const name = `${t(section.fader ? 'Fader' : 'Encoder')} ${section.fader ? id - (device.faders?.first ?? 33) + 1 : id} ${label('encoders', id)}`
          const caption = <><span className="device-label" data-i18n-skip>{label('encoders', id)}</span>{showNumbers && <span className="device-number" aria-hidden="true">{id}</span>}</>
          if (section.fader) return <div key={id} data-encoder={id} data-control-kind="encoders" data-control-id={id} className={`device-control encoder fader-control ${e?.type === 'off' ? 'off' : 'on'}`} role="group" aria-label={name} data-selected={selected('encoders', id)}>
            <input className="device-fader-input" type="range" aria-label={name} min={e?.minimum ?? 0} max={e?.maximum ?? 127} step="1" value={Math.max(e?.minimum ?? 0, Math.min(e?.maximum ?? 127, v ?? e?.minimum ?? 0))} disabled={!e || e.type === 'off' || !setValue || mouseMulti}
              onPointerDown={event => select({ kind: 'encoders', id }, gesture(event))}
              onFocus={() => { if (!mouseMulti && !selected('encoders', id)) select({ kind: 'encoders', id }) }}
              onChange={event => setValue?.(id, Number(event.currentTarget.value))} />
            <button className="device-fader-select" aria-pressed={selected('encoders', id)} aria-label={name} onClick={event => select({ kind: 'encoders', id }, gesture(event))}>{caption}</button>
          </div>
          const push = section.push && profile.pushes.find(x => x.id === id)
          const pushValue = auxValues.pushes[controlIndex('pushes', id, device)]
          return <div key={id} className="device-encoder-cell">
            <button data-encoder={id} data-control-kind="encoders" data-control-id={id} {...(move && !mouseMulti ? dragMoveProps('encoders', id, move) : {})} className={`device-control encoder ${e?.type === 'off' ? 'off' : 'on'}`} aria-pressed={selected('encoders', id)}
              aria-label={name} onClick={event => select({ kind: 'encoders', id }, gesture(event))}
              onKeyDown={event => {
                if (mouseMulti || !e || e.type === 'off' || !setValue || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const step = event.shiftKey ? 4 : 1
                const value = event.key === 'Home' ? e.minimum : event.key === 'End' ? e.maximum : (v ?? e.minimum) + (['ArrowUp', 'ArrowRight'].includes(event.key) ? step : -step)
                setValue(id, Math.max(e.minimum, Math.min(e.maximum, value)))
              }}>
              {ring(segments)}{caption}
            </button>
            {push && <button data-control-kind="pushes" data-control-id={id} className={`device-push ${push.type === 'off' ? 'off' : 'on'}`} aria-label={`${t('Push')} ${id} ${label('pushes', id)}`} aria-pressed={selected('pushes', id)} data-active={push.type !== 'off' && pushValue != null && pushValue > push.minimum}
              onClick={event => select({ kind: 'pushes', id }, gesture(event))}><span data-i18n-skip>{label('pushes', id)}</span></button>}
          </div>
        }
        const b = profile.buttons.find(x => x.id === id), value = auxValues.buttons[controlIndex('buttons', id, device)]
        const lit = !!b && b.type !== 'off' && value !== null && value !== undefined && value > b.minimum
        return <button key={id} data-control-kind="buttons" data-control-id={id} {...(move && !mouseMulti ? dragMoveProps('buttons', id, move) : {})} className={`device-control key ${b?.type === 'off' ? 'off' : 'on'}`} aria-pressed={selected('buttons', id)}
          aria-label={`${t('Button')} ${id} ${label('buttons', id)}`} onClick={event => select({ kind: 'buttons', id }, gesture(event))}>
          <span className={lit ? 'key-led lit' : 'key-led'} aria-hidden="true" /><span className="device-label" data-i18n-skip>{label('buttons', id)}</span>{showNumbers && <span className="device-number" aria-hidden="true">{id}</span>}
        </button>
      })}</div>
    </section>)}
  </div>
}
