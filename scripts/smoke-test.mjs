#!/usr/bin/env node
// Post-deploy smoke test: both HTML entries and the built editor bundle answer; the distribution manifest
// carries package.json's version. Usage: node scripts/smoke-test.mjs <site-root-url>
import { readFileSync } from 'node:fs'
const url = process.argv[2]
if (!url) { console.error('Usage: node scripts/smoke-test.mjs <url>'); process.exit(2) }
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const fail = message => { console.error(`FAIL ${url}: ${message}`); process.exit(1) }
let html = '', bundle = '', servedVersion = ''
for (let attempt = 1; attempt <= 6; attempt++) { // the edge may serve the previous index.html for a few seconds
  const page = await fetch(url, { redirect: 'follow' })
  if (!page.ok) fail(`HTTP ${page.status}`)
  html = await page.text()
  // Both MPA entries must work, including project-subpath deployments.
  if (!html.includes('data-i18n="doc_title"')) fail('presentation page missing')
  const editorUrl = new URL('editor/', page.url.endsWith('/') ? page.url : page.url.replace(/index\.html(?:\?.*)?$/, ''))
  const editor = await fetch(editorUrl)
  if (!editor.ok) fail(`editor HTTP ${editor.status}`)
  const editorHtml = await editor.text()
  const script = /<script[^>]+src="([^"]*assets\/editor-[\w-]+\.js)"/.exec(editorHtml)?.[1]
  if (!script) fail('no editor bundle referenced by editor/index.html')
  const response=await fetch(new URL(script, editor.url))
  if(!response.ok)fail(`editor bundle HTTP ${response.status}`)
  bundle = await response.text()
  const manifest=await fetch(new URL('midi-studio-build.json',page.url))
  if(!manifest.ok)fail('distribution manifest unavailable')
  servedVersion=(await manifest.json()).applicationVersion
  if (servedVersion===version && bundle.length>0) break
  await new Promise(resolve => setTimeout(resolve, 5000))
}
if (servedVersion!==version || !bundle.length) fail(`the served distribution does not match version ${version}`)
console.log(`PASS ${url}: version ${version} served`)
