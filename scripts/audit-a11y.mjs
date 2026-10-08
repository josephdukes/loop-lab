// Accessibility audit: axe-core (injected from node_modules, no network) on every screen state,
// in both themes and both orientations, with the rich and the empty data set.
// Usage: npm run build && npm run audit:a11y   (add `-- --quick` for portrait, dark theme, rich data only)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, OUT_DIR, startPreview } from './audit/harness.mjs'
import { pool, walk } from './audit/walk.mjs'

const quick = process.argv.includes('--quick')
const preview = await startPreview()
const browser = await launch()
const jobs = []
for (const orientation of quick ? ['portrait'] : ['portrait', 'landscape'])
  for (const theme of quick ? ['dark'] : ['dark', 'light'])
    for (const dataset of quick ? ['rich'] : ['rich', 'empty']) jobs.push({ orientation, theme, dataset })

const all = await pool(jobs, 4, async (job) => {
  const r = await walk({
    browser, url: preview.url, ...job, axe: true,
    check: async (page) => page.evaluate(async () => {
      // Dialogs set the background inert; axe handles that. Run the full WCAG A/AA rule set plus best practices.
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
      return { violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 160)), count: v.nodes.length })), passes: res.passes.length }
    }),
  })
  return { ...job, ...r }
})
await browser.close()
preview.stop()

const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 }
const kinds = new Map()
let states = 0, unreachable = 0
for (const job of all) {
  for (const r of job.results) {
    states++
    const where = `${job.orientation}/${job.theme}/${job.dataset}/${r.state}`
    if (r.unreachable) { unreachable++; console.log(`UNREACHABLE ${where}: ${r.unreachable}`); continue }
    for (const v of r.violations) {
      byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1
      const key = `${v.impact} ${v.id}`
      const k = kinds.get(key) ?? { help: v.help, n: 0, example: `${where}: ${v.nodes[0]}` }
      k.n++; kinds.set(key, k)
    }
  }
  if (job.external.length) console.log('EXTERNAL REQUESTS', job.external)
}
writeFileSync(join(OUT_DIR, 'a11y-results.json'), JSON.stringify(all, null, 1))
console.log(`\naxe-core: ${states} screen states checked (${jobs.length} combinations of orientation, theme, data), ${unreachable} unreachable.`)
console.log(`Violations by impact: critical ${byImpact.critical}, serious ${byImpact.serious}, moderate ${byImpact.moderate}, minor ${byImpact.minor}`)
for (const [key, k] of kinds) console.log(`  ${key} x${k.n}: ${k.help}\n      e.g. ${k.example}`)
process.exit(byImpact.critical + byImpact.serious + byImpact.moderate + unreachable ? 1 : 0)
