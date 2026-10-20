import { glyphs, dotText } from './OledDisplay'
import { modeText } from './oled-model'
import type { Encoder } from './profile'
import type { Selection } from './FrontPanel'

// The label screen and the OLED drawn on a canvas, for the floating display (a picture-in-picture video of this
// canvas: a bare window with only the screens, like a video player's mini-player). Same dot matrix and layout as the
// SVG screens of src/OledDisplay.tsx; colours of the five screen styles of src/styles.css ([data-display]).
export type ScreenText = { label: string; kind: string; id: number; parameter: string; value: string; channel: string; origin: string; blank: boolean }
export const screenColors: Record<string, { ink: string; glow: string; meta: string; bg: string }> = {
  ice: { ink: '#e9faff', glow: '#62b7e8', meta: '#80aec7', bg: '#000000' },
  amber: { ink: '#ffbf5a', glow: '#ff8a00', meta: '#c48a3c', bg: '#0a0602' },
  green: { ink: '#17240a', glow: 'transparent', meta: '#2d4214', bg: '#93b33a' },
  red: { ink: '#ff5442', glow: '#ff1a00', meta: '#b04a40', bg: '#060000' },
  white: { ink: '#ffffff', glow: '#9a9a9a', meta: '#a3a3a3', bg: '#000000' },
}
// What the OLED shows for a control (the dot-matrix text of OledDisplay).
export function screenText(control: Selection, config: Encoder, value: number | null, source: 'local' | 'midi' | 'relative', label: string): ScreenText {
  return {
    label, kind: control.kind === 'encoders' ? 'ENC' : control.kind === 'pushes' ? 'PUSH' : 'BTN', id: control.id,
    parameter: config.type === 'off' || config.parameterOff ? 'OFF' : `${config.type.toUpperCase()} ${config.parameter}:${modeText[config.mode]}`,
    value: value === null ? '--' : String(value), channel: `CH ${config.channel}`,
    origin: value === null ? 'UNKNOWN' : source === 'relative' ? 'EST' : source === 'midi' ? 'MIDI' : 'LOCAL', blank: config.display === false,
  }
}
export const canvasSize = { width: 640, height: 488 }

// Dots of `text` (already dotText-normalised) from (x, y), `size` units per dot, right-aligned at x when `right`.
function dots(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, right = false) {
  const start = right ? x - (text.length * 6 - 1) * size : x
  Array.from(text).forEach((c, i) => (glyphs[c] || '').split('/').forEach((row, j) => Array.from(row).forEach((v, k) => {
    if (v === '1') ctx.fillRect(start + (i * 6 + k) * size, y + j * size, size * 0.84, size * 0.84)
  })))
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill()
}
export function drawScreens(ctx: CanvasRenderingContext2D, s: ScreenText, style: string) {
  const c = screenColors[style] ?? screenColors.ice, { width: W, height: H } = canvasSize
  ctx.save(); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, W, H)
  const pad = 14, labelH = Math.round((W - 2 * pad) * 49 / 192 * 0.62), oledY = pad * 2 + labelH, oledH = H - oledY - pad
  panel(ctx, pad, pad, W - 2 * pad, labelH, c.bg); panel(ctx, pad, oledY, W - 2 * pad, oledH, c.bg)
  if (!s.blank) {
    ctx.shadowColor = c.glow; ctx.shadowBlur = c.glow === 'transparent' ? 0 : 6
    // Label screen: one centred line, as large as it fits.
    const label = dotText(s.label), lsize = Math.min(7, (W - 2 * pad - 40) / (Math.max(label.length, 1) * 6))
    ctx.fillStyle = c.ink; dots(ctx, label, W / 2 - (label.length * 6 - 1) * lsize / 2, pad + labelH / 2 - 3.5 * lsize, lsize)
    // OLED: the 280 x 112 layout of OledDisplay, scaled into its panel.
    const sx = (W - 2 * pad) * 0.94 / 280, sy = oledH * 0.9 / 112, ox = pad + (W - 2 * pad) * 0.03, oy = oledY + oledH * 0.05
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sx, sy)
    const param = dotText(s.parameter), value = dotText(s.value)
    dots(ctx, s.kind, 15, 10, 2.2); dots(ctx, String(s.id), 24, 37, 5.3)
    dots(ctx, param, 265, 10, Math.min(2.2, 172 / (Math.max(param.length, 1) * 6)), true)
    dots(ctx, value, 265, 37, Math.min(5.3, 140 / (Math.max(value.length, 1) * 6)), true)
    ctx.fillStyle = c.meta; ctx.shadowBlur = 0; dots(ctx, dotText(s.channel), 15, 94, 1.4); dots(ctx, dotText(s.origin), 265, 94, 1.4, true)
    ctx.restore()
  }
  ctx.restore()
}
