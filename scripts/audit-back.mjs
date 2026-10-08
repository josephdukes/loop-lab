// Back-button audit in real Chromium: history traversal (page.goBack), which is what the Android Back gesture does for a web app.
// It is NOT a test of the real Android gesture. Usage: npm run build && npm run audit:back
import { launch, preparedPage, startPreview, VIEWPORTS } from './audit/harness.mjs'
import { goTab } from './audit/states.mjs'

const preview = await startPreview()
const browser = await launch()
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`) }

async function fresh() {
  const { context, page } = await preparedPage(browser, { url: preview.url, viewport: VIEWPORTS.portrait, theme: 'dark', dataset: 'rich' })
  return { context, page }
}
const back = async (page) => { await page.goBack(); await page.waitForTimeout(250) }
const onApp = (page) => page.url().startsWith(preview.url)
const h1 = (page, name) => page.getByRole('heading', { level: 1, name, exact: true })
const visible = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible())

try {
  // 1. Runner: Back returns to the tab it was opened from; Back again reaches Home with the Resume banner; Back from Home leaves.
  {
    const { context, page } = await fresh()
    await goTab(page, 'Train')
    await page.getByRole('tab', { name: 'Sessions' }).click()
    await page.getByRole('button', { name: 'Start now: Original Phase 1 Session' }).click()
    await page.getByRole('dialog', { name: 'Session runner' }).waitFor()
    await page.getByRole('button', { name: 'Hit', exact: true }).click()
    await back(page)
    check('runner: Back closes the runner', !(await visible(page.getByRole('dialog', { name: 'Session runner' }))) && onApp(page))
    check('runner: Back lands on Train (where it was opened)', await visible(h1(page, 'Train')))
    await back(page)
    check('runner: second Back reaches Home', await visible(h1(page, 'Home')))
    check('runner: Home shows the Resume banner (autosave kept the session)', await visible(page.getByRole('region', { name: 'Unfinished session' })))
    await page.getByRole('button', { name: 'Resume' }).click()
    await page.getByRole('dialog', { name: 'Session runner' }).waitFor()
    const attempts = await page.getByRole('spinbutton', { name: 'Attempts' }).textContent()
    check('runner: Resume restores the counter', attempts === '1', `attempts ${attempts}`)
    await back(page)
    await back(page).catch(() => {})
    check('Home is the last stop: one more Back leaves the app', !onApp(page), page.url())
    await context.close()
  }
  // 2. Editors and forms, Settings, Block Review, Quick log, session detail.
  {
    const { context, page } = await fresh()
    await goTab(page, 'Train')
    await page.getByRole('tab', { name: 'Drills' }).click()
    await page.getByRole('button', { name: 'New drill' }).click()
    await h1(page, 'New drill').waitFor()
    await back(page)
    check('drill editor: Back closes it', !(await visible(h1(page, 'New drill'))) && onApp(page))
    await page.getByRole('button', { name: 'New drill' }).click()
    await h1(page, 'New drill').waitFor()
    await page.getByLabel('Name').fill('Half typed')
    await back(page)
    check('drill editor with typing: Back asks before discarding', await visible(page.getByRole('alertdialog')))
    check('drill editor with typing: editor still open behind the question', await visible(h1(page, 'New drill')))
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await back(page)
    await back(page)
    check('drill editor: Back, then Back on the question, keeps it open', await visible(h1(page, 'New drill')) && !(await visible(page.getByRole('alertdialog'))))
    await back(page)
    await page.getByRole('button', { name: 'Discard changes' }).click()
    check('drill editor: Discard closes it and stays in the app', !(await visible(h1(page, 'New drill'))) && onApp(page))
    await context.close()
  }
  {
    const { context, page } = await fresh()
    for (const [label, open, heading] of [
      ['Settings', async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click() }, 'Settings and help'],
      ['Quick log', async () => { await page.getByRole('button', { name: 'Quick log' }).first().click() }, 'Quick log'],
      ['All sessions then a session', async () => { await page.getByRole('button', { name: 'All sessions' }).click(); await h1(page, 'All sessions').waitFor(); await page.locator('.overlay-screen').getByRole('list', { name: 'Sessions' }).getByRole('button').first().click() }, 'Session'],
      ['Match form', async () => { await page.getByRole('button', { name: 'Log a match' }).first().click() }, 'Log a match'],
    ]) {
      await open()
      await h1(page, heading).waitFor()
      await back(page)
      const closed = !(await visible(h1(page, heading)))
      check(`${label}: Back closes it`, closed && onApp(page))
      // reset to Home for the next one
      if (label.startsWith('All sessions')) { await back(page) }
      if (!(await visible(h1(page, 'Home')))) await goTab(page, 'Home')
    }
    await goTab(page, 'Matches')
    await page.getByRole('button', { name: 'Open Block Review' }).click()
    await h1(page, 'Block Review').waitFor()
    await back(page)
    check('Block Review: Back returns to Matches', await visible(h1(page, 'Matches')) && !(await visible(h1(page, 'Block Review'))))
    // tabs: Back from a root tab goes to Home, never loops
    await goTab(page, 'Progress')
    await goTab(page, 'Data')
    await back(page)
    check('tabs: Back from Data goes to Home', await visible(h1(page, 'Home')))
    await context.close()
  }
} finally {
  await browser.close()
  preview.stop()
}
const failed = results.filter((r) => !r.ok)
console.log(`\nBack-button audit: ${results.length - failed.length} of ${results.length} checks passed.`)
process.exit(failed.length ? 1 : 0)
