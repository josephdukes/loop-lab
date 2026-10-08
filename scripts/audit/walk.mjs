// Visits every state for one (viewport, theme, dataset) combination and calls `check` on each.
import { preparedPage, VIEWPORTS } from './harness.mjs'
import { statesFor } from './states.mjs'

/** Runs `check(page, state)` for every state. Returns the list of results. A state that cannot be reached is reported, never skipped silently. */
export async function walk({ browser, url, orientation, theme, dataset, axe = false, check, only, reducedMotion, rootFontPx, viewport }) {
  const { context, page } = await preparedPage(browser, { url, viewport: viewport || VIEWPORTS[orientation], theme, dataset, axe, reducedMotion, rootFontPx })
  const results = []
  for (const state of statesFor(dataset)) {
    if (only && !only.includes(state.id)) continue
    const t0 = Date.now()
    try {
      // Each state starts clean: no unfinished session left over from the previous one.
      await page.evaluate(() => new Promise((res) => {
        const r = indexedDB.open('loop-lab')
        r.onsuccess = () => { const db = r.result; const tx = db.transaction('activeSession', 'readwrite'); tx.objectStore('activeSession').clear(); tx.oncomplete = () => { db.close(); res() } }
      }))
      await page.reload()
      await page.getByRole('heading', { name: 'Home', level: 1 }).waitFor()
      if (state.route) await state.route(page)
      await state.run(page)
      results.push({ state: state.id, ...(await check(page, state)) })
    } catch (e) {
      results.push({ state: state.id, unreachable: String(e.message).split('\n')[0] })
    } finally {
      if (process.env.AUDIT_VERBOSE) console.error(`  [${orientation}/${theme}/${dataset}] ${state.id} ${Date.now() - t0}ms`)
      await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    }
  }
  const external = context.external.slice()
  const problems = page.problems.slice()
  await context.close()
  return { results, external, problems }
}

export async function pool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i) }
  }))
  return out
}
