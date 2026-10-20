import { useState } from 'react'
import { translate, useLanguage } from './i18n'

// Built-in help: short topics, searched as you type in the current language, matches highlighted.
export const helpTopics: [string, string][] = [
  ['Select controls', 'Click a control on the panel. Cmd/Ctrl+click adds or removes one, Shift+click selects a range, Multi-select lets the mouse add controls.'],
  ['Rearrange controls', 'Drag a control onto another: the middle swaps them, the left or right edge inserts before or after, Alt copies. On the BCR32, drag an encoder by its name.'],
  ['Change a value', 'Use the slider or the screen in the inspector. On a B-Control panel the mouse wheel turns an encoder, Shift for finer steps.'],
  ['Undo and redo', 'Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z or Ctrl+Y redoes, in the current preset only.'],
  ['MIDI Learn', 'Press Learn, then move a control on any MIDI device: the first matching message fills type, channel and parameter.'],
  ['MIDI monitor', 'At the bottom: every message in and out with the control it belongs to. Select a row and press Apply to selection to assign it.'],
  ['Floating display', 'Shows the screens in a bare always-on-top window, over a DAW for instance. Needs Chrome, Edge, Brave or Safari.'],
  ['Presets', 'The draft is kept in the browser. Presets tab: create, save and rename. Each controller model keeps its own presets.'],
  ['Controller model', 'In Config, choose BCR32 or BCR2000; the editor reloads with that model.'],
  ['BCL files and reading', 'BCR2000, Files tab: import or export BCL text or SysEx, read the current preset or any preset from the controller. Read requests only.'],
  ['Safety', 'Nothing is written to a controller’s memory: BCR32 global settings writes are disabled and no B-Control write exists yet.'],
]
function mark(text: string, query: string) {
  if (!query) return text
  const at = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  return at < 0 ? text : <>{text.slice(0, at)}<mark>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>
}
export function HelpPanel() {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [query, setQuery] = useState('')
  const q = query.trim(), topics = helpTopics.map(([title, body]) => [t(title), t(body)]).filter(([title, body]) => !q || `${title} ${body}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
  return <section className="help-panel" aria-label={t('Help')}>
    <h2>{t('Help')}</h2>
    <input type="search" value={query} placeholder={t('Search the help…')} aria-label={t('Search the help…')} onChange={event => setQuery(event.target.value)} />
    {topics.length ? <dl data-i18n-skip>{topics.map(([title, body]) => <div key={title}><dt>{mark(title, q)}</dt><dd>{mark(body, q)}</dd></div>)}</dl> : <p className="surface-help">{t('No results')}</p>}
    <p className="surface-help">{t('Full guide: docs/USER-GUIDE.md in the repository.')}</p>
  </section>
}
