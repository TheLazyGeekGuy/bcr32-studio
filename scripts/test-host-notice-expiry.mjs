import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const exports = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/editor-host/notice-expiry.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText)(exports)
const {expireHostNotice, nativePresenceRecovered, recoveryNoticeDurationMs} = exports
let now = 0, notice = nativePresenceRecovered
const jobs = new Set()
const schedule = (callback, delay) => {
  const job = {callback, at: now + delay}
  jobs.add(job)
  return () => jobs.delete(job)
}
const tick = ms => {
  now += ms
  for (const job of jobs) if (job.at <= now) {jobs.delete(job); job.callback()}
}
const setNotice = update => {notice = update(notice)}
assert.equal(recoveryNoticeDurationMs, 4000)
expireHostNotice(notice, setNotice, schedule)
tick(3999); assert.equal(notice, nativePresenceRecovered)
tick(1); assert.equal(notice, '', 'Recovery expires after four seconds')
notice = nativePresenceRecovered
expireHostNotice(notice, setNotice, schedule)
notice = 'Permission denied'
tick(4000); assert.equal(notice, 'Permission denied', 'An older success cannot erase a new error')
notice = nativePresenceRecovered
const cancel = expireHostNotice(notice, setNotice, schedule)
cancel(); assert.equal(jobs.size, 0, 'Dismiss/replacement/unmount cleanup releases the timer')
tick(4000); assert.equal(notice, nativePresenceRecovered)
for (const warning of ['', 'Permission denied', 'Native MIDI presence lost; connections suspended until recovery.', 'Native MIDI presence unavailable; using browser port state.']) {
  notice = warning
  expireHostNotice(notice, setNotice, schedule)
  assert.equal(jobs.size, 0)
  tick(10000); assert.equal(notice, warning)
}
console.log('PASS: recovery expires at 4s; later errors survive; cleanup cancels; warnings stay visible')
