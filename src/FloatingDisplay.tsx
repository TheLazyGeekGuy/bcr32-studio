import type { CSSProperties } from 'react'
import { NameDisplay, OledDisplay } from './OledDisplay'
import type { Encoder } from './profile'
import type { Selection } from './FrontPanel'

// Floating display: the OLED and the label screen in a small always-on-top window (Document Picture-in-Picture,
// Chrome/Edge 116+), movable and resizable anywhere on screen, e.g. over a DAW. Content is rendered into that window
// with a React portal from the main page; the display's timers run in the floating window, which stays visible, so
// they keep their rate when the main window is minimised (src/App.tsx, arbiter timers).
type PipApi = { requestWindow: (options: { width: number; height: number }) => Promise<Window>; window: Window | null }
const pipApi = (): PipApi | null => typeof window !== 'undefined' && 'documentPictureInPicture' in window ? (window as unknown as { documentPictureInPicture: PipApi }).documentPictureInPicture : null
export const floatingSupported = () => pipApi() !== null

// Opens the window (must follow a user click) and gives it the page's styles. The floating document inherits the page's
// Content-Security-Policy (style-src 'self'), which blocks inline <style>: a stylesheet file is linked again by its URL;
// only sheets without a file (the dev server injects them, without CSP) are copied as text.
export function copyStyles(from: Document, to: Document) {
  for (const sheet of Array.from(from.styleSheets)) {
    if (sheet.href) { const link = to.createElement('link'); link.rel = 'stylesheet'; link.href = sheet.href; to.head.append(link); continue }
    try {
      const style = to.createElement('style')
      style.textContent = Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')
      to.head.append(style)
    } catch { /* Unreadable sheet without a URL: nothing to copy. */ }
  }
}
export async function openFloatingWindow(width = 380, height = 290): Promise<Window> {
  const api = pipApi()
  if (!api) throw Error('Floating window not supported by this browser')
  const pip = await api.requestWindow({ width, height })
  copyStyles(document, pip.document)
  pip.document.title = 'BCR32 Studio'
  pip.document.body.className = 'floating-body'
  return pip
}

// Timers that run in the floating window while it is open (visible, so not throttled), else in the main window.
// clear() always targets the window that created the timer.
export function delegatingTimers(current: () => Window | null) {
  return {
    set: (fn: () => void, ms: number) => { const win = current() ?? window; return { win, id: win.setTimeout(fn, ms) } },
    clear: (timer: unknown) => { const t = timer as { win: Window; id: number } | null; if (t) t.win.clearTimeout(t.id) },
  }
}

const fill: CSSProperties = { position: 'relative', left: 'auto', top: 'auto', width: '100%', height: 'auto' }
export function FloatingDisplay({ theme, displayStyle, control, config, label, value, source, inspect, setValue }: {
  theme: string; displayStyle: string; control: Selection; config: Encoder; label: string
  value: number | null; source: 'local' | 'midi' | 'relative'; inspect: () => void; setValue: (value: number) => void
}) {
  return <main className="studio floating-display" data-theme={theme} data-display={displayStyle}>
    <NameDisplay text={label} blank={config.display === false} style={{ ...fill, aspectRatio: '192 / 49' }} />
    <OledDisplay control={control} config={config} value={value} source={source} style={{ ...fill, aspectRatio: '192 / 98' }} inspect={inspect} setValue={setValue} />
  </main>
}
