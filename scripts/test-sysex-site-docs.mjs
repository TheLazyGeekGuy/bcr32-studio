import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {sysexDocsPlugin} from '../build/sysex-docs.mjs'
const emitted=new Map()
await sysexDocsPlugin().generateBundle.call({emitFile:asset=>{assert.ok(!emitted.has(asset.fileName));emitted.set(asset.fileName,asset.source)}})
for(const name of ['index.html','architecture.html','integration.html','catalogue.html','schema.json','tx81z.sxm.json','microwave.sxm.json','reference-renderer.py','sysex-map.mjs'])assert.ok(emitted.has('docs/sysex-map/'+name))
const spec=String(emitted.get('docs/sysex-map/index.html'))
assert.match(spec,/<h1>SysEx Map/);assert.match(spec,/script-src 'none'/);assert.match(spec,/href="schema.json" download/)
assert.match(spec,/not an adopted MIDI Association standard/)
for(const [file,source] of emitted)if(file.endsWith('.html')){
 assert.ok(!/<script\b/i.test(String(source)),'documentation has no MIDI/bootstrap script')
 for(const [,href] of String(source).matchAll(/href="([^"]+)"/g)){
  if(/^(https?:|#)/.test(href)||href.startsWith('../../'))continue
  const target=href==='./'?'index.html':href.split('#')[0]
  if(target)assert.ok(emitted.has('docs/sysex-map/'+target),`${file}: missing internal link ${href}`)
 }
}
assert.equal(JSON.parse(emitted.get('docs/sysex-map/schema.json')).$id,'urn:sysex-map:schema:1.0')
assert.match(readFileSync('index.html','utf8'),/href="\.\/docs\/sysex-map\/"/)
assert.match(readFileSync('build/offline.mts','utf8'),/startsWith\('docs\/sysex-map\/'\)/)
console.log('PASS SXM site docs: canonical Markdown rendered, four linked pages, schema/examples/Python/standalone SDK downloads, no MIDI scripts, internal link integrity and offline inventory')
