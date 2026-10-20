import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Bcr32Profile } from './profile'
import { cleanLabel, controlIndex as modelControlIndex, emptyLabels, type VisualLabels } from './presets'
import {controlLabelFor} from './control-labels'
import { buttonPosition, encoderNames, encoderPosition, extraButtonPosition } from './panel-layout'
import { ActivityLeds, idleActivity, type Activity } from './ActivityLeds'
import { NameDisplay, OledDisplay } from './OledDisplay'
import { receiveControlCC, type LiveValue } from './controller-midi'
import { ledSegments, type LedMode } from './led-modes'
import { controlsInRectangle, type SelectionGesture, type SelectionRectangle } from './multi-selection'
import { translate, useLanguage } from './i18n'
import { bcr32KeyLabels, bcr32RightKeys } from './device-bcr32'
import { dragMoveProps, type MoveKind, type MoveMode } from './control-move'
import { currentDevice } from './devices'
import type { DeviceDefinition } from './device-definition'

export type Selection = { kind: 'encoders' | 'pushes' | 'buttons'; id: number }
export type LiveValues = Record<number, LiveValue>
export function ledIndex(value: number, minimum = 0, maximum = 127) { return maximum === minimum ? 0 : Math.round(Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) * 20) }
export function receiveCC(profile: Bcr32Profile, current: LiveValues, data: number[]): LiveValues {
  if (data.length !== 3 || !data.every(n => Number.isInteger(n) && n >= 0 && n <= 255) || (data[0] & 0xf0) !== 0xb0 || data[1] > 127 || data[2] > 127) return current
  const next = { ...current }
  for (const e of profile.encoders) { const value = receiveControlCC(e, current[e.id], data); if (value) next[e.id] = value }
  return next
}
const labels = bcr32KeyLabels, globals = bcr32RightKeys
// Name printed on the panel for a control (a push takes its encoder's name), from the current model's definition.
export const printedName = (kind: Selection['kind'], id: number, device: DeviceDefinition = currentDevice): string => device.printedName(kind, id)
// Label of a control as shown on the panel: the user's label, else the printed name.
export const controlLabel = (kind: Selection['kind'], id: number, custom: VisualLabels, device: DeviceDefinition = currentDevice) => controlLabelFor(device, kind, id, custom)
// Percentages of the panel coordinate space (1717 × 1440).
const region = (x: number, y: number, width: number, height: number): CSSProperties => ({
  left: `${x / 1717 * 100}%`, top: `${y / 1440 * 100}%`,
  width: `${width / 1717 * 100}%`, height: `${height / 1440 * 100}%`,
})

function InlineName({ initial, style, name, commit, cancel }: { initial: string; style: CSSProperties; name: string; commit: (name: string) => void; cancel: () => void }) {
  const language = useLanguage()
  const [draft, setDraft] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const finish = () => { if (!finished.current) { finished.current = true; commit(cleanLabel(draft)) } }
  return <input ref={input} className="inline-name-editor" style={style} aria-label={translate(`Rename ${name}`, language)} maxLength={48} value={draft}
    placeholder={translate('Empty = original name', language)} title={translate('Enter or click elsewhere: confirm. Esc: cancel.', language)}
    onChange={event => setDraft(event.target.value)} onBlur={finish}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); finish() } else if (event.key === 'Escape') { event.preventDefault(); finished.current = true; cancel() } }} />
}

