import { knownRecords, type ControllerDump, type DumpRecord } from './controller-dump'
import { translate, useLanguage } from './i18n'

// Files > Front-panel export: the last export received from the BCR32, decoded. Only records whose control is
// established on hardware can be applied to the profile; the others are shown for analysis.
export function ExportImport({ dumps, apply, save }: { dumps: ControllerDump[]; apply: (record: DumpRecord) => void; save: (dump: ControllerDump) => void }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const dump = dumps[0]
  const hex = (bytes: number[]) => bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
  return <div className="export-import" role="group" aria-label={t('Front-panel export')}>
    <h3>{t('Front-panel export')}</h3>
    <p className="surface-help">{t('BCR32 Studio listens while you export from the controller: STORE, hold SELECT, press encoder 1, then encoder 8. Nothing is sent to the BCR32.')}</p>
    {!dump && <p className="surface-help export-waiting">{t('Waiting for an export…')}</p>}
    {dump && <>
      <p className="surface-help" data-i18n-skip>{`${t('Block')} ${dump.block} · ${dump.checksumOk ? t('checksum OK') : t('checksum error')} · ${dumps.length} ${t('received')}`}</p>
      <div className="export-actions"><button onClick={() => save(dump)}>{t('Save the export (.syx)')}</button></div>
      <table>
        <thead><tr><th>#</th><th>{t('Control')}</th><th>{t('Assignment')}</th><th /></tr></thead>
        <tbody>{dump.records.map(r => {
          const known = knownRecords[r.index]
          return <tr key={r.index} className={r.plausible ? undefined : 'export-noise'}>
            <td>{r.index}</td>
            <td>{known ? `${t('Encoder')} ${known.id}` : '?'}</td>
            <td data-i18n-skip title={hex(r.raw)}>{r.plausible ? `${r.type?.toUpperCase()} ${r.parameter} · ch ${r.channel} · ${r.minimum}–${r.maximum}` : hex(r.raw)}</td>
            <td>{known && r.plausible && dump.checksumOk && <button onClick={() => apply(r)}>{t('Apply')}</button>}</td>
          </tr>
        })}</tbody>
      </table>
      <p className="surface-help">{t('Only record 0 (encoder 1) is identified on hardware so far; the other records need a comparison test.')}</p>
    </>}
  </div>
}
