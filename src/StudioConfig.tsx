import { defaultSettings, outputRoutingOptions, routingOptions, type Bcr32Profile, type ControllerSettings } from './profile'
import { differingFields } from './device-globals'
import { bcr32 } from './device-bcr32'
const buttonNames = bcr32.panel.buttonNames
import type { Selection } from './FrontPanel'
import { translate, useLanguage } from './i18n'

export function StudioConfig({ profile, update, select, brightness, draft, setDraft, brightnessEnabled, brightnessStatus, deviceSnapshot = null }: {
  profile: Bcr32Profile; update: (change: Partial<ControllerSettings>) => void; select: (s: Selection) => void
  brightness: number | null; draft: number; setDraft: (n: number) => void; brightnessEnabled: boolean; brightnessStatus: string
  deviceSnapshot?: { at: string; settings: Partial<ControllerSettings> } | null
}) {
  const s = profile.settings ?? defaultSettings()
  const language = useLanguage(), t = (text: string) => translate(text, language)
  // Fields edited here after a read from the controller: marked, because nothing is written to the device yet.
  const differs = new Set(deviceSnapshot ? differingFields(s, deviceSnapshot.settings) : [])
  const mark = (field: keyof ControllerSettings) => differs.has(field) ? <span className="device-differs" title={t('Differs from the value read on the BCR32')}> ≠ BCR32</span> : null
  return <div className="studio-config">
    <p className="muted">{t('Local configuration · hardware assignment writes are not validated.')}</p>
    {deviceSnapshot && <p className="muted device-read-status" role="status">{t(`Read from the BCR32 at ${deviceSnapshot.at}.`)} {t('Changes here stay in the editor: writing to the BCR32 is not available yet.')}</p>}
    <details open><summary>{t('Controls & footswitches')}</summary>
      <div className="config-extra-controls">{profile.buttons.filter(b => b.id >= 65).map(b => <button key={b.id} onClick={() => select({kind:'buttons',id:b.id})}>{buttonNames[profile.buttons.indexOf(b)]} · {b.type.toUpperCase()}</button>)}</div>
      {[0, 1].map(i => <label key={i}>{t(`FOOTSW ${i + 1} function`)}{mark('footswitchModes')}<select value={s.footswitchModes[i]} onChange={e => update({footswitchModes:s.footswitchModes.map((m,j)=>j===i?e.target.value as 'ctrl'|'zaq':m)})}><option value="ctrl">{t('CTRL · programmable')}</option><option value="zaq">{t(i === 0 ? 'ZAQ · start/stop' : 'ZAQ · next pattern')}</option></select></label>)}
    </details>
    <details open><summary>{t('LED brightness · hardware')}</summary>
      <output>{t('Read-back:')} {brightness ?? 'N/A'} / 15</output>
      <label>{t('LED brightness')} · {draft}<input aria-label={t('LED brightness')} type="range" min="0" max="15" value={draft} disabled={!brightnessEnabled || brightness === null} onChange={e=>setDraft(Number(e.target.value))} /></label>
      <p className="muted" role="status">{t(brightnessStatus || 'SysEx permission required · immediate effect only, no STORE.')}</p>
    </details>
    <details><summary>{t('Output routing')}</summary><label>{t('Destination')}{mark('outputRouting')}<select value={s.outputRouting} onChange={e=>update({outputRouting:e.target.value})}>{outputRoutingOptions.map(v=><option key={v}>{v}</option>)}</select></label></details>
    <details><summary>MIDI Through</summary>
      <label>{t('Source')}{mark('thruSource')}<select value={s.thruSource} onChange={e=>update({thruSource:e.target.value as ControllerSettings['thruSource'],...(e.target.value==='off'?{thruDestination:'Off'}:{})})}>{['off','midi','usb'].map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label>
      <label>{t('Destination')}{mark('thruDestination')}<select disabled={s.thruSource==='off'} value={s.thruDestination} onChange={e=>update({thruDestination:e.target.value})}>{['Off',...routingOptions].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="zoom-option"><input type="checkbox" checked={s.thruFiltered} onChange={e=>update({thruFiltered:e.target.checked})} />{t('Filtered')}{mark('thruFiltered')}</label>
      {s.operationMode!=='mixed'&&<p className="muted">{t('Full routing requires MIXED operation mode.')}</p>}
    </details>
    <details><summary>{t('General settings')}</summary>
      <label>{t('Startup mode')}{mark('startupMode')}<select value={s.startupMode} onChange={e=>update({startupMode:e.target.value as ControllerSettings['startupMode']})}><option value="ctrl">CTRL</option><option value="zqr">ZQR</option></select></label>
      <label>{t('Device ID')}<input type="number" min="1" max="255" value={s.deviceId} onChange={e=>update({deviceId:Math.max(1,Math.min(255,Math.round(Number(e.target.value)||1)))})} /></label>
      <label>{t('Operation mode')}{mark('operationMode')}<select value={s.operationMode} onChange={e=>update({operationMode:e.target.value as ControllerSettings['operationMode']})}>{['usb','stdl','mixed'].map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label>
    </details>
  </div>
}
