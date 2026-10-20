import { useEffect, useState, type CSSProperties } from 'react'
import { translate, useLanguage } from './i18n'
import { unknownIndicators, type IndicatorReadings } from './controller-indicators'

export type Activity = { serial: number; source: 'local' | 'receive' | 'send'; pulses?: number[] }
export const idleActivity: Activity = { serial: 0, source: 'local' }
export const indicatorNames = ['MIDI IN', 'MIDI A', 'MIDI B', 'FOOTSW 1', 'FOOTSW 2', 'USB MODE']
export const activityDuration = 160

function ActivityLamp({ index, pulse, readings }: { index: number; pulse: number; readings: IndicatorReadings }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [lit, setLit] = useState(false)
  useEffect(() => {
    if (!pulse) { setLit(false); return }
    setLit(true)
    const timer = window.setTimeout(() => setLit(false), activityDuration)
    return () => window.clearTimeout(timer)
  }, [pulse])
  const name = indicatorNames[index]
  const detail = t(lit ? 'active' : 'inactive')
  const evidence = t(index === 3 || index === 4 ? 'Pedal assignment value received over MIDI' : index === 5 ? 'USB MIDI activity' : 'MIDI activity inferred from routing; DIN traffic is not reported separately')
  const style: CSSProperties = { left: `${(1434 + index * 46.6 - 16) / 1717 * 100}%`, top: `${136 / 1440 * 100}%`, width: `${32 / 1717 * 100}%`, height: `${32 / 1440 * 100}%` }
  return <span style={style} className={`led-socket ${index === 5 ? 'usb-indicator' : ''}`}>
    <span className={`activity-led ${lit ? index === 5 ? 'blue' : 'green' : 'off'}`} data-active={lit} data-known={index === 5 || index === 3 || index === 4 || readings.outputRouting !== null} data-source={index === 5 ? 'usb-activity' : index === 3 || index === 4 ? 'received-assignment' : 'routing-estimate'}
      aria-label={`${name} : ${detail}`} title={`${name} · ${evidence} · ${detail}`} />
    <span className="activity-label" aria-hidden="true">{['IN', 'A', 'B', '1', '2', 'USB'][index]}</span>
  </span>
}

export function ActivityLeds({ activity = idleActivity, readings = unknownIndicators }: { activity?: Activity; readings?: IndicatorReadings }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  return <div className="activity-indicators" aria-label={t('Controller routing and received pedal states')}>
    <span className="activity-group" style={{ left:'82.6%', top:'7.4%', width:'7.4%' }} aria-hidden="true">MIDI</span>
    <span className="activity-group" style={{ left:'90.6%', top:'7.4%', width:'4.5%' }} aria-hidden="true">FOOT</span>
    <span className="activity-group" style={{ left:'95.5%', top:'7.4%', width:'3%' }} aria-hidden="true">USB</span>
    {indicatorNames.map((name, i) => <ActivityLamp key={name} index={i} readings={readings} pulse={activity.pulses?.[i] ?? (i === 5 && activity.source !== 'local' ? activity.serial : 0)} />)}
  </div>
}
