import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const root = new URL('../', import.meta.url).pathname
const css = readFileSync(root + 'src/styles.css', 'utf8')
const displayStyle = css.match(/\.oled-display\s*\{([^}]+)\}/)?.[1] ?? ''
assert.match(displayStyle, /background:#000;/)
assert.doesNotMatch(displayStyle, /url\(/, 'OLED bezel is drawn by CSS, no image')
mkdirSync(root + 'output/oled-test', { recursive: true })
await build({ entryPoints: [root + 'src/oled-model.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: root + 'output/oled-test/model.cjs' })
const require = createRequire(import.meta.url)
const { controlForCC, controlForChanges, modeText } = require(root + 'output/oled-test/model.cjs')
const e = { id: 1, type: 'cc', channel: 1, parameter: 16, mode: 'absolute' }
const p = { encoders: [e, { ...e, id: 2, parameter: 11 }] }
assert.deepEqual(controlForCC(p, {kind:'encoders',id:2}, [176,16,69]), {kind:'encoders',id:1})
assert.deepEqual(controlForCC(p, {kind:'encoders',id:1}, [176,11,127]), {kind:'encoders',id:2})
for (const bytes of [[177,16,69],[176,12,69],[144,16,69],[176,16,128],[176,16,-1],[176,16],[176,16,NaN]]) assert.equal(controlForCC(p,{kind:'encoders',id:1},bytes),null)
const duplicate = { encoders:[e,{...e,id:2}] }
assert.deepEqual(controlForCC(duplicate,{kind:'encoders',id:2},[176,16,69]),{kind:'encoders',id:2})
assert.equal(controlForCC(duplicate,{kind:'buttons',id:5},[176,16,69]),null)
assert.deepEqual(controlForCC({encoders:[{...e,mode:'rel2'}]},{kind:'encoders',id:1},[176,16,65]),{kind:'encoders',id:1})
assert.equal(modeText.absolute,'ABS')
assert.equal(modeText.abs_14,'ABS_14')
assert.deepEqual(controlForChanges({kind:'encoders',id:1},[{control:{kind:'encoders',id:8}}]),{kind:'encoders',id:8})
assert.equal(controlForChanges({kind:'encoders',id:1},[{control:{kind:'encoders',id:8}},{control:{kind:'encoders',id:9}}]),null)
assert.deepEqual(controlForChanges({kind:'encoders',id:9},[{control:{kind:'encoders',id:8}},{control:{kind:'encoders',id:9}}]),{kind:'encoders',id:9})
assert.deepEqual(controlForChanges({kind:'encoders',id:1},[{control:{kind:'pushes',id:8}}]),{kind:'pushes',id:8})
assert.equal(controlForChanges({kind:'encoders',id:1},[]),null)
console.log('PASS: OLED follows absolute/relative CC/channel, retains preferred duplicate, does not guess physical index, ignores invalid/note packets')
