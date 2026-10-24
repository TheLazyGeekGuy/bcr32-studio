import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { createZaqAssembler, decodeZaqBlock, patchStep, patternFile, readStep, type ZaqPattern, type ZaqStep } from './zaquencer'
import { splitSysex } from './firmware-codec'
import { parseMidiFile, stepsToMidiFile, suggestStepTicks, trackToSteps, type MidiFile } from './midi-file'
import { MidiImportDialog, type ImportSlot } from './MidiImportDialog'
import { applyTemplate, randomPattern, scales, templates } from './sequencer-templates'
import type { EditorStorage } from '../../../editor-environment'
import { translate, useLanguage } from './i18n'

// Sequencer view (approved mockup of 2026-10-24): the four Zaquencer tracks × 32 steps as a grid, lanes, piano roll or
// raw table, with step entry from the computer keyboard or a MIDI keyboard, and .syx / MIDI file exchange. Everything
// stays in this browser: listening for a front-panel export sends nothing, and there is no path that sends a pattern.
export { trackColors, noteName, keyboardNotes, stepGrids } from './sequencer-shared'
import { trackColors, noteName, keyboardNotes, stepGrids, noteNames, noteLengths, clockDividers, directions } from './sequencer-shared'
type Entry = { pattern: ZaqPattern; data: number[]; label: string }
// A local template: eight empty kind-0 blocks. Its header is all zero (fields not located yet), so it is for files only.
export function emptyPattern(): ZaqPattern {
  const blocks = Array.from({ length: 8 }, (_, block) => ({ device: 0, kind: 0, bank: 0, page: 0, block, data: Array<number>(128).fill(0) }))
  return { identity: 'template', blocks, data: blocks.flatMap(b => b.data) }
}
// Field meanings follow the preset map published by the Zaquencer author (zaqaudio.com, 2026-05-22): bytes 0–3 of a
// track are the skipStep flags (the codec's `mask`), 252–255 the noteMute flags (`rest`), 112–123 plus the velocity high
// bits the 4-bit note length (`gate`), 124–187 the per-step values of the track's CC 1 and CC 2 (`alpha`, `beta`, −1 =
// off) and 188–251 the 16-bit polyphony word (`voices`). Not yet observed on a BCR32 export.
export const plays = (s: ZaqStep) => !s.mask && !s.rest && s.velocity > 0
export const ccValue = (raw: number) => raw > 127 ? raw - 256 : raw
export const ccRaw = (value: number) => value < 0 ? 255 : value
export function trackHeader(data: readonly number[], track: number) {
  const o = track * 256, flags = (p: number, n: number) => Array.from({ length: n }, (_, i) => data[o + p + (i >> 3)] >> (i & 7) & 1)
  return { skipped: flags(0, 32).reduce((a, v) => a + v, 0), mute: data[o + 4] & 1, direction: data[o + 5] & 3, start: data[o + 6] & 31, length: data[o + 7] & 31, offset: data[o + 8] & 31, clockDivider: data[o + 9] & 15, shuffleEven: data[o + 10], shuffleOdd: data[o + 11], drumMutes: flags(12, 16).reduce((a, v) => a + v, 0) }
}
// Step entry: the note goes to the selected step, which plays (not muted, not skipped); the cursor moves to the next step.
export function enterNote(data: readonly number[], track: number, step: number, note: number, velocity: number) {
  if (!Number.isInteger(note) || note < 0 || note > 127) throw Error('Note 0–127')
  return { data: patchStep(data, track, step, { note, velocity: Math.max(1, Math.min(127, Math.round(velocity))), mask: false, rest: false }), next: (step + 1) % 32 }
}
// MIDI file → pattern: up to four source tracks onto T1–T4, notes quantized to the chosen grid. Steps without a note are
// muted; note length, CC values and voices stay as they were (the note length unit is not established).
export function applyMidiTracks(data: readonly number[], sources: ({ notes: Parameters<typeof trackToSteps>[0]; startTick?: number } | null)[], stepTicks: number, startTick = 0) {
  let next = [...data]; const report = { chordsDropped: 0, beyond: 0, delayClamped: 0 }
  sources.slice(0, 4).forEach((source, track) => {
    if (!source) return
    const result = trackToSteps(source.notes, { stepTicks, startTick: source.startTick ?? startTick, steps: 32 })
    report.chordsDropped += result.chordsDropped; report.beyond += result.beyond; report.delayClamped += result.delayClamped
    result.steps.forEach((s, step) => { next = patchStep(next, track, step, s ? { note: s.note, velocity: s.velocity, delay: s.delay, mask: false, rest: false } : { rest: true }) })
  })
  return { data: next, report }
}
export function patternToMidi(data: readonly number[], ppq = 96) {
  const tracks = [0, 1, 2, 3].map(track => ({ name: `T${track + 1}`, channel: track, steps: Array.from({ length: 32 }, (_, step) => { const s = readStep(data, track, step); return plays(s) ? { note: s.note, velocity: s.velocity, lengthSteps: 1 } : null }) }))
  return stepsToMidiFile({ ppq, stepTicks: ppq / 4, tracks })
}

