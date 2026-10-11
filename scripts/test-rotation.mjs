import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/rotation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { estimateTurns, estimateResolution } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const one = estimateTurns(0, 127, 13, 80, 1)
assert.equal(one.steps, 127)
assert.equal(one.pulsesPerTurn, 16.25)
assert.ok(Math.abs(one.turns - 7.815384615384615) < 1e-10)
assert.equal(estimateTurns(0, 127, 13, 80, 2).turns, 2 * one.turns)
assert.equal(estimateTurns(0, 127, 32, 100, 1).turns, 127 / 32)
assert.equal(estimateTurns(10, 10, 13, 80, 1).turns, 0)
assert.equal(estimateTurns(10, 20, 13, 80, 1).steps, 10)
for (const args of [[0, 127, 0, 80, 1], [0, 127, 13, 101, 1], [0, 127, 13, 0, 1], [0, 127, 13, 80, 0], [10, 0, 13, 80, 1], [0, 127, NaN, 80, 1]]) assert.equal(estimateTurns(...args), null)
console.log('PASS: 127 transitions, 13/80% gives 7.82 turns, pulse multiplier, ranges and invalid hypotheses')
assert.deepEqual(estimateResolution(0, 127, 127 / 8), { steps: 127, turns: 8, ledIntervals: 20, stepsPerLed: 6.35 })
assert.equal(estimateResolution(0, 127, 24).turns, 127 / 24)
assert.equal(estimateResolution(0, 127, 32).turns, 127 / 32)
assert.equal(estimateResolution(0, 127, 96).turns, 127 / 96)
assert.equal(estimateResolution(0, 127, 0), null)
assert.equal(estimateResolution(0, 127, 24, 1), null)
assert.equal(estimateResolution(0, 0, 24).turns, 0)
console.log('PASS: 21 LEDs = 20 intervals, 6.35 steps/interval, 8-turn estimate, 24/32/96 resolutions')
