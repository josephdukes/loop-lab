// Layout audit: no sideways scrolling, cut-off or overlapping text, and every field at least 16 px,
// at 320 x 640 and with the root font size at 24 px (large text), on every screen state.
// Usage: npm run build && npm run audit:layout   (add `-- --quick` for one data set)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, OUT_DIR, startPreview, VIEWPORTS } from './audit/harness.mjs'
import { layoutProblems } from './audit/measure.mjs'
import { pool, walk } from './audit/walk.mjs'

const quick = process.argv.includes('--quick')
const preview = await startPreview()
const browser = await launch()
const modes = [
  { name: '320x640', viewport: VIEWPORTS.narrow },
  { name: '390x844', viewport: VIEWPORTS.portrait },
  { name: '844x390', viewport: VIEWPORTS.landscape },
  { name: 'root font 24px (390x844)', viewport: VIEWPORTS.portrait, rootFontPx: 24 },
  { name: 'root font 24px (844x390)', viewport: VIEWPORTS.landscape, rootFontPx: 24 },
]
const jobs = []
for (const m of modes) for (const theme of quick ? ['dark'] : ['dark', 'light']) for (const dataset of quick ? ['rich'] : ['rich', 'empty']) jobs.push({ ...m, theme, dataset })

const all = await pool(jobs, 4, async (job) => {
  const r = await walk({ browser, url: preview.url, orientation: 'portrait', ...job, check: async (page) => ({ problems: await layoutProblems(page) }) })
  return { name: job.name, theme: job.theme, dataset: job.dataset, ...r }
})
await browser.close()
preview.stop()

let states = 0, problems = 0
for (const job of all) {
  for (const r of job.results) {
    states++
    const where = `[${job.name}/${job.theme}/${job.dataset}] ${r.state}`
    if (r.unreachable) { problems++; console.log(`UNREACHABLE ${where}: ${r.unreachable}`); continue }
    for (const p of r.problems) { problems++; console.log(`${where}: ${p}`) }
  }
  if (job.external.length) { problems++; console.log('EXTERNAL REQUESTS', job.external) }
}
writeFileSync(join(OUT_DIR, 'layout-results.json'), JSON.stringify(all, null, 1))
console.log(`\nLayout audit: ${states} screen states checked, ${problems} problems.`)
process.exit(problems ? 1 : 0)
