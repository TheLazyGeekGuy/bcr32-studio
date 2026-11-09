import assert from 'node:assert/strict'
import { isReviewedPublicMatch } from './leak-gate-public-context.mjs'

let count = 0
function check(pattern, text, expected, name = 'denylist entry #1') {
  const rule = { name, re: new RegExp(pattern, 'gi') }
  const matches = [...text.matchAll(rule.re)]
  assert.ok(matches.length, 'fixture must match the original rule')
  for (const match of matches) {
    assert.equal(isReviewedPublicMatch(rule, text, match), expected, text)
    count++
  }
}
const maker = 'behringer' + '.com'
for (const s of [maker, `https://${maker}/en/products/x`, `https://www.${maker}/x`, `includes('${maker}')`]) check(maker.replace('.', '\\.'), s, true)
for (const s of [`private.${maker}`, `${maker}.private`, `not${maker}`, `${maker}-private`]) check(maker.replace('.', '\\.'), s, false)
const cdn = 'empower' + 'tribe'
check(cdn, `https://cdn-media.${cdn}.com/manual.pdf`, true)
for (const s of [cdn, `${cdn}.private`, `https://private.cdn-media.${cdn}.com/x`, `cdn-media.${cdn}.com.private`]) check(cdn, s, false)
const forge = 'pro' + 'zium'
const reference = `https://forge.${forge}.net/TheLazyGeekGuy/BCR32-Firwmare`
check(forge, `[Reference](${reference}), exact commit`, true)
for (const s of [`https://forge.${forge}.net/private`, reference + '-private', forge]) check(forge, s, false)
const imagePattern = 'pho' + 'to'
for (const word of ['photograph', 'photographs', 'photographed', 'Photographs']) check(imagePattern, word, true)
for (const word of [imagePattern, imagePattern + 'private', 'my_' + imagePattern + 'graph', imagePattern + 'graphy']) check(imagePattern, word, false)
const buildPattern = 'regen' + 'erat'
for (const word of ['regenerated', 'regeneration', 'regenerates']) check(buildPattern, word, true)
for (const word of [buildPattern, buildPattern + 'private', 'my_' + buildPattern + 'ed']) check(buildPattern, word, false)
// Generic secret rules and other private rules must not inherit exceptions.
check(maker.replace('.', '\\.'), maker, false, 'generic test rule')
check('photograph', 'photograph', false)
console.log(`PASS reviewed public-context exceptions: ${count} positive/negative assertions`)
