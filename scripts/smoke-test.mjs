#!/usr/bin/env node
// Post-deploy smoke test: the page answers, references a built bundle, and that bundle carries the version of
// package.json. Usage: node scripts/smoke-test.mjs <url>
import { readFileSync } from 'node:fs'
const url = process.argv[2]
if (!url) { console.error('Usage: node scripts/smoke-test.mjs <url>'); process.exit(2) }
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const fail = message => { console.error(`FAIL ${url}: ${message}`); process.exit(1) }
let html = '', bundle = ''
for (let attempt = 1; attempt <= 6; attempt++) { // the edge may serve the previous index.html for a few seconds
  const page = await fetch(url, { redirect: 'follow' })
  if (!page.ok) fail(`HTTP ${page.status}`)
  html = await page.text()
  const script = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0]
  if (!script) fail('no bundle referenced by index.html')
  bundle = await (await fetch(new URL(script, url))).text()
  if (bundle.includes(version)) break
  await new Promise(resolve => setTimeout(resolve, 5000))
}
if (!bundle.includes(version)) fail(`the served bundle does not contain version ${version}`)
console.log(`PASS ${url}: version ${version} served`)
