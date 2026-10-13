#!/usr/bin/env node
// Manual end-to-end check of the floating display (Document Picture-in-Picture) with a fake Web MIDI input:
// opens the floating window, streams two encoders (3:1) from a timer of the floating window (like real MIDI events,
// which are not throttled), samples the floating OLED, first with the app's tab visible, then hidden behind another tab.
// Needs a headed Chromium. Usage: PLAYWRIGHT_CORE=/path/to/playwright-core node scripts/e2e-floating-display.cjs [url]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
function fakeMidi() {
  const input = { id: 'sim-in', name: 'BCR-32 SIM', state: 'connected', type: 'input', onmidimessage: null }
  const output = { id: 'sim-out', name: 'BCR-32 SIM', state: 'connected', type: 'output', onmidimessage: null, send() {} }
  Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => ({ sysexEnabled: false, inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), onstatechange: null }), configurable: true })
  window.__sim = input
}
function seed() {
  if (sessionStorage.getItem('e2e-seeded')) return
  const fix = p => { p.encoders[0] = { ...p.encoders[0], type: 'cc', channel: 1, parameter: 1, minimum: 0, maximum: 127, mode: 'absolute' }; p.encoders[1] = { ...p.encoders[1], type: 'cc', channel: 1, parameter: 2, minimum: 0, maximum: 127, mode: 'absolute' }; return p }
  for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v?.encoders) localStorage.setItem(k, JSON.stringify(fix(v))); else if (v?.profile?.encoders) { v.profile = fix(v.profile); localStorage.setItem(k, JSON.stringify(v)) } } catch {} }
  localStorage.setItem('bcr32-studio.language.v1', 'en'); sessionStorage.setItem('e2e-seeded', '1')
}
const measure = page => page.evaluate(async () => {
  const pip = documentPictureInPicture.window, input = window.__sim, samples = []; let a = 0, b = 64, n = 0
  const t0 = performance.now()
  const sampler = pip.setInterval(() => samples.push({ t: performance.now() - t0, c: pip.document.querySelector('.oled-display')?.dataset.control }), 20)
  await new Promise(res => { const iv = pip.setInterval(() => { n++; if (n % 4 === 3) input.onmidimessage({ data: new Uint8Array([0xb0, 2, b = (b + 1) % 128]) }); else input.onmidimessage({ data: new Uint8Array([0xb0, 1, a = (a + 1) % 128]) }); if (performance.now() - t0 > 4000) { pip.clearInterval(iv); res() } }, 10) })
  pip.clearInterval(sampler)
  const during = samples.filter(s => s.t > 600), runs = []
  for (const s of during) { const l = runs.at(-1); if (l && l.c === s.c) l.end = s.t; else runs.push({ c: s.c, start: s.t, end: s.t }) }
  const time = {}; for (const r of runs) time[r.c] = (time[r.c] ?? 0) + (r.end - r.start)
  const total = Object.values(time).reduce((x, y) => x + y, 0)
  return { visibility: document.visibilityState, samples: during.length, views: runs.length, share1: Math.round(100 * (time['1'] ?? 0) / total) }
})
;(async () => {
  // Restore Chrome's normal background throttling (Playwright disables it by default, which would hide the problem).
  const browser = await chromium.launch({ headless: false, ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] })
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'en-US' })
  let page = await context.newPage(); await page.addInitScript(fakeMidi); await page.goto(url); await page.waitForTimeout(1200); await page.close()
  page = await context.newPage(); await page.addInitScript(fakeMidi); await page.addInitScript(seed); await page.goto(url); await page.waitForTimeout(1500)
  if (!(await page.evaluate(() => 'documentPictureInPicture' in window))) { console.log('Document Picture-in-Picture not available in this Chromium'); await browser.close(); process.exitCode = 2; return }
  await page.getByRole('button', { name: 'Floating display' }).click(); await page.waitForTimeout(800)
  console.log('floating window open:', await page.evaluate(() => !!documentPictureInPicture.window && !!documentPictureInPicture.window.document.querySelector('.oled-display')))
  const visible = await measure(page); console.log('main visible  :', JSON.stringify(visible))
  // Hide the app's tab behind another tab: a hidden page is what Chrome throttles (1 tick per second measured).
  const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.waitForTimeout(12000)
  const control = await page.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise(res => { const iv = setInterval(() => { n++; if (performance.now() - t0 > 3000) { clearInterval(iv); res() } }, 20) }); return { visibility: document.visibilityState, mainTimerTicksIn3s: n } })
  console.log('main tab hidden, its own timers:', JSON.stringify(control))
  const minimised = await measure(page); console.log('main tab hidden, floating display:', JSON.stringify(minimised))
  await browser.close()
  const ok = minimised.views >= 4 && minimised.share1 >= 60 && minimised.share1 <= 95
  console.log(ok ? 'PASS: the floating display keeps alternating while the app tab is hidden' : 'FAIL: the floating display does not keep up while the app tab is hidden')
  process.exitCode = ok ? 0 : 1
})().catch(error => { console.error(error); process.exitCode = 2 })
