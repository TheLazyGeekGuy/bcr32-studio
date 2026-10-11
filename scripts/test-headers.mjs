import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
// public/_headers and public/.assetsignore are applied by wrangler at deploy time, never by vite dev/preview,
// so nothing else in the suite would notice a broken rule or an app asset excluded from the upload.
const root = fileURLToPath(new URL('..', import.meta.url)), pub = join(root, 'public')
const lines = readFileSync(join(pub, '_headers'), 'utf8').split('\n')
// Same grammar as the Workers static-assets parser: blank and '#' lines skipped, a rule starts at '/', a header splits on the first ':'.
const rules = []
for (const raw of lines) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  assert.ok(raw.length < 2000, 'Header line under the 2000-character limit')
  if (line.startsWith('/')) { rules.push({ path: line, headers: {} }); continue }
  const colon = line.indexOf(':'); assert.ok(colon > 0 && rules.length, 'Header line belongs to a rule: ' + line)
  rules.at(-1).headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
}
assert.ok(rules.length >= 1 && rules.length < 100); assert.equal(rules[0].path, '/*')
const h = rules[0].headers
assert.equal(h['X-Frame-Options'], 'DENY'); assert.equal(h['X-Content-Type-Options'], 'nosniff'); assert.equal(h['Permissions-Policy'], 'midi=(self)')
const csp = Object.fromEntries(h['Content-Security-Policy'].split(';').map(d => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]))
assert.deepEqual(csp['frame-ancestors'], ["'none'"]); assert.deepEqual(csp['object-src'], ["'none'"]); assert.deepEqual(csp['default-src'], ["'self'"])
assert.deepEqual(csp['script-src'], ["'self'"], 'No inline script, no eval')
assert.ok(csp['img-src'].includes("'self'") && csp['img-src'].includes('blob:'), 'Images: own assets and client-generated blobs')
assert.deepEqual(csp['connect-src'], ["'self'"], 'The PDF font is fetched from the origin')
// Every asset path the app references must exist under public/ and must not be excluded from the upload.
// .assetsignore only drops build by-products (*.map, .DS_Store): every shipped public file is uploaded.
const ignored = readFileSync(join(pub, '.assetsignore'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
assert.deepEqual([...ignored].sort(), ['*.map', '.DS_Store'].sort(), 'Only source maps and Finder metadata are excluded from the upload')
const excluded = path => ignored.some(pattern => pattern.startsWith('*') ? path.endsWith(pattern.slice(1)) : pattern === path || path.endsWith('/' + pattern))
const shipped = []
const walk = dir => { for (const entry of readdirSync(join(pub, dir), { withFileTypes: true })) { const path = dir ? `${dir}/${entry.name}` : entry.name; if (entry.isDirectory()) walk(path); else if (!['_headers', '.assetsignore'].includes(path)) shipped.push(path) } }
walk('')
for (const path of shipped) assert.ok(!excluded(path), 'Shipped public file excluded from upload: ' + path)
const src = join(root, 'src'), referenced = new Set()
for (const file of readdirSync(src).filter(f => /\.(tsx?|css)$/.test(f))) for (const m of readFileSync(join(src, file), 'utf8').matchAll(/['"`(]\/((?:[\w-]+\/)*[\w.-]+\.(?:webp|png|jpe?g|svg|ttf|woff2?))['"`)]/g)) referenced.add(m[1])
assert.deepEqual([...referenced].sort(), ['branding/bcr32-studio-logo.webp', 'fonts/NotoSans-Regular.ttf'], 'App asset files: the logo and the PDF font, nothing else')
for (const path of referenced) { assert.ok(existsSync(join(pub, path)), 'Missing public asset: ' + path); assert.ok(!excluded(path), 'App asset excluded from upload: ' + path) }
// The panel plate is procedural CSS: its only image is an inline SVG data: URI, which the CSP allows through img-src data:.
assert.ok(csp['img-src'].includes('data:'), 'img-src allows the inline SVG grain of the panel plate')
console.log(`PASS: _headers parsed like wrangler (CSP frame-ancestors none, X-Frame-Options DENY), ${referenced.size} app assets present and uploadable, ${shipped.length} public files shipped, only *.map and .DS_Store ignored`)
