import { useState } from 'react'
import { groupExports, knownRecords, type ControllerDump, type DumpRecord } from './controller-dump'
import { translate, useLanguage } from './i18n'

// Files > Front-panel export: exports received from the BCR32, decoded. A "current preset" export brings block 0; an
// "all 64 presets" export brings every block of every preset, grouped here by header identity, and a preset whose 8
// blocks arrived is rebuilt as one record stream. Only records whose control is established on hardware can be
// applied to the profile; nothing is ever sent to the controller.
export function ExportImport({ dumps, apply, save, saveAll }: {
  dumps: ControllerDump[]; apply: (record: DumpRecord) => void; save: (dump: ControllerDump) => void; saveAll: (dumps: ControllerDump[]) => void
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [selected, setSelected] = useState(0)
  const dump = dumps[Math.min(selected, dumps.length - 1)] ?? null
  const groups = groupExports(dumps), complete = groups.filter(g => g.complete)
  const hex = (bytes: number[]) => bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
  return <div className="export-import" role="group" aria-label={t('Front-panel export')}>
    <h3>{t('Front-panel export')}</h3>
    <p className="surface-help">{t('BCR32 Studio listens while you export from the controller. Nothing is sent to the BCR32.')}</p>
    <ul className="export-procedures">
      <li>{t('Current preset: STORE, hold SELECT, press encoder 1, then encoder 8.')}</li>
      <li>{t('All 64 presets: STORE, hold SELECT, press encoder 1, then encoder 7.')}</li>
    </ul>
    {!dump && <p className="surface-help export-waiting">{t('Waiting for an export…')}</p>}
    {dump && <>
      <p className="surface-help export-summary" data-i18n-skip>{`${dumps.length} ${t('received')} · ${groups.length} ${t('presets')} · ${complete.length} ${t('complete (8 blocks)')}`}</p>
      <div className="export-actions">
        <label>{t('Export shown')}<select value={Math.min(selected, dumps.length - 1)} onChange={event => setSelected(Number(event.target.value))}>
          {dumps.map((d, i) => <option key={i} value={i}>{`#${dumps.length - i} · ${d.identity} · ${t('Block')} ${d.block}${d.checksumOk ? '' : ' · ✗'}`}</option>)}
        </select></label>
        <button onClick={() => save(dump)}>{t('Save the export (.syx)')}</button>
        {dumps.length > 1 && <button onClick={() => saveAll(dumps)}>{t('Save all exports (.syx)')}</button>}
      </div>
      <p className="surface-help" data-i18n-skip>{`${t('Block')} ${dump.block} · ${dump.identity} · ${dump.checksumOk ? t('checksum OK') : t('checksum error')}`}</p>
      <table>
        <thead><tr><th>#</th><th>{t('Control')}</th><th>{t('Assignment')}</th><th /></tr></thead>
        <tbody>{dump.records.map(r => {
          const known = dump.block === 0 ? knownRecords[r.index] : undefined
          return <tr key={r.index} className={r.plausible ? undefined : 'export-noise'}>
            <td>{r.index}</td>
            <td>{known ? `${t('Encoder')} ${known.id}` : '?'}</td>
            <td data-i18n-skip title={hex(r.raw)}>{r.plausible ? `${r.type?.toUpperCase()} ${r.parameter} · ch ${r.channel} · ${r.minimum}–${r.maximum}` : hex(r.raw)}</td>
            <td>{known && r.plausible && dump.checksumOk && <button onClick={() => apply(r)}>{t('Apply')}</button>}</td>
          </tr>
        })}</tbody>
      </table>
      {complete.length > 0 && <p className="surface-help export-complete" data-i18n-skip>{complete.map(g => `${g.identity}: ${g.records!.filter(r => r.plausible).length}/${g.records!.length} ${t('plausible records')}`).join(' · ')}</p>}
      <p className="surface-help">{t('Only record 0 of block 0 (encoder 1) is identified on hardware so far; the other records need a comparison test.')}</p>
    </>}
  </div>
}
