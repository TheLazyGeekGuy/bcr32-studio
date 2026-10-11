import { useState } from 'react'
import { estimateResolution } from './rotation'

export function RotationEstimate({ minimum, maximum, collapsed = false }: { minimum: number; maximum: number; collapsed?: boolean }) {
  const [resolution, setResolution] = useState(127 / 8)
  const result = estimateResolution(minimum, maximum, resolution)
  const format = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return <details className="rotation-estimate" open={!collapsed}>
    <summary>Turns for {minimum}–{maximum} · estimate</summary>
    <output aria-live="polite">{result ? `${format(result.turns)} turns` : 'Invalid assumptions'}</output>
    <label>MIDI increments per turn<input type="number" min="0.001" max="65535" step="0.125" value={resolution} onChange={e => setResolution(Number(e.target.value))} /></label>
    <div className="resolution-presets"><button onClick={() => setResolution((maximum - minimum) / 8 || 127 / 8)}>≈ 8 turns · assumption</button><button onClick={() => setResolution(24)}>24 incr./turn</button><button onClick={() => setResolution(32)}>32 incr./turn</button><button onClick={() => setResolution(96)}>96 · BCR2000 reference</button></div>
    {result && <p className="surface-help">{result.steps} increments · 21 LEDs / {result.ledIntervals} intervals · {format(result.stepsPerLed)} increments per LED interval on average.</p>}
    <p className="surface-help">Starting point: about 8 turns reported for 0–127, unconfirmed. The LED arc is not the mechanical travel. BCR32 physical detents and acceleration not measured. No hardware setting changed.</p>
    <p className="surface-help"><a href="https://mountainutilities.eu/forums/questions-regarding-nrpn-format" target="_blank" rel="noreferrer">BCR2000 reference: 96 positions and standard resolution 96</a>. This does not prove the BCR32 resolution.</p>
  </details>
}
