// Single entry point for `npm test`: every scripts/test-*.mjs and test-*.cjs (artifact checks, no hardware)
// in sorted order, stop at the first failure, then the project type check. No dependency beyond node and the repo's own devDependencies.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..')
const files = readdirSync(dir).filter(name => /^test-.*\.[mc]js$/.test(name)).sort()
let passed = 0
for (const file of files) {
  const result = spawnSync(process.execPath, [join(dir, file)], { cwd: root, stdio: 'inherit' })
  const ok = result.status === 0
  console.log(`${ok ? 'PASS' : 'FAIL'} ${file}`)
  if (!ok) { console.log(`${passed}/${files.length} test scripts passed; stopped at ${file}`); process.exit(result.status ?? 1) }
  passed++
}
console.log(`${passed}/${files.length} test scripts passed`)
const tsc = spawnSync(process.execPath, [createRequire(import.meta.url).resolve('typescript/bin/tsc'), '-b', '--noEmit'], { cwd: root, stdio: 'inherit' })
console.log(`${tsc.status === 0 ? 'PASS' : 'FAIL'} tsc -b --noEmit`)
process.exit(tsc.status ?? 1)
