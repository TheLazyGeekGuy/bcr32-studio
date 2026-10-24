import { useState } from 'react'
import { movePreset, type ControllerPreset } from './presets'
import { translate, useLanguage } from './i18n'

// Presets › On this computer: the browser library as an ordered list. Drag a row (or use ↑ ↓) to reorder; the order
// is saved with the library and kept by its export. Choosing a row loads it into the editor only: nothing is sent.
export function LibraryList({ presets, activeId, recall, reorder, disabled = false }: {
  presets: readonly ControllerPreset[]; activeId: string; recall: (id: string) => void; reorder: (next: ControllerPreset[]) => void; disabled?: boolean
}) {
  const language = useLanguage(), t = (text: string) => translate(text, language)
  const [dragged, setDragged] = useState<number | null>(null), [over, setOver] = useState<number | null>(null)
  const move = (from: number, to: number) => { if (!disabled) reorder(movePreset(presets, from, to)) }
  if (!presets.length) return <p className="mock-caption library-empty">{t('No preset on this computer yet.')}</p>
  return <ol className="library-list" aria-label={t('Browser preset library')}>
    {presets.map((preset, i) => <li key={preset.id} draggable={!disabled} data-active={preset.id === activeId || undefined} data-over={over === i && dragged !== i || undefined}
      onDragStart={event => { setDragged(i); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(i)) }}
      onDragOver={event => { if (dragged === null) return; event.preventDefault(); setOver(i) }}
      onDragLeave={() => setOver(current => current === i ? null : current)}
      onDrop={event => { event.preventDefault(); if (dragged !== null) move(dragged, i); setDragged(null); setOver(null) }}
      onDragEnd={() => { setDragged(null); setOver(null) }}>
      <span className="library-grip" aria-hidden="true" title={t('Drag to reorder')}>⋮⋮</span>
      <button className="library-name" aria-pressed={preset.id === activeId} onClick={() => recall(preset.id)}><span data-i18n-skip>{preset.name}</span><small data-i18n-skip>{preset.updatedAt.slice(0, 10)}</small></button>
      <span className="library-move"><button aria-label={t('Move up')} title={t('Move up')} disabled={disabled || i === 0} onClick={() => move(i, i - 1)}>↑</button><button aria-label={t('Move down')} title={t('Move down')} disabled={disabled || i === presets.length - 1} onClick={() => move(i, i + 1)}>↓</button></span>
    </li>)}
  </ol>
}
