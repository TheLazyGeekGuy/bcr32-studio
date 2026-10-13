import { useState } from 'react'
import { deviceGlobals, editableGlobals, riskyGlobals, valueOf, type GlobalResult } from './device-globals'
import type { ControllerSettings } from './profile'
import { translate, useLanguage } from './i18n'

// Config > Device settings: every global setting of the BCR32 as a choice list, linked to the Config fields
// (src/device-globals.ts valueOf / withValue). The "BCR32" column shows what the controller reported at the last read;
// a choice that differs is marked and can be written (then read back). Settings that can cut the USB link need a
// second click.
export type WriteStatus = 'busy' | 'ok' | 'mismatch' | 'no reply'
export function DeviceSettings({ results, settings, change, autoLoad, setAutoLoad, canRead, busy, read, reset, write = () => {}, writeStatus = {} }: {
  results: GlobalResult[] | null; settings: ControllerSettings; change: (cmd: number, value: number) => void
  autoLoad: boolean; setAutoLoad: (on: boolean) => void; canRead: boolean; busy: boolean; read: () => void; reset: () => void
  write?: (cmd: number) => void; writeStatus?: Record<number, WriteStatus>
}) {
  const [confirming, setConfirming] = useState<number | null>(null)
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const reported = (cmd: number) => results?.find(r => r.cmd === cmd && r.status === 'value') ?? null
  const label = (cmd: number, value: number | null) => {
    if (value === null) return '—'
    const choice = deviceGlobals.find(g => g.cmd === cmd)?.choices?.[value]
    return choice ? `${choice}` : `${value}`
  }
  const differing = editableGlobals.filter(g => { const d = reported(g.cmd)?.value ?? null; return d !== null && valueOf(g.cmd, settings) !== null && valueOf(g.cmd, settings) !== d })
  const safeChanges = differing.filter(g => !riskyGlobals.has(g.cmd))
  const statusText: Record<WriteStatus, string> = { busy: t('Writing…'), ok: t('Written and read back'), mismatch: t('Read-back differs'), 'no reply': t('No reply') }
  return <div className="device-globals" role="group" aria-label={t('Device settings')}>
    <h3>{t('Device settings')}</h3>
    <p className="surface-help">{t('Values read from the BCR32 and chosen here. Write sends a changed value to the BCR32, then reads it back.')}</p>
    <label className="zoom-option"><input type="checkbox" checked={autoLoad} onChange={event => setAutoLoad(event.target.checked)} />{t('Load the settings from the BCR32 at connection')}</label>
    <div className="device-globals-actions">
      <button disabled={!canRead || busy} onClick={read}>{busy ? t('Reading…') : t('Read from the BCR32')}</button>
      {!autoLoad && <button onClick={reset}>{t('Reset to editor defaults')}</button>}
      {canRead && safeChanges.length > 0 && <button className="primary" onClick={() => safeChanges.forEach(g => write(g.cmd))}>{t('Write all changes')}</button>}
    </div>
    <table>
      <thead><tr><th>{t('Setting')}</th><th>{t('Value')}</th><th>BCR32</th></tr></thead>
      <tbody>
        {editableGlobals.map(g => {
          const current = valueOf(g.cmd, settings), device = reported(g.cmd)?.value ?? null
          const differs = device !== null && current !== device
          const options = Array.from({ length: (g.max ?? 127) + 1 }, (_, i) => i)
          return <tr key={g.cmd} className={differs ? 'device-row-differs' : undefined}>
            <td>{t(g.name)}</td>
            <td><select aria-label={t(g.name)} value={current ?? ''} onChange={event => change(g.cmd, Number(event.target.value))}>
              {current === null && <option value="">—</option>}
              {options.map(i => <option key={i} value={i}>{g.choices?.[i] ?? i}</option>)}
            </select></td>
            <td><span data-i18n-skip>{label(g.cmd, device)}</span>{differs && <span className="device-differs" title={t('Differs from the value read on the BCR32')}> ≠</span>}
              {differs && canRead && writeStatus[g.cmd] !== 'busy' && (riskyGlobals.has(g.cmd) && confirming !== g.cmd
                ? <button className="device-write" onClick={() => setConfirming(g.cmd)}>{t('Write…')}</button>
                : <button className="device-write" onClick={() => { setConfirming(null); write(g.cmd) }}>{riskyGlobals.has(g.cmd) ? t('Confirm') : t('Write')}</button>)}
              {confirming === g.cmd && differs && <small className="device-risk">{t('This setting can cut the USB link with the editor; it can be restored from the front panel.')}</small>}
              {writeStatus[g.cmd] && <small className={`device-write-status ${writeStatus[g.cmd]}`}>{statusText[writeStatus[g.cmd]!]}</small>}</td>
          </tr>
        })}
        {[0x40, 0x74].map(cmd => <tr key={cmd}><td>{t(deviceGlobals.find(g => g.cmd === cmd)!.name)}</td><td colSpan={2} data-i18n-skip>{label(cmd, reported(cmd)?.value ?? null)}</td></tr>)}
      </tbody>
    </table>
  </div>
}
