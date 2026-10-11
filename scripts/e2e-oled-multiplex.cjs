#!/usr/bin/env node
// End-to-end check of the OLED multiplexing (display arbiter) on a served build: a fake Web MIDI input named "BCR-32 SIM" is
// injected before the app loads, two encoders are streamed, and the OLED is sampled at every animation frame.
// Nothing reaches a real device: requestMIDIAccess is replaced in the page. Not part of `npm test` (needs a browser).
// Usage: PLAYWRIGHT_CORE=/path/to/playwright-core node scripts/e2e-oled-multiplex.cjs [url]   (default http://127.0.0.1:5173/)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const url = process.argv[2] ?? 'http://127.0.0.1:5173/'

function fakeMidi() {
  const input = { id: 'sim-in', name: 'BCR-32 SIM', manufacturer: 'sim', state: 'connected', type: 'input', onmidimessage: null }
  const output = { id: 'sim-out', name: 'BCR-32 SIM', manufacturer: 'sim', state: 'connected', type: 'output', onmidimessage: null, send() {} }
  const access = { sysexEnabled: true, inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), onstatechange: null }
  Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => access, configurable: true })
  window.__sim = input
}
// Encoder 1 = CC 1, encoder 2 = CC 2 (channel 1, absolute), in the draft and the profile, once per session, before the app runs.
function seedProfile() {
  if (sessionStorage.getItem('e2e-seeded')) return
  const seed = p => {
    for (const list of Object.values(p)) if (Array.isArray(list)) for (const c of list) if (c && c.type === 'cc' && (c.parameter === 1 || c.parameter === 2)) c.type = 'off'
    p.encoders[0] = { ...p.encoders[0], type: 'cc', channel: 1, parameter: 1, minimum: 0, maximum: 127, mode: 'absolute' }
    p.encoders[1] = { ...p.encoders[1], type: 'cc', channel: 1, parameter: 2, minimum: 0, maximum: 127, mode: 'absolute' }
    return p
  }
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('bcr32-studio.')) continue
    try {
      const v = JSON.parse(localStorage.getItem(key))
      if (v?.encoders) localStorage.setItem(key, JSON.stringify(seed(v)))
      else if (v?.profile?.encoders) { v.profile = seed(v.profile); localStorage.setItem(key, JSON.stringify(v)) }
    } catch { /* not JSON */ }
  }
  sessionStorage.setItem('e2e-seeded', '1')
}
async function stream(page, periodA, periodB) {
  return page.evaluate(async ({ periodA, periodB }) => {
    const input = window.__sim, frames = []; let a = 0, b = 64, stop = false
    const t0 = performance.now()
    const frame = () => {
      frames.push({ t: performance.now() - t0, oled: document.querySelector('.oled-display')?.dataset.control ?? '', h2: document.querySelector('.inspector h2')?.textContent ?? '', strip: document.querySelectorAll('.activity-strip button').length })
      if (!stop) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    const ia = setInterval(() => { a = (a + 1) % 128; input.onmidimessage({ data: new Uint8Array([0xb0, 1, a]) }) }, periodA)
    const ib = setInterval(() => { b = (b + 1) % 128; input.onmidimessage({ data: new Uint8Array([0xb0, 2, b]) }) }, periodB)
    await new Promise(r => setTimeout(r, 4000)); clearInterval(ia); clearInterval(ib)
    await new Promise(r => setTimeout(r, 2000)); stop = true
    const during = frames.filter(f => f.t > 600 && f.t <= 4000)
    const runs = []
    for (const f of during) { const last = runs.at(-1); if (last && last.oled === f.oled) last.end = f.t; else runs.push({ oled: f.oled, start: f.t, end: f.t }) }
    const inner = runs.slice(1, -1).map(r => Math.round(r.end - r.start)).sort((x, y) => x - y)
    const time = {}; for (const r of runs) time[r.oled] = (time[r.oled] ?? 0) + (r.end - r.start)
    const total = Object.values(time).reduce((s, x) => s + x, 0)
    return { views: runs.length, shortestViewMs: inner[0] ?? null, share: Object.fromEntries(Object.entries(time).map(([k, v]) => [k, Math.round(100 * v / total)])), inspectorChanges: during.filter((f, i) => i > 0 && f.h2 !== during[i - 1].h2).length, stripRowsMax: Math.max(...during.map(f => f.strip)), stripAfterHold: frames.at(-1).strip }
  }, { periodA, periodB })
}
;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  let page = await context.newPage()
  await page.addInitScript(fakeMidi)
  await page.goto(url); await page.waitForTimeout(1500) // first load creates the draft
  await page.close(); page = await context.newPage()
  await page.addInitScript(fakeMidi); await page.addInitScript(seedProfile)
  await page.goto(url); await page.waitForTimeout(1500)
  const version = await page.evaluate(() => document.querySelector('.studio-version')?.textContent)
  const failures = []
  const check = (ok, what) => { if (!ok) failures.push(what) }
  for (const [name, periodA, periodB, expectedA] of [['1:1 (20 ms each)', 20, 20, 50], ['3:1 (A 13 ms, B 40 ms)', 13, 40, 75]]) {
    const r = await stream(page, periodA, periodB)
    console.log(`${name}: ${JSON.stringify(r)}`)
    check((r.share['1'] ?? 0) >= expectedA - 15 && (r.share['1'] ?? 0) <= expectedA + 15, `${name}: encoder 1 shown ${r.share['1'] ?? 0} %, expected about ${expectedA} %`)
    check(r.views >= 4, `${name}: the screen does not alternate (${r.views} views)`)
    check(r.shortestViewMs === null || r.shortestViewMs >= 250, `${name}: a view lasts only ${r.shortestViewMs} ms`)
    check(r.inspectorChanges === 0, `${name}: the inspector changed ${r.inspectorChanges} times while two encoders alternate`)
    check(r.stripRowsMax === 2, `${name}: activity strip showed ${r.stripRowsMax} rows, expected 2`)
    check(r.stripAfterHold === 0, `${name}: activity strip still visible after the hold`)
  }
  await browser.close()
  console.log(`${url} ${version}: ${failures.length ? 'FAIL\n- ' + failures.join('\n- ') : 'PASS'}`)
  process.exitCode = failures.length ? 1 : 0
})().catch(error => { console.error(error); process.exitCode = 2 })
