import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { buttonNames, buttonPosition, encoderNames, encoderPosition } from './panel-layout'
import { groups, controlIndex, type ControllerPreset } from './presets'

// Shared by the browser download and the Node visual-regression fixture.
export async function presetPdf(preset: ControllerPreset, fontBytes: Uint8Array) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(fontBytes, { subset: true })
  const supported = new Set(font.getCharacterSet())
  const safe = (s: string) => {
    const missing = Array.from(s).find(c => !supported.has(c.codePointAt(0)!))
    if (missing) throw new Error(`Character “${missing}” is not available in the PDF font; change this label for printing (JSON unchanged).`)
    return s
  }
  const black = rgb(.08, .08, .08), gray = rgb(.45, .45, .45)
  const size = [595.28, 841.89] as [number, number]
  let page = doc.addPage(size)
  const text = (s: string, x: number, top: number, fontSize = 9, color = black) => page.drawText(safe(s), { x, y: size[1] - top - fontSize, size: fontSize, font, color })
  const fit = (s: string, width: number, preferred: number, f: PDFFont = font) => Math.min(preferred, width / Math.max(1, f.widthOfTextAtSize(safe(s), 1)))
  const heading = (subtitle: string) => {
    text('BCR-32 Studio · ' + preset.name, 30, 25, fit('BCR-32 Studio · ' + preset.name, 535, 17))
    text(subtitle, 30, 55, 9, gray)
  }
  const footer = () => {
    text('Local labels and values · no hardware configuration sent.', 30, 789, 8, gray)
    text('Reduced A4 sheet · not a 1:1 overlay or a cutting template.', 30, 805, 8, gray)
  }
  heading('Reference front panel · controller mode · ' + preset.updatedAt.slice(0, 10))
  const scale = 535 / 1717, ox = 30, oy = 106
  const rect = (x: number, y: number, w: number, h: number) => page.drawRectangle({ x: ox + x * scale, y: size[1] - oy - (y + h) * scale, width: w * scale, height: h * scale, borderColor: gray, borderWidth: .5 })
  const label = (s: string, x: number, y: number, w: number, max = 7) => {
    const fs = fit(s, w * scale - 4, max)
    text(s, ox + x * scale + (w * scale - font.widthOfTextAtSize(safe(s), fs)) / 2, oy + y * scale, fs)
  }
  rect(0, 0, 1717, 1350)
  label('BCR32 · ' + preset.name, 100, 80, 1500, 13)
  preset.profile.buttons.slice(0, 20).forEach((b, i) => {
    const { x, y, width } = buttonPosition(i)
    rect(x, y, width, 55)
    label(preset.labels.buttons[i] || buttonNames[i], x, y + 18, width)
    label('B' + b.id, x, y - 36, width, 6)
  })
  preset.profile.encoders.forEach((e, i) => {
    const { x, y } = encoderPosition(e.id)
    page.drawCircle({ x: ox + x * scale, y: size[1] - oy - y * scale, size: 49 * scale, borderColor: gray, borderWidth: .6 })
    label(String(e.id), x - 60, y - 15, 120, 9)
    label(preset.labels.encoders[i] || encoderNames[i], x - 79, y + 75, 158)
    if (preset.labels.pushes[i]) label('P: ' + preset.labels.pushes[i], x - 79, y + 105, 158, 6)
    label(e.type === 'off' ? 'OFF' : e.type.toUpperCase() + ' ' + e.parameter + ' · CH' + e.channel, x - 79, y - 80, 158, 6)
  })
  label('SELECT', 1560, 630, 140, 7)
  for (const [i, s] of ['EDIT', 'EXIT', 'STORE', 'LD/LRN', 'TAP DEL', 'TAP WRT', 'INST', 'MIX', 'LOOP', 'PLAY'].entries()) {
    const x = i % 2 ? 1583 : 1422, y = [670, 792, 938, 1085, 1207][Math.floor(i / 2)]
    rect(x, y, 96, 55); label(i >= 6 ? preset.labels.buttons[20 + i - 6] || buttonNames[20 + i - 6] : s, x, y + 18, 96, 6)
  }
  text('Rotation: label below the circle. P: separate push label.', 30, 552, 9)
  text('The full assignments and values are on the following pages.', 30, 570, 9)
  text('32 pushes, 24 buttons and two footswitches programmable in CTRL mode.', 30, 592, 8, gray)
  text('Printed names are not sent to the BCR32.', 30, 610, 9)
  footer()
  for (const kinds of [[groups[0]], [groups[1], groups[2]]]) {
    page = doc.addPage(size)
    heading(kinds[0] === 'encoders' ? 'Assignments · rotations 1–32' : 'Assignments · pushes and programmable buttons')
    text('Control', 30, 90, 8); text('Label', 100, 90, 8); text('Assignment / mode', 280, 90, 8); text('Range', 460, 90, 8); text('Value', 530, 90, 8)
    let y = 111
    for (const kind of kinds) for (const e of preset.profile[kind]) {
      const i = controlIndex(kind, e.id)
      const prefix = kind === 'encoders' ? 'Enc' : kind === 'pushes' ? 'Push' : 'BTN'
      const name = preset.labels[kind][i] || (kind === 'encoders' ? encoderNames[i] : kind === 'buttons' ? buttonNames[i] : '—')
      text(prefix + ' ' + e.id, 30, y, 8)
      text(name, 100, y, fit(name, 170, 8))
      const assignment = e.type.toUpperCase() + (e.type === 'off' ? '' : ` ${e.parameter} / CH${e.channel} / ${e.mode}`)
      text(assignment, 280, y, fit(assignment, 170, 8))
      text(`${e.minimum}–${e.maximum}`, 460, y, 8)
      text(String(preset.values[kind][i] ?? '—'), 530, y, 8)
      y += 10.8
    }
    footer()
  }
  doc.setTitle('BCR32 · ' + preset.name)
  doc.setSubject('Controller reference sheet, reduced A4 scale')
  return doc.save()
}
