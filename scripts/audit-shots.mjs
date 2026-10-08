// Takes screenshots of the key screens for looking at (not a pass/fail audit).
// Usage: npm run build && npm run audit:shots   (writes PNG files to audit-output/shots/)
// Optional: `-- --only runner-hits,home` to limit the states.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch, OUT_DIR, startPreview, VIEWPORTS } from './audit/harness.mjs'
import { pool, walk } from './audit/walk.mjs'

const onlyArg = process.argv.indexOf('--only')
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : ['home', 'settings', 'train-programs', 'train-program-holistic', 'train-sessions', 'train-drills', 'editor-drill-new', 'editor-session-new', 'progress', 'matches', 'match-form-new', 'data', 'quicklog-form-template', 'all-sessions', 'runner-hits', 'runner-streak', 'runner-score', 'runner-rating', 'runner-timer-running', 'runner-summary', 'runner-discard-dialog', 'lazy-error', 'undo-toast']
const dir = join(OUT_DIR, 'shots')
mkdirSync(dir, { recursive: true })
const preview = await startPreview()
const browser = await launch()
const jobs = [
  { tag: 'portrait-dark', orientation: 'portrait', theme: 'dark' },
  { tag: 'portrait-light', orientation: 'portrait', theme: 'light' },
  { tag: 'landscape-dark', orientation: 'landscape', theme: 'dark' },
  { tag: 'landscape-light', orientation: 'landscape', theme: 'light' },
  { tag: 'narrow-320-dark', orientation: 'portrait', theme: 'dark', viewport: VIEWPORTS.narrow },
  { tag: 'narrow-320-light', orientation: 'portrait', theme: 'light', viewport: VIEWPORTS.narrow },
  { tag: 'large-text-dark', orientation: 'portrait', theme: 'dark', rootFontPx: 24 },
]
await pool(jobs, 3, (job) => walk({
  browser, url: preview.url, ...job, dataset: 'rich', only,
  check: async (page, state) => { await page.screenshot({ path: join(dir, `${job.tag}__${state.id}.png`) }); return {} },
}))
await browser.close()
preview.stop()
console.log('Screenshots written to', dir)
