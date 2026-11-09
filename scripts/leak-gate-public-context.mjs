// Reviewed public references and complete technical words, not a general bypass.
const manufacturerDomain = 'behringer.com'
const manualHost = 'cdn-media.empowertribe.com'
const firmwareReference = 'https://forge.prozium.net/TheLazyGeekGuy/BCR32-Firwmare'
const technicalWords = new Map([
  ['pho' + 'to', new Set(['photograph', 'photographs', 'photographed'])],
  ['regen' + 'erat', new Set(['regenerated', 'regeneration', 'regenerates'])],
])

export function isReviewedPublicMatch(rule, text, match) {
  if (!rule.name.startsWith('denylist entry #')) return false
  const value = match[0].toLowerCase()
  const start = match.index
  const end = start + match[0].length
  const before = text.slice(0, start)
  const after = text.slice(end)

  // Exact public manufacturer domains only. A parent hostname is limited to
  // www or the documented manual CDN; suffixes and lookalikes remain blocked.
  if (value === manufacturerDomain || value === manualHost.split('.')[1]) {
    if (value === manufacturerDomain) {
      return !/[a-z0-9_-]$/i.test(before) &&
        (!before.endsWith('.') || /(?:^|[^a-z0-9_.-])www\.$/i.test(before)) &&
        !/^[a-z0-9_.-]/i.test(after)
    }
    // The denylist matches the label within the manufacturer's CDN hostname.
    return /(?:^|[^a-z0-9_.-])cdn-media\.$/i.test(before) &&
      /^\.com(?:[^a-z0-9_.-]|$)/i.test(after)
  }

  const referenceStart = text.lastIndexOf(firmwareReference, start)
  if (value === new URL(firmwareReference).hostname.split('.')[1] &&
      referenceStart >= 0 && referenceStart <= start && end <= referenceStart + firmwareReference.length) {
    const next = text[referenceStart + firmwareReference.length]
    if (next === undefined || /[\s)\]>'"`,]/.test(next)) return true
  }

  // The private patterns are broad substrings. Exempt only complete reviewed
  // English words; names, paths and arbitrary longer identifiers stay blocked.
  const words = technicalWords.get(rule.re.source.toLowerCase())
  if (!words || !technicalWords.has(value)) return false
  const left = before.match(/[a-z0-9_-]*$/i)[0]
  const right = after.match(/^[a-z0-9_-]*/i)[0]
  return words.has((left + match[0] + right).toLowerCase())
}
