import { useEffect, useState } from 'react'
import { activityDuration, type Activity } from './ActivityLeds'
import { translate, useLanguage } from './i18n'

// MIDI IN / OUT status lights for the side panel: dim without a paired port, steady when paired, a flash on each
// message received or sent. A click opens the connection settings.
export function MidiStatus({ activity, input, output, open }: { activity: Activity; input: string | null; output: string | null; open: () => void }) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [flash, setFlash] = useState<Activity['source'] | null>(null)
  useEffect(() => {
    if (!activity.serial || activity.source === 'local') return
    setFlash(activity.source)
    const timer = window.setTimeout(() => setFlash(null), activityDuration)
    return () => window.clearTimeout(timer)
  }, [activity.serial])
  const light = (label: string, port: string | null, lit: boolean) =>
    <button className={`midi-light ${port ? 'paired' : ''} ${lit ? 'lit' : ''}`} onClick={open} title={port ? `${label} · ${port}` : `${label} · ${t('no port')}`} data-i18n-skip>
      <span className="midi-dot" aria-hidden="true" />{label}</button>
  return <span className="midi-status" role="group" aria-label={t('MIDI ports')}>
    {light('IN', input, flash === 'receive')}{light('OUT', output, flash === 'send')}
  </span>
}