export function FrontPanel({ device = currentDevice, profile, selection, selections = [selection], mouseMulti = false, selectMany = () => {}, select, action, values = {}, setValue = () => {}, ringMode = 'bar', compact = false, customLabels = emptyLabels(device), rename = () => {}, activity = idleActivity, screenControl = selection, screenValue, setScreenValue, autoZoom = false, showNumbers = true, nameScreen = false, displayStyle = 'ice', move }: {
  device?: DeviceDefinition
  profile: Bcr32Profile; selection: Selection; selections?: Selection[]; select: (value: Selection, gesture?: SelectionGesture) => void; action: (name: string) => void
  values?: LiveValues; setValue?: (id: number, value: number) => void; ringMode?: LedMode
  compact?: boolean
  mouseMulti?: boolean
  selectMany?: (controls:Selection[])=>void
  autoZoom?: boolean
  showNumbers?: boolean
  nameScreen?: boolean
  displayStyle?: string
  customLabels?: VisualLabels
  rename?: (control: Selection, name: string) => void
  activity?: Activity
  screenControl?: Selection
  screenValue?: { value: number | null; source: 'local' | 'midi' | 'relative' }
  setScreenValue?: (value: number) => void
  move?: (kind: MoveKind, from: number, to: number, mode: MoveMode) => void // drag and drop of encoders (by their label) and keys
}) {
  const controlIndex = (kind: Selection['kind'], id: number) => modelControlIndex(kind, id, device)
  const { encoderPosition, buttonPosition, extraButtonPosition, encoderNames } = device.panel
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [editing, setEditing] = useState<Selection | null>(null)
  const [selectedGlobal,setSelectedGlobal]=useState<number|null>(null)
  useEffect(()=>setSelectedGlobal(null),[selection.kind,selection.id,selections])
  const [zoomed, setZoomed] = useState(false)
  const [rectangle,setRectangle]=useState<SelectionRectangle|null>(null)
  const marquee=useRef<{pointerId:number;rect:SelectionRectangle;clientX:number;clientY:number;moved:boolean}|null>(null)
  const zoomValue = screenValue ? screenValue.value : screenControl.kind === 'encoders' ? values[screenControl.id]?.value ?? null : null
  const previousZoom = useRef(`${screenControl.kind}:${screenControl.id}:${zoomValue}`)
  useEffect(() => {
    const signature = `${screenControl.kind}:${screenControl.id}:${zoomValue}`
    const changed = signature !== previousZoom.current
    previousZoom.current = signature
    if (!autoZoom || mouseMulti || zoomValue === null) { setZoomed(false); return }
    if (!changed) return
    setZoomed(true)
    const timer = window.setTimeout(() => setZoomed(false), 1400)
    return () => window.clearTimeout(timer)
  }, [autoZoom, mouseMulti, screenControl.kind, screenControl.id, zoomValue])
  useEffect(()=>{if(!mouseMulti){marquee.current=null;setRectangle(null)}},[mouseMulti])
  const drag = useRef<{ id: number; y: number; value: number } | null>(null)
  useEffect(()=>{if(mouseMulti)drag.current=null},[mouseMulti])
  const displayed = profile[screenControl.kind].find(e => e.id === screenControl.id)!
  const displayValue = screenValue ?? { value: screenControl.kind === 'encoders' ? values[screenControl.id]?.value ?? null : null, source: screenControl.kind === 'encoders' ? values[screenControl.id]?.source ?? 'local' : 'local' }
  const isSelected = (kind: Selection['kind'], id: number) => selections.some(s=>s.kind===kind&&s.id===id)
  const gesture = (event: {metaKey:boolean;ctrlKey:boolean;shiftKey:boolean}) => ({toggle:mouseMulti||event.metaKey||event.ctrlKey,range:event.shiftKey})
  const startRename = (control: Selection) => { drag.current = null; select(control); setEditing(control) }
  const renameKey = (event: KeyboardEvent, control: Selection) => { if (event.key === 'F2') { event.preventDefault(); startRename(control) } }
  const button = (id: number, label: string, x: number, y: number, width = 140) => <button key={id} {...(move ? dragMoveProps('buttons', id, move) : {})}
    style={region(x, y, width, 55)} className={`panel-hit key-hit ${id>=65?'right-key':''} ${(profile.buttons.find(b => b.id === id)?.type ?? 'off') === 'off' ? 'control-off' : 'control-on'} ${isSelected('buttons', id) ? 'active' : ''}`}
    aria-label={t(`Button ${id} ${customLabels.buttons[controlIndex('buttons', id)] || label}`)} title={`${customLabels.buttons[controlIndex('buttons', id)] || label} · ${profile.buttons.find(b => b.id === id)?.type === 'off' ? 'OFF' : t('assigned')} · ${t('local profile')}`}
    aria-pressed={isSelected('buttons', id)} onClick={event => select({ kind: 'buttons', id },gesture(event))}
    onDoubleClick={() => startRename({ kind: 'buttons', id })} onKeyDown={event => renameKey(event, { kind: 'buttons', id })}>
      {customLabels.buttons[controlIndex('buttons', id)] && <span className="custom-key-label">{customLabels.buttons[controlIndex('buttons', id)]}</span>}
      {!customLabels.buttons[controlIndex('buttons', id)] && <span className="silver-key-label">{label}</span>}
      {showNumbers && id < 21 && <span className="key-number" aria-hidden="true">{id - 4}</span>}
    </button>

  return <div className="panel-scroll"><div className="panel-viewport"><div className={`front-panel${zoomed ? ' auto-zoom-active' : ''}${mouseMulti?' mouse-multi':''}`} data-display={displayStyle} tabIndex={-1} aria-label={t('Interactive BCR32 front panel')}
    onDragStart={event=>{if(!(event.target instanceof HTMLInputElement))event.preventDefault()}}
    onPointerDown={event=>{
      if(!mouseMulti||event.button!==0||(event.target as Element).closest('button,input'))return
      event.preventDefault();event.currentTarget.focus({preventScroll:true});const bounds=event.currentTarget.getBoundingClientRect()
      const x=(event.clientX-bounds.left)/bounds.width*1717,y=(event.clientY-bounds.top)/bounds.height*1440
      marquee.current={pointerId:event.pointerId,rect:{x1:x,y1:y,x2:x,y2:y},clientX:event.clientX,clientY:event.clientY,moved:false}
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event=>{
      const state=marquee.current;if(!state||state.pointerId!==event.pointerId)return
      const bounds=event.currentTarget.getBoundingClientRect()
      state.rect.x2=(event.clientX-bounds.left)/bounds.width*1717;state.rect.y2=(event.clientY-bounds.top)/bounds.height*1440
      state.moved ||= Math.hypot(event.clientX-state.clientX,event.clientY-state.clientY)>=5
      if(state.moved)setRectangle({...state.rect})
    }}
    onPointerUp={event=>{
      const state=marquee.current;if(!state||state.pointerId!==event.pointerId)return
      if(state.moved){const controls=controlsInRectangle(profile,selection.kind,state.rect,device);if(controls.length)selectMany(controls)}
      marquee.current=null;setRectangle(null);event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerCancel={()=>{marquee.current=null;setRectangle(null)}} onLostPointerCapture={()=>{marquee.current=null;setRectangle(null)}}>
    <div className="chassis-frame" aria-hidden="true" />
    <div className="panel-plate" aria-hidden="true" />
    {rectangle&&<div className="selection-rectangle" aria-hidden="true" style={region(Math.min(rectangle.x1,rectangle.x2),Math.min(rectangle.y1,rectangle.y2),Math.abs(rectangle.x2-rectangle.x1),Math.abs(rectangle.y2-rectangle.y1))} />}
    <ActivityLeds activity={activity} />
    {compact && <div className="editor-brand" style={region(700, 38, 305, 72)}><img src="branding/midi-studio-logo.svg" alt="MIDI Studio" draggable={false} /></div>}
    {labels.map((label, i) => button(i + 5, label, 37 + (i % 8) * 161.4, i < 8 ? 247 : 369))}
    {['T1', 'T2', 'T3', 'T4'].map((label, i) => button(i + 21, label, i % 2 ? 1583 : 1422, i < 2 ? 247 : 369, 96))}
    {profile.encoders.map(e => {
      const { x, y } = encoderPosition(e.id)
      const live = values[e.id]
      const value = live?.value ?? 0
      const known = live?.value !== undefined && live.value !== null
      const enabled = e.type !== 'off' && !e.parameterOff
      const segments = ledSegments(e.ledMode ?? ringMode, value, e.minimum, e.maximum, enabled, known)
      return <div key={e.id} className={zoomed && screenControl.kind !== 'buttons' && screenControl.id === e.id ? 'zoomed-encoder' : undefined} style={{ transformOrigin: `${x / 1717 * 100}% ${y / 1440 * 100}%` }}>
        {showNumbers && <span className="encoder-number" style={region(x - 22, y - 107, 44, 28)} aria-hidden="true">{e.id}</span>}
        <button className="panel-hit name-hit" {...(move ? dragMoveProps('encoders', e.id, move) : {})} style={region(x - 78, y + 74, 156, 27)} aria-label={`${t('Encoder label')} ${e.id} ${customLabels.encoders[e.id - 1] || encoderNames[e.id - 1]}`}
          title={t('Click: select. Double-click or F2: rename.')}
          onClick={event => select({ kind: 'encoders', id: e.id },gesture(event))} onDoubleClick={() => startRename({ kind: 'encoders', id: e.id })}
          onKeyDown={event => renameKey(event, { kind: 'encoders', id: e.id })}><span className="silver-dial-label">{customLabels.encoders[e.id - 1] || encoderNames[e.id - 1]}</span></button>
        {customLabels.pushes[e.id - 1] && <button className="panel-hit name-hit custom-push-label" style={region(x - 78, y + 103, 156, 22)}
          aria-label={`${t('Push label')} ${e.id} ${customLabels.pushes[e.id - 1]}`} title={t('Double-click or F2: rename the push')}
          onClick={event => select({ kind: 'pushes', id: e.id },gesture(event))} onDoubleClick={() => startRename({ kind: 'pushes', id: e.id })}
          onKeyDown={event => renameKey(event, { kind: 'pushes', id: e.id })}>P: {customLabels.pushes[e.id - 1]}</button>}
        <span className="knob-cap" style={region(x - 49, y - 49, 98, 98)} aria-hidden="true" />
        <svg className="led-ring" style={region(x - 74, y - 74, 148, 148)} viewBox="0 0 148 148" aria-hidden="true">
          <circle cx="74" cy="74" r="61" stroke="#292a2c" strokeWidth="26" fill="none" />
          {Array.from({ length: 21 }, (_, i) => {
            const angle = (-135 + i * 13.5) * Math.PI / 180
            const lit = segments[i]
            return <line key={i} className={lit ? 'led-segment on' : 'led-segment'}
              x1={74 + Math.sin(angle) * 57} y1={74 - Math.cos(angle) * 57}
              x2={74 + Math.sin(angle) * 68} y2={74 - Math.cos(angle) * 68} />
          })}
          <text x="74" y="115" textAnchor="middle" className="dial-value">{known ? value : '—'}</text>
        </svg>
        <button style={region(x - 72, y - 72, 144, 144)} className={`panel-hit rotation-hit ${isSelected('encoders', e.id) ? 'active' : ''}`}
          aria-label={`${t('Encoder')} ${e.id} ${t('rotation')}`} aria-pressed={isSelected('encoders', e.id)}
          title={`${t('Encoder')} ${e.id} · ${customLabels.encoders[e.id - 1] || t('rotation')} · ${e.type.toUpperCase()} ${e.parameter}`}
          onClick={event => select({ kind: 'encoders', id: e.id },gesture(event))}
          onDoubleClick={() => startRename({ kind: 'encoders', id: e.id })}
          onPointerDown={event => { if (mouseMulti || event.button !== 0 || event.detail > 1 || event.metaKey || event.ctrlKey || event.shiftKey) return; if(!isSelected('encoders',e.id))select({ kind: 'encoders', id: e.id }); drag.current = { id: e.id, y: event.clientY, value }; event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={event => { if (drag.current?.id === e.id && Math.abs(drag.current.y - event.clientY) >= 4) setValue(e.id, drag.current.value + Math.round((drag.current.y - event.clientY) / 2)) }}
          onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
          onKeyDown={event => { renameKey(event, { kind: 'encoders', id: e.id }); const delta = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : 0; if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setValue(e.id, event.key === 'Home' ? e.minimum : event.key === 'End' ? e.maximum : value + delta) } }} />
        <button style={region(x - 34, y - 34, 68, 68)} className={`panel-hit push-hit ${profile.pushes.find(p => p.id === e.id)?.type !== 'off' ? 'push-enabled' : ''} ${isSelected('pushes', e.id) ? 'active' : ''}`}
          aria-label={`${t('Encoder')} ${e.id} ${t('push')}`} aria-pressed={isSelected('pushes', e.id)}
          title={`${t('Encoder')} ${e.id} · ${customLabels.pushes[e.id - 1] || t('push')}${e.id > 8 ? ` · ${t('hardware presence unconfirmed')}` : ''}`}
          onClick={event => select({ kind: 'pushes', id: e.id },gesture(event))} onDoubleClick={() => startRename({ kind: 'pushes', id: e.id })}
          onKeyDown={event => renameKey(event, { kind: 'pushes', id: e.id })} />
      </div>
    })}
    <button style={region(1168, 124, 140, 55)} className="panel-hit key-hit zaq-toggle" aria-label="ZQR / CTRL"
      onClick={() => action('Editor Controller mode only. No hardware change.')}><span className="silver-key-label">ZQR / CTRL</span></button>
    {nameScreen && <NameDisplay text={controlLabel(screenControl.kind, screenControl.id, customLabels, device)} blank={displayed.display === false} style={region(1374, 463, 192, 49)} />}
    <OledDisplay control={screenControl} config={displayed} value={displayValue.value} source={displayValue.source} style={region(1374, 518, 192, 98)}
      inspect={() => select(screenControl)} setValue={v => { if (setScreenValue) setScreenValue(v); else if (screenControl.kind === 'encoders') setValue(screenControl.id, v) }} />
    <button style={region(1583, 518, 96, 96)} className="panel-hit rotation-hit select-knob" aria-label={t('SELECT rotation and push')}
      onClick={() => action('SELECT shown: no hardware command enabled.')} />
    <span className="panel-legend" style={region(1570, 626, 124, 28)} aria-hidden="true">SELECT</span>
    <span className="panel-legend" style={region(1606, 478, 50, 32)} aria-hidden="true">⊙</span>
    <span className="panel-legend drum-notes-legend" style={region(1496, 323, 110, 24)} aria-hidden="true">DRUM NOTES</span>
    <span className="panel-legend" style={region(1422, 734, 96, 28)} aria-hidden="true">GLOBAL</span>
    <span className="panel-legend" style={region(1400, 887, 292, 28)} aria-hidden="true">◀ PAGES / PRESETS ▶</span>
    <span className="panel-legend" style={region(1578, 1002, 110, 25)} aria-hidden="true">NOTE RPT</span>
    <svg className="panel-silkscreen" viewBox="0 0 1717 1440" aria-hidden="true">
      <path d="M1590 638H1575Q1550 638 1550 663V697M1527 697H1574M1631 1027V1073" />
      {[938,1085].map(y=><path key={y} d={`M1410 ${y}V${y+55}M1529 ${y}V${y+55}`} />)}
      <path d="M1571 938V993M1690 938V993" />
    </svg>
    {globals.map((label, i) => i >= 6 ? (pos => button(pos.id, label, pos.x, pos.y, pos.width))({ id: 65 + i - 6, ...extraButtonPosition(65 + i - 6) }) : <button key={label} style={region(i % 2 ? 1583 : 1422, [670, 792, 938, 1085, 1207][Math.floor(i / 2)], 96, 55)}
      className={`panel-hit key-hit right-key control-off ${selectedGlobal===i?'active':''}`} aria-label={label} aria-pressed={selectedGlobal===i} title={`${label} · ${t('hardware command not enabled')}`}
      onClick={() => {setSelectedGlobal(i);action(`${label} shown: no hardware command sent.`)}}><span className="silver-key-label">{label}</span></button>)}
    {editing && (() => {
      const index = controlIndex(editing.kind, editing.id)
      const { x, y } = encoderPosition(editing.id)
      const key = buttonPosition(index)
      const extra = editing.kind === 'buttons' && editing.id >= 65
      const style = editing.kind === 'buttons' ? extra ? (pos => region(pos.x, pos.y + 6, pos.width, 43))(extraButtonPosition(editing.id)) : region(key.x, key.y + 6, key.width, 43) : region(x - 78, y + (editing.kind === 'pushes' ? 103 : 74), 156, 32)
      const fallback = editing.kind === 'encoders' ? encoderNames[index] : editing.kind === 'buttons' ? extra ? globals[editing.id - 65 + 6] : (index < 16 ? labels[index] : `T${index - 15}`) : ''
      return <InlineName key={`${editing.kind}-${editing.id}`} initial={customLabels[editing.kind][index] || fallback} style={style}
        name={`${t(editing.kind === 'buttons' ? 'Button' : editing.kind === 'pushes' ? 'Push' : 'Encoder')} ${editing.id}`}
        commit={name => { rename(editing, name); setEditing(null) }} cancel={() => setEditing(null)} />
    })()}
  </div></div></div>
}
