import { useEffect, useState, type CSSProperties } from 'react'
import { translate, useLanguage } from './i18n'

export type Activity = { serial: number; source: 'local' | 'receive' | 'send' }
export const idleActivity: Activity = { serial: 0, source: 'local' }
export const indicatorNames = ['MIDI IN', 'MIDI A', 'MIDI B', 'FOOTSW 1', 'FOOTSW 2', 'USB MODE']
export const activityDuration = 160

export function ActivityLeds({ activity = idleActivity }: { activity?: Activity }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [lit, setLit] = useState(false)
  useEffect(() => {
    if (!activity.serial) return
    setLit(true)
    const timer = window.setTimeout(() => setLit(false), activityDuration)
    return () => window.clearTimeout(timer)
  }, [activity.serial])
  const source = t(activity.source === 'receive' ? 'MIDI received' : activity.source === 'send' ? 'MIDI sent' : 'local UI gesture')
  return <div className="activity-indicators" aria-label={t('Editor indicators, not a read-out of the hardware LEDs')}>
    <span className="activity-group" style={{ left:'82.6%', top:'7.4%', width:'7.4%' }} aria-hidden="true">MIDI</span>
    <span className="activity-group" style={{ left:'90.6%', top:'7.4%', width:'4.5%' }} aria-hidden="true">FOOT</span>
    <span className="activity-group" style={{ left:'95.5%', top:'7.4%', width:'3%' }} aria-hidden="true">USB</span>
    {indicatorNames.map((name, i) => {
      const active = i === 5 && lit
      const style: CSSProperties = { left: `${(1434 + i * 46.6 - 16) / 1717 * 100}%`, top: `${136 / 1440 * 100}%`, width: `${32 / 1717 * 100}%`, height: `${32 / 1440 * 100}%` }
      return <span key={name} style={style} className={`led-socket ${i === 5 ? 'usb-indicator' : ''}`}>
        <span className={`activity-led ${active ? 'blue' : 'off'}`} data-active={active} data-source={i === 5 ? activity.source : undefined}
          aria-label={`${name} : ${active ? source : t('off')}`} title={i === 5 ? `USB · ${t('activity')} ${source} · ${t('software indication')}` : `${name} · ${t('disabled, handling not implemented')}`} />
        <span className="activity-label" aria-hidden="true">{['IN', 'A', 'B', '1', '2', 'USB'][i]}</span>
      </span>
    })}
  </div>
}
