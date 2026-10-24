import { useState } from 'react'
import { deviceGlobals, globalChoices, editableGlobals, globalWritesEnabled, riskyGlobals, valueOf, type GlobalResult } from './device-globals'
import type { ControllerSettings } from './profile'
import { translate, useLanguage } from './i18n'

// Device tab: every global setting of the BCR32 once, in groups that stay open, with the editor value (a choice
// list linked to the profile through device-globals valueOf / withValue), the value the BCR32 reported at the last
// read and a ≠ marker. Writes stay behind globalWritesEnabled (false since the 2026-10-13 freeze); settings that can
// cut the USB link need a second click. LED brightness is a live control without STORE; Device ID and the
// bootloader status sit under Advanced.
export type WriteStatus = 'busy' | 'ok' | 'mismatch' | 'no reply'
export const deviceGroups: { id: string; name: string; cmds: number[] }[] = [
  { id: 'footswitches', name: 'Footswitches', cmds: [0x1b, 0x1c] },
  { id: 'routing', name: 'MIDI routing', cmds: [0x30, 0x1e, 0x1d] },
  { id: 'mode', name: 'Mode', cmds: [0x1f, 0x17] },
  { id: 'clock', name: 'Clock', cmds: [0x18, 0x20, 0x21] },
  { id: 'sequencer', name: 'Sequencer', cmds: [0x23, 0x24, 0x25, 0x26, 0x27, 0x28] },
]
if (deviceGroups.flatMap(g => g.cmds).sort().join() !== editableGlobals.map(g => g.cmd).sort().join()) throw Error('Every editable global belongs to exactly one group')

