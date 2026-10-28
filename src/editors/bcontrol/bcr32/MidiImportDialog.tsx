import { useEffect, useMemo, useRef, useState } from 'react'
import { trackToSteps, type MidiFile, type MidiTrack } from './midi-file'
import { translate, useLanguage } from './i18n'
import { noteName, stepGrids, trackColors } from './SequencerView'

// MIDI import preview: the whole file as a timeline (one row per source track, bars and time), four windows of 32 steps
// (one per T1–T4, each from any track and any bar), and what each window will put on its track. Nothing is applied before
// "Import selected tracks". The parent controls whether edits remain local or use the verified live buffer path.
export type ImportSlot = { source: number | null; startTick: number; enabled?: boolean }
const barPx = 30, rowPx = 30
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export const firstNoteBar = (track: MidiTrack | undefined, barTicks: number) => track?.notes.length ? Math.floor(Math.min(...track.notes.map(n => n.tick)) / barTicks) : 0

export function MidiImportDialog({ name, file, initialGrid, targetTrack=0, onApply, onCancel }: {
  name: string; file: MidiFile; initialGrid: number; targetTrack?: number
  onApply: (slots: ImportSlot[], stepTicks: number) => void; onCancel: () => void
}) {
  const language = useLanguage(), t = (s: string) => translate(s, language)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal() }, [])
  const tracks = useMemo(() => file.tracks.filter(tr => tr.notes.length), [file])
  const [grid, setGrid] = useState(initialGrid), stepTicks = file.ppq / grid, barTicks = file.ppq * 4, windowTicks = 32 * stepTicks
  const [active, setActive] = useState(targetTrack)
  const [slots, setSlots] = useState<ImportSlot[]>(() => [0, 1, 2, 3].map(i => { const tr = tracks[i]??(i===targetTrack?tracks[0]:undefined); return { source: tr?.index ?? null, startTick: firstNoteBar(tr, barTicks) * barTicks, enabled:i===targetTrack&&!!tr } }))
  const selected=slots.filter(s=>s.enabled!==false&&s.source!==null).length
  const end = Math.max(barTicks, ...tracks.flatMap(tr => tr.notes.map(n => n.tick + n.duration))), bars = Math.ceil(end / barTicks)
  const bpm = file.tempoBpm ?? 120, seconds = (tick: number) => tick / file.ppq * 60 / bpm
  const set = (i: number, patch: Partial<ImportSlot>) => { setSlots(list => list.map((s, j) => j === i ? { ...s, ...patch } : s)); setActive(i); setFocus({ slot: i, seq: Date.now() }) }
  // Selecting or moving a slot brings its window into view in the timeline (both scroll directions).
  const timeline = useRef<HTMLDivElement>(null), [focus, setFocus] = useState<{ slot: number; seq: number } | null>(null)
  useEffect(() => {
    if (!focus || !timeline.current) return
    const s = slots[focus.slot], row = tracks.findIndex(tr => tr.index === s.source); if (row < 0) return
    timeline.current.scrollTo({ left: Math.max(0, s.startTick / barTicks * barPx - 120), top: Math.max(0, row * rowPx - 2 * rowPx), behavior: 'smooth' })
  }, [focus])
  const sourceOf = (s: ImportSlot) => tracks.find(tr => tr.index === s.source)
  const previews = slots.map(s => { const tr = sourceOf(s); return tr&&s.enabled!==false ? trackToSteps(tr.notes, { stepTicks, startTick: s.startTick, steps: 32 }) : null })
  const pickOnTimeline = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect(), row = Math.floor((event.clientY - box.top) / rowPx), bar = Math.floor((event.clientX - box.left) / barPx)
    const tr = tracks[row]; if (!tr || bar < 0 || bar >= bars) return
    set(active, { enabled:true, source: tr.index, startTick: bar * barTicks })
  }
  return <dialog ref={dialog} className="midi-import-dialog" aria-labelledby="midi-import-title" onClose={onCancel} onCancel={onCancel}>
    <header><div><h2 id="midi-import-title">{t('Import a MIDI file')}</h2><p className="mock-caption"><span data-i18n-skip>{name}</span> · {tracks.length} {t('MIDI tracks')} · <span data-i18n-skip>{clock(seconds(end))} · {Math.round(bpm)} BPM · {bars}</span> {t('bars')}</p></div>
      <button className="midi-settings-close" aria-label={t('Close')} title={t('Close')} onClick={onCancel}>✕</button></header>
    <div className="mid-slots">{slots.map((s, i) => { const p = previews[i], from = s.startTick / barTicks + 1, to = (s.startTick + windowTicks) / barTicks; return <section key={i} className="mid-slot" data-active={active === i || undefined} style={{ ['--c' as string]: trackColors[i] }} onClick={() => { setActive(i); setFocus({ slot: i, seq: Date.now() }) }}>
      <label className="mock-check"><input type="checkbox" aria-label={`${t('Import into')} T${i+1}`} checked={s.enabled!==false&&s.source!==null} disabled={s.source===null} onChange={e=>set(i,{enabled:e.target.checked})}/><b>T{i + 1}</b></label>
      <label>{t('Source track')}<select value={s.source ?? ''} onChange={e => { const v = e.target.value === '' ? null : Number(e.target.value); set(i, { enabled:v!==null, source: v, startTick: firstNoteBar(tracks.find(tr => tr.index === v), barTicks) * barTicks }) }}><option value="">{t('Leave unchanged')}</option>{tracks.map(tr => <option key={tr.index} value={tr.index} data-i18n-skip>{tr.index + 1} · {tr.name || '—'} · {tr.notes.length}</option>)}</select></label>
      <label>{t('Start bar')}<span className="mid-start"><button aria-label={t('Previous bar')} onClick={() => set(i, { startTick: Math.max(0, s.startTick - barTicks) })}>◀</button><input type="number" min="1" max={bars} value={Math.round(from * 100) / 100} onChange={e => set(i, { startTick: Math.max(0, (Math.round(Number(e.target.value) || 1) - 1) * barTicks) })} /><button aria-label={t('Next bar')} onClick={() => set(i, { startTick: Math.min((bars - 1) * barTicks, s.startTick + barTicks) })}>▶</button><button onClick={() => set(i, { startTick: firstNoteBar(sourceOf(s), barTicks) * barTicks })}>{t('First note')}</button></span></label>
      <p className="mock-caption" data-i18n-skip>{s.source === null ? '—' : `${t('bars')} ${Math.round(from * 100) / 100}–${Math.round(to * 100) / 100} · ${clock(seconds(s.startTick))}–${clock(seconds(s.startTick + windowTicks))} · ${p?.steps.filter(Boolean).length ?? 0} ${t('notes')}${p?.chordsDropped ? ` · ${p.chordsDropped} ${t('chord notes dropped')}` : ''}`}</p>
      <div className="mid-preview" aria-label={`T${i + 1} · ${t('preview')}`}>{Array.from({ length: 32 }, (_, k) => { const st = p?.steps[k]; return <span key={k} className={`${st ? 'on' : ''}${k % 4 ? '' : ' beat'}`} title={st ? `${k + 1} · ${noteName(st.note)} · ${st.velocity}` : String(k + 1)} data-i18n-skip>{st ? noteName(st.note) : ''}</span> })}</div>
    </section> })}</div>
    <div className="mid-toolbar"><label>{t('Step size')}<select value={grid} onChange={e => setGrid(Number(e.target.value))}>{stepGrids.map(g => <option key={g.divisor} value={g.divisor} data-i18n-skip>{g.label}</option>)}</select></label>
      <span className="mock-caption">{t('Click a track on the timeline to place the selected slot there.')} <b data-i18n-skip>T{active + 1}</b></span></div>
    <div className="mid-timeline" ref={timeline}>
      <span className="mid-corner" />
      <svg className="mid-ruler" width={bars * barPx} height={22} aria-hidden="true">{Array.from({ length: bars }, (_, b) => <g key={b}>{b % 4 === 0 && <text x={b * barPx + 3} y={10}>{b + 1}</text>}{b % 8 === 0 && <text x={b * barPx + 3} y={20} className="mid-time">{clock(seconds(b * barTicks))}</text>}</g>)}</svg>
      <div className="mid-names">{tracks.map(tr => <span key={tr.index} style={{ height: rowPx }} data-i18n-skip>{tr.index + 1} · {tr.name || '—'}</span>)}</div>
      <svg className="mid-rows" width={bars * barPx} height={tracks.length * rowPx} onClick={pickOnTimeline} role="img" aria-label={t('MIDI file timeline')}>
        {Array.from({ length: bars }, (_, b) => <line key={b} x1={b * barPx} x2={b * barPx} y1={0} y2={tracks.length * rowPx} className={b % 4 ? 'mid-bar' : 'mid-bar strong'} />)}
        {tracks.map((tr, r) => { const lo = Math.min(...tr.notes.map(n => n.note)), hi = Math.max(lo + 1, ...tr.notes.map(n => n.note)); return <g key={tr.index}>{tr.notes.map((n, k) => <rect key={k} className="mid-note" x={n.tick / barTicks * barPx} width={Math.max(1.5, n.duration / barTicks * barPx)} y={r * rowPx + 3 + (hi - n.note) / (hi - lo) * (rowPx - 8)} height={2.5} />)}</g> })}
        {slots.map((s, i) => { const r = tracks.findIndex(tr => tr.index === s.source); return r < 0||s.enabled===false ? null : <g key={i}><rect className="mid-window" x={s.startTick / barTicks * barPx} width={windowTicks / barTicks * barPx} y={r * rowPx + 1} height={rowPx - 2} style={{ stroke: trackColors[i], fill: trackColors[i] }} /><text x={s.startTick / barTicks * barPx + 3} y={r * rowPx + 12} className="mid-window-label">T{i + 1}</text></g> })}
      </svg>
    </div>
    <footer><button onClick={onCancel}>{t('Cancel')}</button><button onClick={()=>setSlots(list=>list.map(s=>({...s,enabled:s.source!==null})))}>{t('Select all')}</button><button onClick={()=>setSlots(list=>list.map(s=>({...s,enabled:false})))}>{t('Select none')}</button><button className="primary" disabled={!selected} onClick={() => onApply(slots.map(s=>s.enabled===false?{...s,source:null}:s), stepTicks)}>{t('Import selected tracks')} · {selected}</button></footer>
  </dialog>
}
