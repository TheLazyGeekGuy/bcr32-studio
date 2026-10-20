import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { translate, useLanguage } from './i18n'
import { asHex } from './web-midi'
import { bclFile, bclQuery, bclResponse, bclText, bclTokens } from './bcl'
import { createTargetReader, createTrackReader, firmwareOne, splitSysex, targetFields, trackFields, type TrackField } from './firmware-codec'
import { createZaqAssembler, decodeZaqBlock, patchStep, patternFile, readStep, type ZaqPattern, type ZaqStep } from './zaquencer'

export interface FirmwareToolsProps {
  firmware: string | null
  replyDevice?: number
  connectionKey: string
  canRead: boolean
  sendRead: (bytes: number[]) => void
  receive: MutableRefObject<(bytes: number[]) => void>
  download: (content: BlobPart, name: string, type?: string) => void
}
export function FirmwareTools({ firmware, replyDevice = 127, connectionKey, canRead, sendRead, receive, download }: FirmwareToolsProps) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [patterns, setPatterns] = useState<ZaqPattern[]>([]), [selected, setSelected] = useState(''), [track, setTrack] = useState(0)
  const [bcl, setBcl] = useState(''), [capture, setCapture] = useState(false), [notice, setNotice] = useState('')
  const [target, setTarget] = useState(50), [field, setField] = useState<typeof targetFields[number]>('type')
  const [trackField, setTrackField] = useState<TrackField>('mode'), [trackValue, setTrackValue] = useState('')
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false), [preset, setPreset] = useState(0)
  const assembler = useRef(createZaqAssembler()), captureFrames = useRef<number[][]>([]), capturing = useRef(false)
  const trackReader = useRef<ReturnType<typeof createTrackReader> | null>(null)
  const reader = useRef<ReturnType<typeof createTargetReader> | null>(null), mounted = useRef(false)
  const sendRef = useRef(sendRead); sendRef.current = sendRead
  // The connection key also changes for disconnects/port replacement. Pending reads and partial exports are discarded.
  useEffect(() => {
    mounted.current = true
    const transport = createTargetReader(bytes => sendRef.current(bytes),1200,replyDevice); reader.current = transport
    const trackTransport = createTrackReader(bytes => sendRef.current(bytes),1200,replyDevice); trackReader.current = trackTransport
    assembler.current.reset(); captureFrames.current = []; capturing.current = false; setCapture(false); setBusy(false); setValue(''); setTrackValue('')
    return () => { mounted.current = false; transport.close(); trackTransport.close(); reader.current = null; trackReader.current = null; assembler.current.reset() }
  }, [connectionKey, replyDevice])
  function addPattern(pattern: ZaqPattern) {
    // Retain local edits when the same destination arrives again; a deliberate file import replaces the workspace.
    setPatterns(list => list.some(p => p.identity === pattern.identity) ? list : [...list, pattern].slice(-192))
    setSelected(previous => previous || pattern.identity)
  }
  useEffect(() => {
    const handler = (bytes: number[]) => {
      reader.current?.receive(bytes); trackReader.current?.receive(bytes)
      const block = decodeZaqBlock(bytes)
      if (block) { const pattern = assembler.current.receive(block); if (pattern) { addPattern(pattern); setNotice('Pattern received. Edits stay in this browser until saved as a file.') } }
      const response = bclResponse(bytes)
      if (response) setNotice(response.kind === 'status' ? `${t('BCL status')}: ${response.line} / ${response.status}` : `${t('Preset name')}: ${response.preset + 1} · ${response.name}`)
      if (capturing.current && bytes[6] === 0x20) {
        try {
          if (captureFrames.current.length >= 16384) throw Error('BCL capture limit')
          const next = [...captureFrames.current, bytes], text = bclText(next)
          captureFrames.current = next; setBcl(text)
        } catch { capturing.current = false; setCapture(false); setNotice('Import rejected: invalid or incomplete firmware data.') }
      }
    }
    receive.current = handler
    return () => { if (receive.current === handler) receive.current = () => {} }
  }, [receive, language])
  const pattern = patterns.find(p => p.identity === selected) ?? patterns[0]
  const reportError = () => setNotice('Import rejected: invalid or incomplete firmware data.')
  async function importFile(file?: File) {
    if (!file) return
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('File limit')
      if (/\.bcl$/i.test(file.name)) { const text = await file.text(); bclFile(text); setBcl(text); capturing.current = false; setCapture(false); setNotice(''); return }
      const frames = splitSysex(new Uint8Array(await file.arrayBuffer()))
      if (frames.every(f => f[6] === 0x20)) { const text = bclText(frames); setBcl(text); capturing.current = false; setCapture(false); setNotice(''); return }
      const staging = createZaqAssembler(), complete: ZaqPattern[] = []
      let count = 0
      for (const frame of frames) {
        const block = decodeZaqBlock(frame)
        if (!block || block.kind === 3) throw Error('Not a pattern export')
        const assembled = staging.receive(block)
        if (assembled) { complete.push(assembled); count += 8 }
      }
      if (count !== frames.length || !complete.length || complete.length > 192 || new Set(complete.map(p => p.identity)).size !== complete.length) throw Error('Incomplete or duplicate export')
      setPatterns(complete); setSelected(complete[0].identity); setTrack(0)
      setNotice('Pattern received. Edits stay in this browser until saved as a file.')
    } catch { reportError() }
  }
  function edit(step: number, patch: Partial<ZaqStep>) {
    if (!pattern) return
    try { const data = patchStep(pattern.data, track, step, patch); setPatterns(list => list.map(p => p.identity === pattern.identity ? { ...p, data } : p)) } catch { reportError() }
  }
  async function readTarget() {
    if (!reader.current || !canRead || !firmwareOne(firmware) || busy) return
    const transport = reader.current; setBusy(true); setValue('')
    try {
      const result = await transport.read(target, field)
      if (mounted.current && reader.current === transport) {
        setValue(result.value ? `${result.value.signed}${result.value.sentinel ? ' · ' + t('Sentinel · preserved') : ''}` : t(result.status === 'empty' ? 'Empty reply' : result.status === 'timeout' ? 'Read timeout' : 'Read cancelled'))
      }
    } catch { if (mounted.current && reader.current === transport) setValue(t('Read failed')) }
    finally { if (mounted.current && reader.current === transport) setBusy(false) }
  }
  async function readTrack() {
    const transport = trackReader.current
    if (!transport || !canRead || !firmwareOne(firmware) || busy) return
    setBusy(true); setTrackValue('')
    try {
      const result = await transport.read(track, trackField)
      if (mounted.current && trackReader.current === transport) setTrackValue(result.value ? `${result.value.signed}` : t(result.status === 'empty' ? 'Empty reply' : result.status === 'timeout' ? 'Read timeout' : 'Read cancelled'))
    } catch { if (mounted.current && trackReader.current === transport) setTrackValue(t('Read failed')) }
    finally { if (mounted.current && trackReader.current === transport) setBusy(false) }
  }
  function requestBcl(kind: 'preset' | 'global' | 'names') {
    if (!canRead || !firmwareOne(firmware)) return
    try {
      if (kind !== 'names') { captureFrames.current = []; capturing.current = true; setCapture(true) }
      sendRead(bclQuery(kind, preset))
    } catch { capturing.current = false; setCapture(false); setNotice('Read failed') }
  }
  function saveBcl(syx: boolean) {
    try { const bytes = bclFile(bcl); download(syx ? new Uint8Array(bytes) : bcl, syx ? 'bcr32-draft.bcl.syx' : 'bcr32-draft.bcl', syx ? 'application/octet-stream' : 'text/plain'); setNotice('File saved. Nothing was sent to the BCR32.') } catch { reportError() }
  }
  const labels = ['Type', 'Channel', 'Parameter', 'Value 1', 'Value 2', 'Mode', 'Option', 'Display']
  const targetName = (index: number) => index < 16 ? `${t('Button')} ${index + 1}` : index < 48 ? `${t('Push')} ${index - 15}` : index < 50 ? `${t('Footswitch')} ${index - 47}` : `${t('Encoder')} ${index - 49}`
  return <details className="firmware-tools">
    <summary>{t('Firmware tools · BCL and Zaquencer')}</summary>
    <p className="surface-help">{t('BCL and Zaquencer file editing stays offline. Hardware assignment sending is controlled in Config.')}</p>
    <label className="file">{t('Open pattern or BCL file')}<input type="file" accept=".syx,.bcl" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>
    <fieldset><legend>{t('Controller parameter read')}</legend>
      <label>{t('Control')}<select disabled={busy} value={target} onChange={e => { setTarget(Number(e.target.value)); setValue('') }}>{Array.from({ length: 82 }, (_, i) => <option key={i} value={i}>{targetName(i)}</option>)}</select></label>
      <label>{t('Field')}<select disabled={busy} value={field} onChange={e => { setField(e.target.value as typeof field); setValue('') }}>{targetFields.map((f, i) => <option key={f} value={f}>{t(labels[i])}</option>)}</select></label>
      <button disabled={!canRead || !firmwareOne(firmware) || busy} onClick={() => { void readTarget() }}>{t('Read parameter')}</button>
      <output data-i18n-skip>{value}</output>
      <p className="surface-help">{t('Raw values are preserved, including SysEx type 8. Reading does not change the local assignment.')}</p>
    </fieldset>
    <fieldset><legend>{t('Sequencer track read')}</legend>
      <label>{t('Track')}<select disabled={busy} value={track} onChange={e => { setTrack(Number(e.target.value)); setTrackValue('') }}>{[0, 1, 2, 3].map(i => <option key={i} value={i}>{i + 1}</option>)}</select></label>
      <label>{t('Field')}<select disabled={busy} value={trackField} onChange={e => { setTrackField(e.target.value as TrackField); setTrackValue('') }}>{trackFields.map((f, i) => <option key={f} value={f}>{t(['Mode', 'Port', 'Channel', 'Alpha', 'Beta'][i])}</option>)}</select></label>
      <button disabled={!canRead || !firmwareOne(firmware) || busy} onClick={() => { void readTrack() }}>{t('Read track parameter')}</button>
      <output data-i18n-skip>{trackValue}</output>
    </fieldset>
    <fieldset><legend>{t('BCL preset editor')}</legend>
      <label>{t('Preset')}<input type="number" min={1} max={64} value={preset + 1} onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 1 && v <= 64) setPreset(v - 1) }} /></label>
      <div className="preset-actions">
        <button disabled={!canRead || !firmwareOne(firmware)} onClick={() => requestBcl('preset')}>{t('Read BCL preset')}</button>
        <button disabled={!canRead || !firmwareOne(firmware)} onClick={() => requestBcl('global')}>{t('Read BCL global')}</button>
        <button disabled={!canRead || !firmwareOne(firmware)} onClick={() => requestBcl('names')}>{t('Read preset name')}</button>
        <button aria-pressed={capture} onClick={() => { captureFrames.current = []; capturing.current = !capture; setCapture(!capture) }}>{t(capture ? 'Stop BCL capture' : 'Capture BCL')}</button>
      </div>
      <textarea aria-label={t('BCL source')} value={bcl} disabled={capture} spellCheck={false} onChange={e => setBcl(e.target.value)} rows={12} />
      <p className="surface-help">{t('BCL describes controller presets. The .tx directive supports custom MIDI messages. Advanced syntax still needs hardware validation.')}</p>
      <p className="surface-help" data-i18n-skip>{bclTokens.join(' · ')}</p>
      <button disabled={!bcl.trim()} onClick={() => saveBcl(false)}>{t('Save BCL text')}</button> <button disabled={!bcl.trim()} onClick={() => saveBcl(true)}>{t('Save BCL SysEx file')}</button>
    </fieldset>
    <fieldset><legend>{t('Zaquencer pattern editor')}</legend>
      <p className="surface-help">{t('Import a complete eight-block pattern export, or export from the BCR32 while connected. Four tracks, 32 steps; unknown fields remain unchanged.')}</p>
      {!!patterns.length && <>
        <label>{t('Pattern')}<select value={pattern.identity} onChange={e => setSelected(e.target.value)}>{patterns.map(p => <option key={p.identity} value={p.identity}>{p.identity}</option>)}</select></label>
        <label>{t('Track')}<select value={track} onChange={e => setTrack(Number(e.target.value))}>{[0, 1, 2, 3].map(i => <option key={i} value={i}>{i + 1}</option>)}</select></label>
        <div className="firmware-step-scroll"><table><thead><tr>{['Step', 'Note', 'Velocity', 'Delay', 'Gate code', 'Alpha raw', 'Beta raw', 'Voices / chord raw', 'Rest', 'Step mask'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 32 }, (_, i) => {
            const step = readStep(pattern.data, track, i)
            return <tr key={i}><th scope="row">{i + 1}</th>{(['note', 'velocity', 'delay', 'gate', 'alpha', 'beta', 'voices'] as const).map(key => <td key={key}><input aria-label={`${t('Step')} ${i + 1} · ${t({ note: 'Note', velocity: 'Velocity', delay: 'Delay', gate: 'Gate code', alpha: 'Alpha raw', beta: 'Beta raw', voices: 'Voices / chord raw' }[key])}`} type="number" min={key === 'delay' ? -127 : 0} max={key === 'gate' ? 15 : key === 'voices' ? 65535 : key === 'alpha' || key === 'beta' ? 255 : 127} value={step[key]} onChange={e => edit(i, { [key]: Number(e.target.value) })} /></td>)}
              {(['rest', 'mask'] as const).map(key => <td key={key}><input type="checkbox" aria-label={`${t('Step')} ${i + 1} · ${t(key === 'rest' ? 'Rest' : 'Step mask')}`} checked={step[key]} onChange={e => edit(i, { [key]: e.target.checked })} /></td>)}</tr>
          })}</tbody></table></div>
        <p className="surface-help">{t('Gate codes are raw; velocity edits preserve their shared bits. Voice masks and chord codes depend on the track mode.')}</p>
        <button onClick={() => { try { download(new Uint8Array(patternFile(pattern)), 'bcr32-zaquencer-pattern.syx', 'application/octet-stream'); setNotice('File saved. Nothing was sent to the BCR32.') } catch { reportError() } }}>{t('Save edited pattern (.syx)')}</button>
        <details><summary>{t('Raw track header')}</summary><code>{asHex(pattern.data.slice(track * 256, track * 256 + 16))}</code></details>
      </>}
    </fieldset>
    {notice && <p role="status">{t(notice)}</p>}
  </details>
}
