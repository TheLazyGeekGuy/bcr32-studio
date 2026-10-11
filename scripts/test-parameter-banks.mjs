import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const root = new URL('../', import.meta.url).pathname
mkdirSync(root + 'output/banks-test', { recursive: true })
await build({ entryPoints: [root + 'src/parameter-banks.ts', root + 'src/parameter-names.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: root + 'output/banks-test' })
const require = createRequire(import.meta.url)
const { parameterBanks, gsEntries } = require(root + 'output/banks-test/parameter-banks.js')
const { parseNames, namesFile, mergeNames } = require(root + 'output/banks-test/parameter-names.js')
assert.equal(gsEntries.length, 15)
assert.equal(parameterBanks[1].entries.length, 8)
assert.equal(parameterBanks[2].entries.length, 768)
for (const bank of parameterBanks) assert.deepEqual(parseNames(namesFile(bank.entries)), bank.entries)
assert.match(parameterBanks[1].entries.find(e => e.parameter === 160).name, /Cutoff/)
assert.match(parameterBanks[1].entries.find(e => e.parameter === 227).name, /Attack/)
assert.match(parameterBanks[2].entries.find(e => e.parameter === 0x18 * 128 + 60).name, /Drum 60 · Pitch Coarse/)
assert.equal(parameterBanks[0].localIndices, true)
const local = [{ type: 'gs', parameter: 0, name: 'My cutoff' }]
assert.equal(mergeNames(gsEntries, local).find(e => e.parameter === 0).name, 'My cutoff')
console.log('PASS: sourced GS list and NRPN banks, 14-bit address arithmetic, unique valid entries and override priority')
