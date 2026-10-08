// Offline audit in real Chromium: the production build served by `vite preview`, service worker installed,
// then the network is switched off and the whole app is used. Not a phone test.
// Usage: npm run build && npm run audit:offline
import { launch, startPreview, VIEWPORTS } from './audit/harness.mjs'
import { goTab } from './audit/states.mjs'

const preview = await startPreview()
const browser = await launch()
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`) }

const context = await browser.newContext({ viewport: VIEWPORTS.portrait, isMobile: true, hasTouch: true, serviceWorkers: 'allow', acceptDownloads: true })
const page = await context.newPage()
const external = []
const failedRequests = []
page.on('request', (r) => { if (!r.url().startsWith(preview.url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()) })
page.on('requestfailed', (r) => failedRequests.push(r.url()))
const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()) })
const h1 = (name) => page.getByRole('heading', { level: 1, name, exact: true })

try {
  await page.goto(preview.url)
  await h1('Home').waitFor()
  // Wait until the service worker is active and in control, and its precache is full.
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100))
    const names = await caches.keys()
    let count = 0
    for (const n of names) count += (await (await caches.open(n)).keys()).length
    return { active: reg.active?.state, controlled: !!navigator.serviceWorker.controller, caches: names.length, entries: count }
  })
  check('service worker is active and precached the app', sw.active === 'activated' && sw.caches > 0 && sw.entries > 20, JSON.stringify(sw))
  if (!sw.controlled) { await page.reload(); await h1('Home').waitFor() }
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
  check('page is controlled by the service worker', controlled)

  // Which files does the build contain? Every one must be in the cache.
  const missing = await page.evaluate(async (origin) => {
    const html = await (await fetch(origin)).text()
    const files = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
    const keys = new Set()
    for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) keys.add(new URL(r.url).pathname)
    return files.filter((f) => !keys.has(new URL(f, origin).pathname))
  }, preview.url)
  check('entry scripts and styles are all in the cache', missing.length === 0, missing.join(', '))

  await context.setOffline(true)
  await page.reload()
  await h1('Home').waitFor()
  check('offline: reload shows Home', true)

  // Every tab, including the ones loaded on demand.
  for (const t of ['Train', 'Progress', 'Matches', 'Data', 'Home']) {
    await goTab(page, t)
    await page.waitForFunction(() => !document.querySelector('.state-loading'))
    const failedBox = await page.getByText('could not be opened').count()
    check(`offline: ${t} tab opens`, failedBox === 0)
  }
  // Train sub-tabs and an editor
  await goTab(page, 'Train')
  for (const s of ['Programs', 'Sessions', 'Drills', 'Guides']) { await page.getByRole('tab', { name: s }).click(); check(`offline: Train / ${s}`, (await page.getByText('could not be opened').count()) === 0) }
  await page.getByRole('tab', { name: 'Drills' }).click()
  await page.getByRole('button', { name: 'New drill' }).click()
  await h1('New drill').waitFor()
  check('offline: drill editor (lazy screen) opens', true)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).count()
  await goTab(page, 'Home')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await h1('Settings and help').waitFor()
  check('offline: Settings (lazy screen) opens', true)
  await page.getByRole('button', { name: 'Close' }).click()

  // Run and save a session, offline.
  await goTab(page, 'Train')
  await page.getByRole('tab', { name: 'Sessions' }).click()
  await page.getByRole('button', { name: 'Start now: Original Phase 1 Session' }).click()
  await page.getByRole('dialog', { name: 'Session runner' }).waitFor()
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Hit', exact: true }).click()
  await page.getByRole('button', { name: 'Miss', exact: true }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('radiogroup', { name: 'Effort' }).getByRole('radio', { name: '3 of 5' }).click()
  await page.getByRole('button', { name: 'Save session' }).click()
  await h1('Home').waitFor()
  await page.getByText(/1 of 3 robot sessions this week/).waitFor()
  check('offline: session saved and Home counts it', true)
  await goTab(page, 'Progress')
  await page.waitForFunction(() => !document.querySelector('.state-loading'))
  check('offline: Progress shows the saved session', (await page.getByText('No sessions logged yet').count()) === 0)
  await goTab(page, 'Data')
  check('offline: Data tab works', (await page.getByRole('button', { name: /^Back up now/ }).count()) > 0)

  // Back online: data is still there after a reload.
  await context.setOffline(false)
  await page.reload()
  await h1('Home').waitFor()
  await page.getByText(/1 of 3 robot sessions this week/).waitFor()
  check('after going online and reloading, the data is still there', true)
} catch (e) {
  check('offline run completed without an unexpected error', false, String(e.message).split('\n')[0])
} finally {
  await browser.close()
  preview.stop()
}
check('no requests to other domains', external.length === 0, external.join(', '))
const real = problems.filter((p) => !/net::ERR_INTERNET_DISCONNECTED/.test(p))
check('no page errors or console errors (apart from offline network refusals)', real.length === 0, real.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\nOffline audit: ${results.length - failed.length} of ${results.length} checks passed.`)
if (failedRequests.length) console.log('Requests that failed while offline (expected for anything not cached):', failedRequests.length, failedRequests.slice(0, 5))
process.exit(failed.length ? 1 : 0)
