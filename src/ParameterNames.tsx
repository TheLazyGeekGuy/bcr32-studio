import { useEffect, useState } from 'react'
import type { Encoder } from './profile'
import { translatedTree, useLanguage, translate } from './i18n'
import { gsEntries, parameterBanks } from './parameter-banks'
import { defaultNames, mergeNames, nameKey, namesFile, parseNames, type ParameterName } from './parameter-names'
export function ParameterPicker({ config, entries, choose, save, openSignal = 0 }: { config: Encoder; entries: ParameterName[]; choose: (n: number) => void; save: (entries: ParameterName[]) => void; openSignal?: number }) {
  const language = useLanguage()
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false), [name, setName] = useState('')
  const current = entries.find(e => e.type === config.type && e.parameter === config.parameter) ?? (config.type === 'gs' ? gsEntries.find(e => e.parameter === config.parameter) : undefined)
  const supported = config.type === 'cc' || config.type === 'nrpn' || config.type === 'gs'
  useEffect(() => { setOpen(false); setEditing(false) }, [config.type, config.id])
  useEffect(() => { if (openSignal && supported) { setOpen(true); setQuery(''); setEditing(false) } }, [openSignal])
  const options = config.type === 'cc' ? Array.from({ length: config.mode.endsWith('_14') ? 32 : 128 }, (_, parameter) => ({ type: 'cc' as const, parameter, name: entries.find(e => e.type === 'cc' && e.parameter === parameter)?.name || 'N/A' })) : config.type === 'gs' ? mergeNames(gsEntries, entries.filter(e => e.type === 'gs')) : entries.filter(e => e.type === config.type)
  return translatedTree(<div className="parameter-picker">
    {config.type === 'gs' && <p className="muted">GS: local indices, hardware encoding unconfirmed.</p>}
    <button type="button" className="parameter-name" data-i18n-skip disabled={!supported} aria-expanded={open} onClick={() => { setOpen(!open); setQuery(''); setEditing(false) }}>{current?.name || 'N/A'}</button>
    {open && <div className="parameter-options"><input aria-label="Search parameters" placeholder="Number or name" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
      <div className="parameter-results">{options.filter(e => `${e.parameter} ${e.name}`.toLowerCase().includes(query.toLowerCase())).map(e => <button key={nameKey(e)} data-i18n-skip onClick={() => { choose(e.parameter); setOpen(false) }}>{e.parameter} · {e.name}</button>)}</div>
      {!options.length && <p className="muted">Instrument-specific table: add a name or import a table.</p>}
      <button onClick={() => { setName(current?.name || ''); setEditing(true) }}>Name {config.type.toUpperCase()} {config.parameter}</button>
      {editing && <form onSubmit={e => { e.preventDefault(); if (name.trim()) { save(mergeNames(entries, [{ type: config.type, parameter: config.parameter, name: name.trim().slice(0, 80) }])); setEditing(false); setOpen(false) } }}><input aria-label="Local parameter name" maxLength={80} value={name} onChange={e => setName(e.target.value)} /><button disabled={!name.trim()}>Save name</button></form>}
    </div>}
  </div>, language)
}
export function ParameterTable({ entries, save, download }: { entries: ParameterName[]; save: (entries: ParameterName[]) => void; download: (text: string, name: string) => void }) {
  const language = useLanguage()
  const [pending, setPending] = useState<ParameterName[]>([]), [checked, setChecked] = useState<Set<string>>(new Set()), [error, setError] = useState('')
  const [bankId, setBankId] = useState<string>(parameterBanks[0].id)
  const bank = parameterBanks.find(b => b.id === bankId)!
  const read = async (file?: File) => { if (!file) return; try { if (file.size > 1048576) throw Error('File too large.'); const rows = parseNames(JSON.parse(await file.text())); setPending(rows); setChecked(new Set(rows.map(nameKey))); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Invalid import') } }
  return translatedTree(<details className="parameter-table"><summary>Parameter names · {entries.length}</summary>
    <label>Documented tables<select aria-label="Documented tables" value={bankId} onChange={e => setBankId(e.target.value)}>{parameterBanks.map(b => <option data-i18n-skip key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <p className="muted" data-i18n-skip>{bank.url ? <a href={bank.url} target="_blank" rel="noreferrer">{bank.source}</a> : bank.source}</p>
    {bank.localIndices && <p className="muted">GS: local indices, hardware encoding unconfirmed.</p>}
    <div className="action-tabs"><button onClick={() => { setPending([...bank.entries]); setChecked(new Set(bank.entries.map(nameKey))); setError('') }}>Preview table</button><button onClick={() => download(JSON.stringify(namesFile([...bank.entries]), null, 2), `bcr32-${bank.id}-names.json`)}>Export table JSON</button></div>
    <button onClick={() => download(JSON.stringify(namesFile(entries), null, 2), 'bcr32-parameter-names.json')}>Export table JSON</button>
    <label className="file">Import table JSON<input type="file" accept="application/json,.json" onChange={e => { void read(e.target.files?.[0]); e.target.value = '' }} /></label>
    <button onClick={() => { if (window.confirm(translate('Replace local names with defaults?', language))) save(defaultNames.map(e => ({ ...e }))) }}>Restore default names</button>
    {!!pending.length && <div className="parameter-import"><div className="action-tabs"><button onClick={() => setChecked(new Set(pending.map(nameKey)))}>All</button><button onClick={() => setChecked(new Set())}>None</button><button onClick={() => setPending([])}>Cancel</button></div>
      <div className="parameter-results">{pending.map(e => <label data-i18n-skip key={nameKey(e)}><input type="checkbox" checked={checked.has(nameKey(e))} onChange={event => setChecked(current => { const next = new Set(current); if (event.target.checked) next.add(nameKey(e)); else next.delete(nameKey(e)); return next })} />{e.type.toUpperCase()} {e.parameter} · {e.name}</label>)}</div>
      <button disabled={!checked.size} onClick={() => { try { save(mergeNames(entries, pending.filter(e => checked.has(nameKey(e))))); setPending([]) } catch (e) { setError(String(e)) } }}>Import {checked.size} entries</button></div>}
    {error && <p role="alert">{error}</p>}
  </details>, language)
}
