export const nativePresenceRecovered = 'Native MIDI presence recovered.'
export const recoveryNoticeDurationMs = 4000

type NoticeSetter = (update: (current: string) => string) => void
type Scheduler = (callback: () => void, delayMs: number) => () => void

const schedule: Scheduler = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs)
  return () => clearTimeout(timer)
}

/** Only known informational notices expire; warnings remain until resolved or dismissed. */
export function expireHostNotice(message: string, setNotice: NoticeSetter, scheduler: Scheduler = schedule): () => void {
  if (message !== nativePresenceRecovered) return () => {}
  return scheduler(() => setNotice(current => current === message ? '' : current), recoveryNoticeDurationMs)
}
