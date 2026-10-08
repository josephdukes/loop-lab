// Tap-target audit: every interactive element on every screen must be at least 48 x 48 CSS px (portrait and landscape).
// Usage: npm run build && npm run audit:tap   (add `-- --quick` for one orientation, dark theme, rich data only)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, OUT_DIR, startPreview } from './audit/harness.mjs'
import { layoutProblems, measureTargets } from './audit/measure.mjs'
import { pool, walk } from './audit/walk.mjs'

const MIN = 47.99
const quick = process.argv.includes('--quick')
const preview = await startPreview()
const browser = await launch()
const jobs = []
for (const orientation of quick ? ['portrait'] : ['portrait', 'landscape']) for (const dataset of quick ? ['rich'] : ['rich', 'empty']) jobs.push({ orientation, dataset })

const all = await pool(jobs, 4, async (job) => {
  const r = await walk({
    browser, url: preview.url, ...job, theme: 'dark',
    check: async (page) => {
      const targets = await measureTargets(page)
      const small = targets.filter((t) => t.w < MIN || t.h < MIN)
      return { count: targets.length, smallest: targets.filter((t) => !t.exempt).sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 2), fails: small.filter((t) => !t.exempt), exempt: small.filter((t) => t.exempt), fieldProblems: (await layoutProblems(page)).filter((p) => p.startsWith('field text')) }
    },
  })
  return { ...job, ...r }
})
await browser.close()
preview.stop()

let failures = 0
let exempt = new Map()
let total = 0
let states = 0
const smallest = []
for (const job of all) {
  for (const r of job.results) {
    states++
    if (r.unreachable) { failures++; console.log(`UNREACHABLE [${job.orientation}/${job.dataset}] ${r.state}: ${r.unreachable}`); continue }
    total += r.count
    for (const t of r.smallest ?? []) smallest.push({ ...t, where: `${job.orientation}/${job.dataset}/${r.state}` })
    for (const f of r.fails) { failures++; console.log(`SMALL [${job.orientation}/${job.dataset}] ${r.state}: ${f.desc} is ${f.w} x ${f.h}`) }
    for (const f of r.fieldProblems) { failures++; console.log(`[${job.orientation}/${job.dataset}] ${r.state}: ${f}`) }
    for (const f of r.exempt) exempt.set(f.exempt, (exempt.get(f.exempt) ?? 0) + 1)
  }
  if (job.external.length) { failures++; console.log('EXTERNAL REQUESTS', job.external) }
  if (job.problems.length) console.log(`console/page errors [${job.orientation}/${job.dataset}]:`, [...new Set(job.problems)].slice(0, 5))
}
writeFileSync(join(OUT_DIR, 'tap-results.json'), JSON.stringify(all, null, 1))
console.log(`\nTap audit: ${states} screen states, ${total} interactive elements measured, ${failures} problems.`)
smallest.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h))
console.log('Smallest non-exempt targets measured:'); for (const t of smallest.slice(0, 5)) console.log(`  ${t.w} x ${t.h}  ${t.desc}  [${t.where}]`)
for (const [why, n] of exempt) console.log(`Exempt (${n} measurements): ${why}`)
process.exit(failures ? 1 : 0)