export function DeviceSettings({ firmware = null, results, settings, change, update, autoLoad, canRead, busy, read, reset, write = () => {}, writeStatus = {}, readAt = null, brightness, draft, setDraft, brightnessEnabled, brightnessStatus, editFootswitch }: {
  firmware?: string | null; results: GlobalResult[] | null; settings: ControllerSettings; change: (cmd: number, value: number) => void
  update: (change: Partial<ControllerSettings>) => void
  autoLoad: boolean; canRead: boolean; busy: boolean; read: () => void; reset: () => void
  write?: (cmd: number) => void; writeStatus?: Record<number, WriteStatus>; readAt?: string | null
  brightness: number | null; draft: number; setDraft: (n: number) => void; brightnessEnabled: boolean; brightnessStatus: string
  editFootswitch: (index: 0 | 1) => void
}) {
  const [confirming, setConfirming] = useState<number | null>(null), [query, setQuery] = useState(''), [onlyDiffering, setOnlyDiffering] = useState(false)
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const reported = (cmd: number) => results?.find(r => r.cmd === cmd && r.status === 'value') ?? null
  const label = (cmd: number, value: number | null) => {
    if (value === null) return '—'
    const choice = globalChoices(cmd, firmware)?.[value]
    return choice ? t(choice) : `${value}`
  }
  const differs = (cmd: number) => { const d = reported(cmd)?.value ?? null; return d !== null && valueOf(cmd, settings, firmware) !== null && valueOf(cmd, settings, firmware) !== d }
  const differing = editableGlobals.filter(g => differs(g.cmd))
  const safeChanges = differing.filter(g => !riskyGlobals.has(g.cmd))
  const statusText: Record<WriteStatus, string> = { busy: t('Writing…'), ok: t('Written and read back'), mismatch: t('Read-back differs'), 'no reply': t('No reply') }
  const needle = query.trim().toLocaleLowerCase()
  const shown = (cmd: number) => (!onlyDiffering || differs(cmd)) && (!needle || t(deviceGlobals.find(g => g.cmd === cmd)!.name).toLocaleLowerCase().includes(needle))
  const row = (cmd: number) => {
    const g = editableGlobals.find(e => e.cmd === cmd)!, current = valueOf(cmd, settings, firmware), device = reported(cmd)?.value ?? null
    const options = Array.from({ length: (g.max ?? 127) + 1 }, (_, i) => i)
    return <div key={cmd} className={differs(cmd) ? 'device-row device-row-differs' : 'device-row'}>
      <span className="device-name">{t(g.name)}{riskyGlobals.has(cmd) && <span className="device-risky" title={t('This setting can cut the USB link with the editor; it can be restored from the front panel.')}> ⚠</span>}</span>
      <select aria-label={t(g.name)} value={current ?? ''} onChange={event => change(cmd, Number(event.target.value))}>
        {current === null && <option value="">—</option>}
        {options.map(i => <option key={i} value={i}>{globalChoices(cmd, firmware)?.[i] !== undefined ? t(globalChoices(cmd, firmware)![i]) : i}</option>)}
      </select>
      <span className="device-reported"><span data-i18n-skip>{label(cmd, device)}</span>{reported(cmd)?.source === 'bcl' && <small title={`Indexed reply: ${reported(cmd)?.indexedValue ?? '—'}`}> · BCL</small>}{differs(cmd) && <span className="device-differs" title={t('Differs from the value read on the BCR32')}> ≠</span>}</span>
      {globalWritesEnabled && differs(cmd) && canRead && writeStatus[cmd] !== 'busy' && (riskyGlobals.has(cmd) && confirming !== cmd
        ? <button className="device-write" onClick={() => setConfirming(cmd)}>{t('Write…')}</button>
        : <button className="device-write" onClick={() => { setConfirming(null); write(cmd) }}>{riskyGlobals.has(cmd) ? t('Confirm') : t('Write')}</button>)}
      {confirming === cmd && differs(cmd) && <small className="device-risk">{t('This setting can cut the USB link with the editor; it can be restored from the front panel.')}</small>}
      {writeStatus[cmd] && <small className={`device-write-status ${writeStatus[cmd]}`}>{statusText[writeStatus[cmd]!]}</small>}
    </div>
  }
  const jump = (id: string) => document.getElementById(`device-group-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return <div className="device-globals device-list" role="group" aria-label={t('Device settings')}>
    <div className="device-actions">
      <button disabled={!canRead || busy} onClick={read}>{busy ? t('Reading…') : t('Read from the BCR32')}</button>
      {!autoLoad && <button onClick={reset}>{t('Reset to editor defaults')}</button>}
      {globalWritesEnabled && canRead && safeChanges.length > 0 && <button className="primary" onClick={() => safeChanges.forEach(g => write(g.cmd))}>{t('Write all changes')}</button>}
      <small role="status">{readAt ? <>{t(`Read from the BCR32 at ${readAt}.`)} <span data-i18n-skip>{differing.length} ≠</span></> : t('Not read yet')}</small>
    </div>
    {!globalWritesEnabled && <p className="hardware-note">{t('Writing to the BCR32 is disabled: it froze the controller.')} {t('Changes here stay in the editor.')}</p>}
    <div className="device-filter">
      <input type="search" aria-label={t('Filter settings')} placeholder={t('Filter settings')} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="device-filter-scope" role="group" aria-label={t('Settings shown')}><button aria-pressed={!onlyDiffering} onClick={() => setOnlyDiffering(false)}>{t('All')}</button><button aria-pressed={onlyDiffering} onClick={() => setOnlyDiffering(true)}>≠ BCR32</button></div>
    </div>
    <nav className="device-anchors" aria-label={t('Setting groups')}>{deviceGroups.map(g => <button key={g.id} onClick={() => jump(g.id)}>{t(g.name)}</button>)}<button onClick={() => jump('led')}>LED</button></nav>
    <div className="device-columns" aria-hidden="true"><span /><span>{t('Editor')}</span><span>BCR32</span></div>
    {deviceGroups.map(group => {
      const cmds = group.cmds.filter(shown)
      if (!cmds.length && (onlyDiffering || needle)) return null
      return <section key={group.id} id={`device-group-${group.id}`} className="device-group" aria-label={t(group.name)}>
        <h3>{t(group.name)}</h3>
        {cmds.map(row)}
        {group.id === 'footswitches' && !onlyDiffering && !needle && <div className="device-group-actions">{([0, 1] as const).map(i => <button key={i} onClick={() => editFootswitch(i)}>{t(`Edit FOOTSW ${i + 1}`)}</button>)}</div>}
        {group.id === 'routing' && settings.operationMode !== 'mixed' && <p className="muted">{t('Full routing requires MIXED operation mode.')}</p>}
      </section>
    })}
    {!onlyDiffering && !needle && <>
      <section id="device-group-led" className="device-group" aria-label={t('LED brightness · hardware')}>
        <h3>{t('LED brightness · hardware')}</h3>
        <label>{t('LED brightness')} · {draft} <small>({t('Read-back:')} {brightness ?? 'N/A'} / 15)</small><input aria-label={t('LED brightness')} type="range" min="0" max="15" value={draft} disabled={!brightnessEnabled || brightness === null} onChange={e => setDraft(Number(e.target.value))} /></label>
        <p className="muted" role="status">{t(brightnessStatus || 'SysEx permission required · immediate effect only, no STORE.')}</p>
      </section>
      <details className="device-advanced"><summary>{t('Advanced')}</summary>
        <label>{t('Device ID')}<input type="number" min="1" max="255" value={settings.deviceId} onChange={e => update({ deviceId: Math.max(1, Math.min(255, Math.round(Number(e.target.value) || 1))) })} /></label>
        <p className="device-row"><span className="device-name">{t(deviceGlobals.find(g => g.cmd === 0x74)!.name)}</span><span data-i18n-skip>{label(0x74, reported(0x74)?.value ?? null)}</span></p>
      </details>
    </>}
  </div>
}
