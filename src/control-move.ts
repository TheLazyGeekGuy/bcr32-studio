import { createEncoder, type Bcr32Profile, type Encoder } from './profile'
import { controlIndex, type VisualLabels } from './presets'
import type { DeviceDefinition } from './device-definition'
import type { DragEvent } from 'react'

// Rearranging controls on the panel by drag and drop: drop on the middle of a control to swap the two, on its left or
// right edge to insert before or after it (the controls in between shift by one), with Alt (Option) to copy. An encoder
// moves with its push and its labels; what the target cannot hold (no push, a ring mode its LEDs do not show) is
// reported, not silently changed.
export type MoveMode = 'swap' | 'before' | 'after' | 'copy'
export type MoveKind = 'encoders' | 'buttons'
type Unit = { main: Encoder; push: Encoder | null; label: string; pushLabel: string }

export function moveControl(profile: Bcr32Profile, labels: VisualLabels, device: DeviceDefinition, kind: MoveKind, from: number, to: number, mode: MoveMode): { profile: Bcr32Profile; labels: VisualLabels; notes: string[] } {
  if (from === to) return { profile, labels, notes: [] }
  const ids = profile[kind].map(e => e.id), notes: string[] = []
  if (!ids.includes(from) || !ids.includes(to)) return { profile, labels, notes: [] }
  const hasPush = (id: number) => kind === 'encoders' && profile.pushes.some(p => p.id === id)
  const unit = (id: number): Unit => ({
    main: profile[kind].find(e => e.id === id)!, push: hasPush(id) ? profile.pushes.find(p => p.id === id)! : null,
    label: labels[kind][controlIndex(kind, id, device)] ?? '', pushLabel: hasPush(id) ? labels.pushes[controlIndex('pushes', id, device)] ?? '' : '',
  })
  // Target id -> unit placed there.
  const placed = new Map<number, Unit>()
  if (mode === 'copy') placed.set(to, unit(from))
  else if (mode === 'swap') { placed.set(to, unit(from)); placed.set(from, unit(to)) }
  else {
    const order = ids.filter(id => id !== from), at = order.indexOf(to) + (mode === 'after' ? 1 : 0)
    order.splice(at, 0, from)
    // Only the ids between the two positions change.
    const lo = Math.min(ids.indexOf(from), at), hi = Math.max(ids.indexOf(from), at)
    for (let i = lo; i <= hi; i++) if (order[i] !== ids[i]) placed.set(ids[i], unit(order[i]))
  }
  if (!placed.size) return { profile, labels, notes: [] } // dropped where it already is
  const nextProfile: Bcr32Profile = { ...profile, [kind]: profile[kind].map(e => e) }, nextLabels: VisualLabels = { encoders: [...labels.encoders], pushes: [...labels.pushes], buttons: [...labels.buttons] }
  if (kind === 'encoders') nextProfile.pushes = profile.pushes.map(p => p)
  const name = (id: number) => `${kind === 'encoders' ? 'Encoder' : 'Button'} ${id}`
  for (const [id, u] of placed) {
    const main: Encoder = { ...u.main, id }
    const allowed = kind === 'encoders' ? device.ringModes?.(id) : undefined
    if (allowed && main.ledMode && !allowed.includes(main.ledMode)) { notes.push(`${name(id)}: LED ring ${main.ledMode} not shown there, set to 1dot`); main.ledMode = '1dot_in' }
    nextProfile[kind] = nextProfile[kind].map(e => e.id === id ? main : e)
    nextLabels[kind][controlIndex(kind, id, device)] = u.label
    if (kind === 'encoders') {
      if (hasPush(id)) {
        nextProfile.pushes = nextProfile.pushes.map(p => p.id === id ? { ...(u.push ?? { ...createEncoder(id), mode: 'momentary' }), id } : p)
        nextLabels.pushes[controlIndex('pushes', id, device)] = u.pushLabel
      } else if (u.push && u.push.type !== 'off') notes.push(`${name(id)} has no push: the push assignment of ${name(u.main.id)} was not carried`)
    }
  }
  return { profile: nextProfile, labels: nextLabels, notes }
}

// Drag-and-drop wiring shared by the panels: the drop zone (edges insert, middle swaps, Alt copies) is shown with CSS
// classes on the control under the pointer; nothing in React state changes until the drop.
let dragging: { kind: MoveKind; id: number } | null = null
const zone = (event: DragEvent<HTMLElement>): MoveMode => {
  if (event.altKey) return 'copy'
  const r = event.currentTarget.getBoundingClientRect(), x = (event.clientX - r.left) / Math.max(1, r.width)
  return x < 0.3 ? 'before' : x > 0.7 ? 'after' : 'swap'
}
const clearZone = (el: HTMLElement) => el.classList.remove('drop-swap', 'drop-before', 'drop-after', 'drop-copy')
export function dragMoveProps(kind: MoveKind, id: number, move: (kind: MoveKind, from: number, to: number, mode: MoveMode) => void) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => { dragging = { kind, id }; event.dataTransfer.effectAllowed = 'copyMove'; try { event.dataTransfer.setData('text/plain', `${kind}:${id}`) } catch { /* Optional. */ } },
    onDragEnd: () => { dragging = null },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!dragging || dragging.kind !== kind || dragging.id === id) return
      event.preventDefault(); const m = zone(event); clearZone(event.currentTarget); event.currentTarget.classList.add(`drop-${m}`)
      event.dataTransfer.dropEffect = m === 'copy' ? 'copy' : 'move'
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => clearZone(event.currentTarget),
    onDrop: (event: DragEvent<HTMLElement>) => {
      clearZone(event.currentTarget)
      if (!dragging || dragging.kind !== kind || dragging.id === id) return
      event.preventDefault(); const from = dragging.id; dragging = null; move(kind, from, id, zone(event))
    },
  }
}
