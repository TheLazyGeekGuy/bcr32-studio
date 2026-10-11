import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result = await build({ entryPoints: [new URL('../src/profile.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm' })
const code = result.outputFiles[0].text
const { createProfile, ccPlan, parseProfile } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const p = createProfile()
assert.equal(p.encoders.length, 32)
assert.equal(p.pushes.length, 32)
assert.equal(p.buttons.length, 26)
p.pushes[0].parameter = 90
p.buttons[0].parameter = 40
const planned = ccPlan(p)
assert.deepEqual(planned.encoders.map(e => e.parameter), Array.from({ length: 32 }, (_, i) => i))
assert.equal(planned.pushes[0].parameter, 90)
assert.equal(planned.buttons[0].parameter, 40)
assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(planned))), planned)
planned.encoders[0].ledMode = 'spread'
assert.equal(parseProfile(planned).encoders[0].ledMode, 'spread')
assert.throws(() => parseProfile({ ...planned, encoders: planned.encoders.map(e => ({ ...e, ledMode: 'invalid' })) }))
const legacy = { schemaVersion: 1, device: p.device, encoders: planned.encoders }
assert.equal(parseProfile(legacy).pushes[0].type, 'off')
assert.equal(parseProfile(legacy).encoders[10].parameter, 10)
for (const invalid of [null, {}, { ...p, pushes: [] }, { ...p, encoders: [null] }, { ...p, buttons: p.buttons.map(e => ({ ...e, channel: 17 })) }]) assert.throws(() => parseProfile(invalid))
console.log('PASS: layout counts, independent assignments, CC plan, v1 migration, v2 roundtrip, invalid imports')
