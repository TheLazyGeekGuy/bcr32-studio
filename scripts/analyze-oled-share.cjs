#!/usr/bin/env node
// Analyses a millisecond-timestamped `npm run midi -- monitor` log: share of pulses per CC (channel + number) over
// one-second windows (or --window <ms>), i.e. the share a hardware screen that follows the pulses would give each control.
// Read-only, opens no MIDI port. Usage: node scripts/analyze-oled-share.cjs <monitor.log> [--window 1000]
const { readFileSync } = require('node:fs')

function parseLog(text) {
  const events = []
  for (const line of text.split('\n')) {
    const m = /^\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\] ← ([0-9A-Fa-f]{2}) ([0-9A-Fa-f]{2}) ([0-9A-Fa-f]{2})\b/.exec(line)
    if (!m) continue
    const status = parseInt(m[5], 16)
    if ((status & 0xf0) !== 0xb0) continue
    const ms = Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + (m[4] === undefined ? 0 : Number(m[4].padEnd(3, '0')))
    events.push({ ms, key: `ch${(status & 15) + 1} CC${parseInt(m[6], 16)}`, millis: m[4] !== undefined })
  }
  return events
}

function shares(events, windowMs) {
  if (!events.length) return []
  const start = events[0].ms, buckets = new Map()
  for (const e of events) {
    const index = Math.floor((e.ms - start) / windowMs)
    const bucket = buckets.get(index) ?? new Map()
    bucket.set(e.key, (bucket.get(e.key) ?? 0) + 1)
    buckets.set(index, bucket)
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([index, bucket]) => {
    const total = [...bucket.values()].reduce((a, b) => a + b, 0)
    return { from: start + index * windowMs, total, parts: [...bucket.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, share: count / total })) }
  })
}

function main(argv) {
  const file = argv.find(a => !a.startsWith('--'))
  if (!file) { console.error('Usage: node scripts/analyze-oled-share.cjs <monitor.log> [--window ms]'); return 2 }
  const w = argv.indexOf('--window'), windowMs = w >= 0 ? Number(argv[w + 1]) : 1000
  if (!Number.isInteger(windowMs) || windowMs <= 0) { console.error('--window: positive integer in milliseconds'); return 2 }
  const events = parseLog(readFileSync(file, 'utf8'))
  if (!events.length) { console.log('No timestamped CC message in this log.'); return 1 }
  if (!events.every(e => e.millis)) console.log('Warning: some lines are timestamped to the second only; shares are reliable to the second only.')
  const clock = ms => { const d = new Date(ms); return `${String(Math.floor(ms / 3_600_000) % 24).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(d.getUTCMilliseconds()).padStart(3, '0')}` }
  console.log(`${events.length} CC messages, ${windowMs} ms window. Share of pulses per CC (assumption: the hardware screen would show roughly these shares):`)
  for (const row of shares(events, windowMs)) console.log(`${clock(row.from)}  ${String(row.total).padStart(4)} msg  ${row.parts.map(p => `${p.key} ${String(Math.round(p.share * 100)).padStart(3)} % (${p.count})`).join('  ')}`)
  return 0
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))
module.exports = { parseLog, shares }
