import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const mod = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/parameter-names.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod)
const { parseNames, namesFile, mergeNames, defaultNames, loadNames } = mod
assert.equal(defaultNames.find(e => e.parameter === 74).name, 'Cutoff / Brightness')
assert.deepEqual(parseNames(namesFile(defaultNames)), defaultNames)
const custom = { type: 'cc', parameter: 74, name: 'Custom filter' }
const merged = mergeNames(defaultNames, [custom, { type: 'nrpn', parameter: 74, name: 'Other instrument' }])
assert.equal(merged.find(e => e.type === 'cc' && e.parameter === 74).name, custom.name)
assert.equal(merged.find(e => e.type === 'cc' && e.parameter === 7).name, 'Volume')
assert.equal(merged.filter(e => e.parameter === 74).length, 2)
for (const bad of [{ ...custom, parameter: 128 }, { ...custom, type: 'bogus' }, { ...custom, name: '<\n>' }, { ...custom, name: '' }]) assert.throws(() => parseNames(namesFile([bad])))
assert.throws(() => parseNames(namesFile([custom, custom])))
assert.throws(() => parseNames({ entries: [] }))
assert.deepEqual(loadNames(), defaultNames)
assert.equal(defaultNames.find(e => e.parameter === 0).name, 'Bank Select MSB')
assert.equal(defaultNames.find(e => e.parameter === 10).name, 'Pan')
// v1 storage held the French factory labels ('Banque MSB'): the migration still replaces them with the English names.
const storage = new Map([['bcr32-studio.parameter-names.v1', JSON.stringify(namesFile([{ type: 'cc', parameter: 0, name: 'Banque MSB' }, custom]))]])
globalThis.window = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } }
assert.equal(loadNames()[0].name, 'Bank Select MSB')
assert.equal(loadNames()[1].name, custom.name)
assert.ok(storage.has(mod.parameterNamesKey))
storage.set(mod.parameterNamesKey, JSON.stringify(namesFile([{ type: 'cc', parameter: 2, name: 'Souffle' }])))
assert.equal(loadNames()[0].name, 'Souffle', 'A newly imported/custom name must never be translated')
delete globalThis.window
const picker = readFileSync(new URL('../src/ParameterNames.tsx', import.meta.url), 'utf8')
assert.ok(!picker.includes('Undefined'))
assert.match(picker, /data-i18n-skip disabled=\{!supported\}/)
console.log('PASS: typed local names, selective merge, defaults, roundtrip and invalid import rejection')