export function SequencerView({ storage, noteInput, noteInputName, openMidiSettings, receive, download, locked }: {
  storage: EditorStorage; noteInput: MutableRefObject<((note: number, velocity: number) => void) | null>; noteInputName: string; openMidiSettings: () => void; receive: MutableRefObject<(bytes: number[]) => void>
  download: (data: BlobPart, name: string, type?: string) => void; locked: boolean
}) {
  const language = useLanguage(), t = (s: string) => translate(s, language)
  const [entries, setEntries] = useState<Entry[]>(() => [{ pattern: emptyPattern(), data: emptyPattern().data, label: 'Empty template' }])
  const [current, setCurrent] = useState(0), [track, setTrack] = useState(0), [step, setStep] = useState(0)
  const [view, setView] = useState<'grid' | 'roll' | 'table'>('grid'), [panel, setPanel] = useState<'step' | 'track' | 'file'>('step')
  const [octave, setOctave] = useState(4), [velocity, setVelocity] = useState(100), [keyboardEntry, setKeyboardEntry] = useState(true)
  const [listen, setListen] = useState(false), [notice, setNotice] = useState('Nothing is sent to the BCR32.')
  const [undo, setUndo] = useState<number[][]>([]), [redo, setRedo] = useState<number[][]>([])
  // Templates: built-in grooves, the user's own (saved in this browser) and a random generator.
  const templateKey = 'bcr32-studio.sequencer-templates.v1'
  const [userTemplates, setUserTemplates] = useState<{ name: string; data: number[] }[]>(() => { try { const v = JSON.parse(storage.getItem(templateKey) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x?.name === 'string' && Array.isArray(x?.data) && x.data.length === 1024) : [] } catch { return [] } })
  const saveUserTemplates = (list: { name: string; data: number[] }[]) => { try { storage.setItem(templateKey, JSON.stringify(list)); setUserTemplates(list) } catch (e) { setNotice(String(e)) } }
  const [templatesOpen, setTemplatesOpen] = useState(false), [templateName, setTemplateName] = useState('')
  const [random, setRandom] = useState({ scale: 'minor', root: 45, octaves: 1, density: .5, allTracks: false })
  const [midi, setMidi] = useState<{ name: string; file: MidiFile; grid: number } | null>(null), dragging = useRef(false)
  const entry = entries[Math.min(current, entries.length - 1)], data = entry.data
  const state = useRef({ data, track, step, octave, velocity, locked }); state.current = { data, track, step, octave, velocity, locked }
  // A drag over a lane is one undo step: only its first change records the previous pattern.
  const commit = (next: number[], message?: string, continuing = false) => {
    if (state.current.locked) return
    if (!continuing) { setUndo(u => [...u.slice(-99), state.current.data]); setRedo([]) }
    setEntries(list => list.map((e, i) => i === Math.min(current, list.length - 1) ? { ...e, data: next } : e)); if (message) setNotice(message)
  }
  const restore = (from: number[][], to: (f: (v: number[][]) => number[][]) => void, setFrom: (f: (v: number[][]) => number[][]) => void) => {
    const last = from.at(-1); if (!last || locked) return
    to(v => [...v, data]); setFrom(v => v.slice(0, -1)); setEntries(list => list.map((e, i) => i === Math.min(current, list.length - 1) ? { ...e, data: last } : e))
  }
  const patch = (p: Partial<ZaqStep>, s = step, tr = track, continuing = false) => commit(patchStep(state.current.data, tr, s, p), undefined, continuing)
  const play = (note: number, vel: number) => { const { data: d, track: tr, step: st } = state.current; try { const r = enterNote(d, tr, st, note, vel); commit(r.data); setStep(r.next) } catch (e) { setNotice(String(e)) } }
  const playRef = useRef(play); playRef.current = play
  const addPattern = (pattern: ZaqPattern, label: string) => { setEntries(list => [...list, { pattern, data: [...pattern.data], label }].slice(-24)); setCurrent(Number.MAX_SAFE_INTEGER); setUndo([]); setRedo([]) }

  // Listening for a front-panel pattern export: receive only, never a request.
  useEffect(() => {
    if (!listen) { receive.current = () => {}; return }
    const assembler = createZaqAssembler()
    receive.current = bytes => { const block = decodeZaqBlock(bytes); if (!block) return; const p = assembler.receive(block); if (p) { addPattern(p, `${t('Front-panel export')} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); setNotice('Pattern received. Nothing was sent to the BCR32.') } }
    return () => { receive.current = () => {} }
  }, [listen])

  // MIDI keyboard notes arrive from the Workbench (port chosen in the MIDI connection window) through noteInput.
  useEffect(() => { noteInput.current = (note, vel) => playRef.current(note, vel); return () => { noteInput.current = null } }, [noteInput])

  const onKey = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input,select,textarea') || event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (keyboardEntry && key in keyboardNotes) { event.preventDefault(); play(Math.min(127, (octave + 1) * 12 + keyboardNotes[key]), velocity); return }
    const moves: Record<string, () => void> = {
      arrowright: () => setStep(s => (s + 1) % 32), arrowleft: () => setStep(s => (s + 31) % 32), arrowup: () => setTrack(v => (v + 3) % 4), arrowdown: () => setTrack(v => (v + 1) % 4),
      z: () => setOctave(o => Math.max(-1, o - 1)), x: () => setOctave(o => Math.min(8, o + 1)), c: () => setVelocity(v => Math.max(1, v - 10)), v: () => setVelocity(v => Math.min(127, v + 10)),
      ' ': () => { patch({ rest: !readStep(data, track, step).rest }); setStep(s => (s + 1) % 32) }, backspace: () => { patch({ rest: true }); setStep(s => (s + 31) % 32) }, delete: () => patch({ rest: true }),
    }
    if (moves[key]) { event.preventDefault(); moves[key]() }
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('File limit')
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (/\.(mid|midi|smf)$/i.test(file.name)) {
        const parsed = parseMidiFile(bytes), suggested = suggestStepTicks(parsed.tracks.flatMap(tr => tr.notes), parsed.ppq)
        setMidi({ name: file.name, file: parsed, grid: stepGrids.find(g => parsed.ppq / g.divisor === suggested)?.divisor ?? 4 }); return
      }
      const assembler = createZaqAssembler(); let count = 0
      for (const frame of splitSysex(bytes)) { const block = decodeZaqBlock(frame); if (!block || block.kind === 3) throw Error('Not a pattern export'); const p = assembler.receive(block); if (p) { addPattern(p, `${file.name}${count ? ` · ${count + 1}` : ''}`); count++ } }
      if (!count) throw Error('No complete pattern in this file'); setNotice(`${count} ${t('pattern(s) imported. Nothing was sent to the BCR32.')}`)
    } catch (e) { setNotice(`${t('Import rejected')}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const applyMidi = (slots: ImportSlot[], stepTicks: number) => {
    if (!midi) return
    const sources = slots.map(slot => { const source = midi.file.tracks.find(tr => tr.index === slot.source); return source ? { notes: source.notes, startTick: slot.startTick } : null })
    const { data: next, report } = applyMidiTracks(data, sources, stepTicks)
    commit(next, `${midi.name}: ${t('chord notes dropped')} ${report.chordsDropped} · ${t('notes after step 32')} ${report.beyond} · ${t('offsets clamped')} ${report.delayClamped}`); setMidi(null)
  }

  const all = useMemo(() => [0, 1, 2, 3].map(tr => Array.from({ length: 32 }, (_, i) => readStep(data, tr, i))), [data]), steps = all[track]
  const s = all[track][step]
  // Lane drag: the pointer's column picks the step, its height the value; one undo step per drag.
  const dragLane = (e: React.PointerEvent<HTMLDivElement>, lane: { key: 'velocity' | 'gate' | 'delay'; min: number; max: number }, moving: boolean) => {
    const r = e.currentTarget.getBoundingClientRect(), i = Math.max(0, Math.min(31, Math.floor((e.clientX - r.left - 6) / ((r.width - 12) / 32)))), f = Math.max(0, Math.min(1, (r.bottom - 6 - e.clientY) / (r.height - 12)))
    const v = lane.min < 0 ? Math.round((f - .5) * 2 * lane.max) : Math.round(lane.min + f * (lane.max - lane.min)), value = Math.max(lane.key === 'velocity' ? 1 : lane.min, Math.min(lane.max, v))
    if (moving && all[track][i][lane.key] === value) return
    setStep(i); patch({ [lane.key]: value } as Partial<ZaqStep>, i, track, moving && dragging.current); dragging.current = true
  }
  const lanes: { key: 'velocity' | 'gate' | 'delay'; label: string; max: number; min: number }[] = [{ key: 'velocity', label: 'Velocity', min: 0, max: 127 }, { key: 'gate', label: 'Note length (0–15)', min: 0, max: 15 }, { key: 'delay', label: 'Start offset', min: -127, max: 127 }]
  const active = steps.filter(plays), low = Math.min(...active.map(x => x.note), 60) - 2, high = Math.max(low + 14, ...active.map(x => x.note + 1))
  return <section className="sequencer-view" tabIndex={0} onKeyDown={onKey} aria-label={t('Sequencer')}>
    <div className="seq-main">
      <div className="seq-bar">
        <label className="seq-pattern">{t('Pattern')}<select value={Math.min(current, entries.length - 1)} onChange={e => { setCurrent(Number(e.target.value)); setUndo([]); setRedo([]) }}>{entries.map((e, i) => <option key={i} value={i}>{t(e.label)}</option>)}</select></label>
        <button aria-label={t('Undo')} title={t('Undo')} disabled={!undo.length || locked} onClick={() => restore(undo, setRedo, setUndo)}>↶</button><button aria-label={t('Redo')} title={t('Redo')} disabled={!redo.length || locked} onClick={() => restore(redo, setUndo, setRedo)}>↷</button>
        <div className="mock-seg" role="group" aria-label={t('Pattern display')}>{(['grid', 'roll', 'table'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{t({ grid: 'Grid', roll: 'Piano roll', table: 'Table (Behringer)' }[v])}</button>)}</div>
        <button aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(v => !v)}>{t('Templates')}<span aria-hidden="true" data-i18n-skip> ▾</span></button>
        <button onClick={() => { addPattern(emptyPattern(), `${t('New pattern')} ${entries.length + 1}`); setNotice('Nothing is sent to the BCR32.') }}>{t('New pattern')}</button>
        <span className="seq-spacer" />
        <span className="seq-offline">{t('Offline · nothing is sent to the BCR32')}</span>
      </div>
      {templatesOpen && <section className="seq-templates mock-card">
        <div><b>{t('Built-in templates')}</b><div className="mock-actions">{templates.map(tp => <button key={tp.id} disabled={locked} onClick={() => { commit(applyTemplate(data, tp.id), t(tp.name)); setTemplatesOpen(false) }}>{t(tp.name)}</button>)}</div></div>
        <div><b>{t('My templates')}</b><div className="mock-actions">{userTemplates.length ? userTemplates.map((tp, i) => <span key={i} className="seq-template-item"><button disabled={locked} onClick={() => { commit([...tp.data], tp.name); setTemplatesOpen(false) }} data-i18n-skip>{tp.name}</button><button aria-label={`${t('Delete')} ${tp.name}`} title={t('Delete')} onClick={() => { if (window.confirm(`${t('Delete')} « ${tp.name} » ?`)) saveUserTemplates(userTemplates.filter((_, j) => j !== i)) }}>✕</button></span>) : <span className="mock-caption">{t('None yet')}</span>}</div>
          <div className="mock-actions"><input aria-label={t('Template name')} placeholder={t('Template name')} maxLength={48} value={templateName} onChange={e => setTemplateName(e.target.value)} /><button disabled={!templateName.trim()} onClick={() => { saveUserTemplates([...userTemplates.filter(x => x.name !== templateName.trim()), { name: templateName.trim(), data: [...data] }].slice(-64)); setTemplateName(''); setNotice('Template saved in this browser.') }}>{t('Save the pattern as a template')}</button></div></div>
        <div><b>{t('Random pattern')}</b><div className="seq-random">
          <label>{t('Scale')}<select value={random.scale} onChange={e => setRandom({ ...random, scale: e.target.value })}>{Object.keys(scales).map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label>
          <label>{t('Root')}<select value={random.root} onChange={e => setRandom({ ...random, root: Number(e.target.value) })}>{Array.from({ length: 49 }, (_, i) => 24 + i).map(n => <option key={n} value={n} data-i18n-skip>{noteName(n)}</option>)}</select></label>
          <label>{t('Octaves')}<select value={random.octaves} onChange={e => setRandom({ ...random, octaves: Number(e.target.value) })}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>{t('Density')} · {Math.round(random.density * 100)} %<input type="range" min="0.1" max="1" step="0.05" value={random.density} onChange={e => setRandom({ ...random, density: Number(e.target.value) })} /></label>
          <label className="mock-check"><input type="checkbox" checked={random.allTracks} onChange={e => setRandom({ ...random, allTracks: e.target.checked })} />{t('All four tracks')}</label>
          <button className="primary" disabled={locked} onClick={() => commit(randomPattern(data, { tracks: random.allTracks ? [0, 1, 2, 3] : [track], scale: random.scale, root: random.root, octaves: random.octaves, density: random.density }), t('Random pattern'))}>{t('Generate')}</button>
        </div></div>
      </section>}
      <p className="mock-warn seq-preview-note">{t('Preview: MIDI and .syx files, keyboard and MIDI keyboard entry work in the editor. Capture from the BCR32 and sending to it are not implemented yet.')}</p>
      <div className="seq-entry">
        <label className="mock-check"><input type="checkbox" checked={keyboardEntry} onChange={e => setKeyboardEntry(e.target.checked)} />{t('Computer keyboard entry')}</label>
        <span className="mock-caption" data-i18n-skip>A W S E D F T G Y H U J K · Z/X {t('octave')} {octave} · C/V {t('velocity')} {velocity} · ←→↑↓ · {t('Space: rest')} · ⌫</span>
        <span className="mock-caption">{t('MIDI keyboard')}: <b data-i18n-skip>{noteInputName || t('None')}</b> · <button className="mock-link" onClick={openMidiSettings}>{t('MIDI connection…')}</button></span>
      </div>
      {view === 'grid' && <div className="seq-gridview">
        <h3>{t('Tracks T1–T4 · 32 steps')} <span className="mock-caption">{t('click: select · Shift+click: mute · Alt+click: skip')}</span></h3>
        <div className="seq-grid" role="grid" aria-label={t('Pattern grid')}>
          <span />{Array.from({ length: 32 }, (_, i) => <span key={i} className={i % 4 ? 'seq-num' : 'seq-num beat'} data-i18n-skip>{i + 1}</span>)}
          {[0, 1, 2, 3].map(tr => <div key={tr} className="seq-row" role="row" style={{ display: 'contents' }}>
            <button className="seq-track" aria-pressed={tr === track} onClick={() => setTrack(tr)}><i style={{ background: trackColors[tr] }} />T{tr + 1}</button>
            {Array.from({ length: 32 }, (_, i) => { const x = all[tr][i]; return <button key={i} role="gridcell" className={`seq-cell${plays(x) ? ' on' : ''}${x.mask ? ' skip' : x.rest ? ' rest' : ''}${tr === track && i === step ? ' sel' : ''}`} style={{ ['--c' as string]: trackColors[tr] }} aria-label={`T${tr + 1} · ${t('Step')} ${i + 1} · ${plays(x) ? noteName(x.note) : t(x.mask ? 'Skipped' : 'Muted')}`} title={`T${tr + 1} · ${i + 1} · ${noteName(x.note)} · ${x.velocity}`}
              onClick={e => { setTrack(tr); setStep(i); if (e.shiftKey) patch({ rest: !x.rest }, i, tr); else if (e.altKey) patch({ mask: !x.mask }, i, tr) }}>{plays(x) && <><span className="seq-vel" style={{ height: `${100 - x.velocity / 127 * 100}%` }} /><span className="seq-note" data-i18n-skip>{noteName(x.note)}</span></>}</button> })}
          </div>)}
        </div>
        <h3>{t('Track')} {track + 1} · {t('lanes')}</h3>
        <div className="seq-lanes">{lanes.map(lane => <div key={lane.key} className="seq-lane"><span className="seq-lane-label">{t(lane.label)}</span><div className={`seq-bars ${lane.key}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = false; dragLane(e, lane, false) }} onPointerMove={e => { if (e.buttons & 1) dragLane(e, lane, true) }} onPointerUp={() => { dragging.current = false }}>{steps.map((x, i) => {
          const value = x[lane.key], ratio = lane.min < 0 ? Math.abs(value) / lane.max / 2 : (value - lane.min) / (lane.max - lane.min)
          return <span key={i} role="slider" aria-valuemin={lane.min} aria-valuemax={lane.max} aria-valuenow={value} className={`seq-bar${plays(x) ? '' : ' off'}${i === step ? ' sel' : ''}`} aria-label={`${t(lane.label)} · ${t('Step')} ${i + 1}`} style={{ ['--c' as string]: trackColors[track], height: `${Math.max(3, ratio * 100)}%`, alignSelf: lane.min < 0 ? (value < 0 ? 'start' : 'end') : undefined }} />
        })}</div></div>)}</div>
      </div>}
      {view === 'roll' && <div className="seq-rollview">
        <h3>{t('Track')} {track + 1} · {t('piano roll')}</h3>
        <div className="seq-roll" style={{ ['--rows' as string]: String(high - low + 1) }}>
          {Array.from({ length: high - low + 1 }, (_, r) => { const n = high - r; return <div key={n} className={`seq-roll-row${noteNames[n % 12].includes('#') ? ' black' : ''}`}><span className="seq-roll-key" data-i18n-skip>{noteName(n)}</span>{Array.from({ length: 32 }, (_, i) => { const x = steps[i], on = plays(x) && x.note === n; return <button key={i} className={`seq-roll-cell${on ? ' on' : ''}${i % 4 ? '' : ' beat'}${i === step && n === s.note ? ' sel' : ''}`} style={{ ['--c' as string]: trackColors[track] }} aria-label={`${noteName(n)} · ${t('Step')} ${i + 1}`} onClick={() => { setStep(i); patch(on ? { rest: true } : { note: n, mask: false, rest: false, velocity: x.velocity || velocity }, i) }} /> })}</div> })}
        </div>
      </div>}
      {view === 'table' && <div className="seq-table-wrap"><table className="seq-table"><thead><tr>{['Step', 'Note', 'Velocity', 'Start offset', 'Note length (0–15)', 'CC 1 (raw)', 'CC 2 (raw)', 'Polyphony (raw)', 'Muted', 'Skipped'].map(h => <th key={h}>{t(h)}</th>)}</tr></thead>
        <tbody>{steps.map((x, i) => <tr key={i} aria-selected={i === step} onClick={() => setStep(i)}><th data-i18n-skip>{i + 1}</th>{(['note', 'velocity', 'delay', 'gate', 'alpha', 'beta', 'voices'] as const).map(k => <td key={k}><input type="number" aria-label={`${t('Step')} ${i + 1} · ${k}`} value={x[k]} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) try { patch({ [k]: v } as Partial<ZaqStep>, i) } catch (error) { setNotice(String(error)) } }} /></td>)}
          {(['rest', 'mask'] as const).map(k => <td key={k}><input type="checkbox" aria-label={`${t('Step')} ${i + 1} · ${t(k === 'rest' ? 'Muted' : 'Skipped')}`} checked={x[k]} onChange={e => patch({ [k]: e.target.checked }, i)} /></td>)}</tr>)}</tbody></table></div>}
    </div>
    <aside className="seq-panel">
      <nav className="seq-tabs" role="tablist">{(['step', 'track', 'file'] as const).map(p => <button key={p} role="tab" aria-selected={panel === p} onClick={() => setPanel(p)}>{t({ step: 'Step', track: 'Track', file: 'File' }[p])}</button>)}</nav>
      <div className="seq-panel-content">
        {panel === 'step' && <>
          <p className="mock-caption mock-kind">{t('Track')} {track + 1} · {t('Step')} {step + 1}</p>
          <h2 className="mock-title" data-i18n-skip>{noteName(s.note)} · {s.velocity}</h2>
          <label className="mock-check"><input type="checkbox" checked={s.rest} onChange={e => patch({ rest: e.target.checked })} />{t('Muted')}</label>
          <label className="mock-check"><input type="checkbox" checked={s.mask} onChange={e => patch({ mask: e.target.checked })} />{t('Skipped')}</label>
          <h3>{t('Note')}</h3>
          <div className="fields two"><label>{t('Note')}<select value={s.note} onChange={e => patch({ note: Number(e.target.value) })}>{Array.from({ length: 128 }, (_, n) => <option key={n} value={n} data-i18n-skip>{noteName(n)} ({n})</option>)}</select></label>
            <label>{t('Velocity')}<input type="number" min="1" max="127" value={s.velocity} onChange={e => patch({ velocity: Math.max(0, Math.min(127, Number(e.target.value) || 0)) })} /></label></div>
          <h3>{t('Timing')} <span className="mock-caption">{t('units to confirm')}</span></h3>
          <div className="fields two"><label>{t('Start offset')}<input type="number" min="-127" max="127" value={s.delay} onChange={e => patch({ delay: Math.max(-127, Math.min(127, Number(e.target.value) || 0)) })} /></label>
            <label>{t('Note length (0–15)')}<select value={s.gate} onChange={e => patch({ gate: Number(e.target.value) })}>{noteLengths.map((l, i) => <option key={i} value={i} data-i18n-skip>{i} · {l}</option>)}</select></label></div>
          <p className="mock-caption">{t('Length names from the manual; their order in the codes is deduced (same list as quantization).')}</p>
          <h3>{t('Track CC values')} <span className="mock-caption">{t('−1 = off')}</span></h3>
          <div className="fields two"><label>CC 1 (α)<input type="number" min="-1" max="127" value={ccValue(s.alpha)} onChange={e => patch({ alpha: ccRaw(Math.max(-1, Math.min(127, Math.round(Number(e.target.value) || 0)))) })} /></label>
            <label>CC 2 (β)<input type="number" min="-1" max="127" value={ccValue(s.beta)} onChange={e => patch({ beta: ccRaw(Math.max(-1, Math.min(127, Math.round(Number(e.target.value) || 0)))) })} /></label></div>
        </>}
        {panel === 'track' && <>
          <p className="mock-caption mock-kind">{t('Track')} {track + 1}</p>
          {(() => { const h = trackHeader(data, track); return <table className="seq-header"><tbody>
            {([['Muted track', h.mute ? t('yes') : t('no')], ['Direction (code)', `${h.direction} · ${directions[h.direction] ?? '?'}`], ['Sequence start', h.start], ['Sequence length', h.length], ['Sequence offset', h.offset], ['Clock divider (code)', `${h.clockDivider} · ${clockDividers[h.clockDivider] ?? '?'}`], ['Shuffle even / odd ticks', `${h.shuffleEven} / ${h.shuffleOdd}`], ['Skipped steps', h.skipped], ['Muted drum voices', h.drumMutes]] as [string, string | number][]).map(([k, v]) => <tr key={k}><th>{t(k)}</th><td data-i18n-skip>{v}</td></tr>)}
          </tbody></table> })()}
          <p className="mock-caption">{t('Read only. Field names from the Zaquencer preset map published by its author; not yet observed on a BCR32 export. The header is kept byte for byte.')}</p>
          <p className="mock-caption" data-i18n-skip>{data.slice(track * 256, track * 256 + 16).map(b => b.toString(16).padStart(2, '0')).join(' ')}</p>
          <p className="mock-caption">{t('Sequencer global settings (scale, root, transpose, quantization) are in the Device tab.')}</p>
        </>}
        {panel === 'file' && <>
          <section className="mock-card"><b>{t('Front-panel export')}</b><p className="mock-caption">{t('Export the pattern on the BCR32: the editor only listens, nothing is sent.')}</p><div className="mock-actions"><button className={listen ? 'primary' : undefined} aria-pressed={listen} onClick={() => setListen(v => !v)}>{t(listen ? 'Stop listening' : 'Listen')}</button></div></section>
          <section className="mock-card"><b>{t('Files')}</b><div className="mock-actions">
            <label className="file">{t('Import .syx or MIDI…')}<input type="file" accept=".syx,.mid,.midi,.smf,application/octet-stream,audio/midi" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }} /></label>
            <button onClick={() => { try { download(new Uint8Array(patternFile(entry.pattern, data)), 'bcr32-pattern.syx', 'application/octet-stream'); setNotice('File saved. Nothing was sent to the BCR32.') } catch (e) { setNotice(String(e)) } }}>{t('Export .syx')}</button>
            <button onClick={() => { try { download(patternToMidi(data), 'bcr32-pattern.mid', 'audio/midi'); setNotice('File saved. Nothing was sent to the BCR32.') } catch (e) { setNotice(String(e)) } }}>{t('Export MIDI')}</button></div></section>

          <section className="mock-card"><b>{t('Send to the BCR32')}</b><p className="mock-caption">{t('Disabled until the validation plan is done: backup, sacrificial slot, compared re-export, power-cycle check.')}</p><div className="mock-actions"><button disabled>{t('Send to a slot…')}</button></div></section>
        </>}
      </div>
      <p className="seq-status" role="status">{t(notice)}</p>
    </aside>
    {midi && <MidiImportDialog name={midi.name} file={midi.file} initialGrid={midi.grid} onApply={applyMidi} onCancel={() => setMidi(null)} />}
  </section>
}
