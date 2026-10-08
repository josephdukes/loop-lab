// Every screen and state the audits visit. Each `run(page)` starts from a freshly loaded Home and brings the app to the state.
// Used by the tap-target audit, the axe audit and the screenshot script, so they all see exactly the same things.
import { join } from 'node:path'
import { OUT_DIR } from './harness.mjs'

/** Waits until lazy screens have arrived and every "Loading" message is gone. */
const settle = async (page) => {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => !document.querySelector('.state-loading'))
  await page.waitForTimeout(120)
}
const tabBar = (page) => page.getByRole('navigation', { name: 'Main' })
export const goTab = async (page, name) => {
  await tabBar(page).getByRole('button', { name, exact: true }).click()
  await page.getByRole('heading', { level: 1, name }).waitFor()
}
const btn = (page, name, opts = {}) => page.getByRole('button', { name, ...opts })
const click = async (page, name, opts) => { await btn(page, name, opts).first().click() }
const heading = (page, name) => page.getByRole('heading', { name }).first().waitFor()
const sub = async (page, name) => { await goTab(page, 'Train'); await page.getByRole('tab', { name }).click(); await settle(page) }
const startNow = async (page, templateName) => {
  await sub(page, 'Sessions')
  await btn(page, `Start now: ${templateName}`).click()
  await page.getByRole('dialog', { name: 'Session runner' }).waitFor()
  await page.locator('.runner h2').first().waitFor()
}
const openProgram = async (page, name) => { await sub(page, 'Programs'); await page.getByRole('button', { name: new RegExp(name) }).first().click(); await settle(page) }
const openDrill = async (page, name) => { await sub(page, 'Drills'); await page.getByRole('button', { name: new RegExp(name) }).first().click(); await settle(page) }
const allSessions = async (page) => { await click(page, 'All sessions'); await heading(page, 'All sessions'); await settle(page) }
const firstSession = async (page) => { await allSessions(page); await page.locator('.overlay-screen').getByRole('list', { name: 'Sessions' }).getByRole('button').first().click(); await heading(page, 'Session'); await settle(page) }
const dialogOpen = (page) => page.getByRole('alertdialog').waitFor()

async function backupFile(page) {
  await goTab(page, 'Data')
  const [dl] = await Promise.all([page.waitForEvent('download'), click(page, /^Back up now/)])
  const path = join(OUT_DIR, 'audit-backup.json')
  await dl.saveAs(path)
  return path
}

/** @type {Array<{id: string, datasets?: string[], run?: (page: any) => Promise<void>, route?: (page: any) => Promise<void>, custom?: boolean}>} */
export const STATES = [
  { id: 'home', datasets: ['rich', 'empty'], run: async (page) => { await settle(page) } },
  { id: 'home-resume', datasets: ['rich'], run: async (page) => { await click(page, 'Start session'); await page.getByRole('dialog', { name: 'Session runner' }).waitFor(); await click(page, 'Leave'); await page.getByRole('region', { name: 'Unfinished session' }).waitFor() } },
  { id: 'home-discard-dialog', datasets: ['rich'], run: async (page) => { await click(page, 'Start session'); await page.getByRole('dialog', { name: 'Session runner' }).waitFor(); await click(page, 'Leave'); await page.getByRole('region', { name: 'Unfinished session' }).waitFor(); await click(page, 'Discard'); await dialogOpen(page) } },
  { id: 'settings', datasets: ['rich', 'empty'], run: async (page) => { await click(page, 'Settings', { exact: true }); await heading(page, 'Settings and help'); await settle(page) } },

  { id: 'train-programs', datasets: ['rich', 'empty'], run: async (page) => { await sub(page, 'Programs') } },
  { id: 'train-program-holistic', run: async (page) => { await openProgram(page, 'Holistic Phase 2') } },
  { id: 'train-program-set-position', run: async (page) => { await openProgram(page, 'Holistic Phase 2'); await click(page, 'Set position') } },
  { id: 'train-program-pressure-loop', run: async (page) => { await openProgram(page, 'Pressure Loop') } },
  { id: 'train-program-original', run: async (page) => { await openProgram(page, 'Loop and Transition') } },
  { id: 'train-sessions', datasets: ['rich', 'empty'], run: async (page) => { await sub(page, 'Sessions') } },
  { id: 'train-drills', datasets: ['rich', 'empty'], run: async (page) => { await sub(page, 'Drills') } },
  { id: 'train-drill-detail', run: async (page) => { await openDrill(page, 'Pure Repetition Loop') } },
  { id: 'train-drill-archive-dialog', run: async (page) => { await openDrill(page, 'Pure Repetition Loop'); await click(page, /^Archive drill/); await dialogOpen(page) } },
  { id: 'train-drill-reset-dialog', run: async (page) => { await openDrill(page, 'Pure Repetition Loop'); await click(page, /^Reset to original drill/); await dialogOpen(page) } },
  { id: 'train-guides', datasets: ['rich', 'empty'], run: async (page) => { await sub(page, 'Guides') } },

  { id: 'editor-drill-new', run: async (page) => { await sub(page, 'Drills'); await click(page, 'New drill'); await heading(page, 'New drill') } },
  { id: 'editor-drill-benchmark', run: async (page) => { await sub(page, 'Drills'); await click(page, 'New drill'); await heading(page, 'New drill'); await click(page, 'Add a benchmark') } },
  { id: 'editor-drill-edit', run: async (page) => { await openDrill(page, 'My custom wrist drill'); await click(page, /^Edit drill/); await heading(page, 'Edit drill') } },
  { id: 'editor-drill-discard-dialog', run: async (page) => { await sub(page, 'Drills'); await click(page, 'New drill'); await heading(page, 'New drill'); await page.getByLabel('Name').fill('Half typed'); await click(page, 'Close'); await dialogOpen(page) } },
  { id: 'editor-session-new', run: async (page) => { await sub(page, 'Sessions'); await click(page, 'New session'); await heading(page, 'New session') } },
  { id: 'editor-session-picker', run: async (page) => { await sub(page, 'Sessions'); await click(page, 'New session'); await heading(page, 'New session'); await click(page, 'Add a drill'); await heading(page, 'Pick a drill to add') } },
  { id: 'editor-session-edit', run: async (page) => { await sub(page, 'Sessions'); await click(page, /^Edit session/); await heading(page, 'Edit session'); await settle(page) } },
  { id: 'editor-program-new', run: async (page) => { await sub(page, 'Programs'); await click(page, 'New program'); await heading(page, 'New program'); await settle(page) } },
  { id: 'editor-program-edit', run: async (page) => { await openProgram(page, 'Holistic Phase 2'); await click(page, /^Edit program/); await heading(page, 'Edit program'); await settle(page) } },

  { id: 'progress', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Progress'); await settle(page) } },
  { id: 'progress-4-weeks', run: async (page) => { await goTab(page, 'Progress'); await click(page, '4 weeks'); await settle(page) } },
  { id: 'progress-all', run: async (page) => { await goTab(page, 'Progress'); await click(page, 'All'); await settle(page) } },
  { id: 'matches', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Matches'); await settle(page) } },
  { id: 'match-form-new', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Matches'); await click(page, 'Log a match'); await heading(page, 'Log a match'); await settle(page) } },
  { id: 'match-form-errors', run: async (page) => { await goTab(page, 'Matches'); await click(page, 'Log a match'); await heading(page, 'Log a match'); await click(page, 'Save match'); await page.getByRole('alert').first().waitFor() } },
  { id: 'match-form-edit', run: async (page) => { await goTab(page, 'Matches'); await page.getByRole('list', { name: /Matches, newest first/ }).getByRole('button').first().click(); await heading(page, 'Edit match'); await settle(page) } },
  { id: 'match-delete-dialog', run: async (page) => { await goTab(page, 'Matches'); await page.getByRole('list', { name: /Matches, newest first/ }).getByRole('button').first().click(); await heading(page, 'Edit match'); await click(page, 'Delete match'); await dialogOpen(page) } },
  { id: 'block-review', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Matches'); await click(page, 'Open Block Review'); await heading(page, 'Block Review'); await settle(page) } },

  { id: 'data', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Data'); await settle(page) } },
  { id: 'data-summary', datasets: ['rich', 'empty'], run: async (page) => { await goTab(page, 'Data'); await click(page, 'Copy summary for Claude', { exact: true }); await settle(page); await page.getByText(/Summary|Copied|Copying/).first().waitFor() } },
  { id: 'data-restore-preview', datasets: ['rich'], run: async (page) => { const f = await backupFile(page); await page.locator('input[type=file]').setInputFiles(f); await page.getByRole('region', { name: 'Backup preview' }).waitFor() } },
  { id: 'data-restore-replace-selected', datasets: ['rich'], run: async (page) => { const f = await backupFile(page); await page.locator('input[type=file]').setInputFiles(f); await page.getByRole('region', { name: 'Backup preview' }).waitFor(); await page.getByRole('radio', { name: /Replace/ }).check() } },
  { id: 'data-restore-replace-dialog', datasets: ['rich'], run: async (page) => { const f = await backupFile(page); await page.locator('input[type=file]').setInputFiles(f); await page.getByRole('region', { name: 'Backup preview' }).waitFor(); await page.getByRole('radio', { name: /Replace/ }).check(); await click(page, /^Replace my data/); await dialogOpen(page) } },
  { id: 'data-restore-merge-done', datasets: ['rich'], run: async (page) => { const f = await backupFile(page); await page.locator('input[type=file]').setInputFiles(f); await page.getByRole('region', { name: 'Backup preview' }).waitFor(); await click(page, 'Merge backup into this phone'); await page.getByRole('region', { name: 'Restore result' }).waitFor() } },
  { id: 'data-restore-refused', datasets: ['rich'], run: async (page) => { await goTab(page, 'Data'); await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ not json') }); await page.getByText('This file was not restored').waitFor() } },

  { id: 'quicklog-choose', datasets: ['rich', 'empty'], run: async (page) => { await click(page, 'Quick log'); await heading(page, 'Quick log'); await settle(page) } },
  { id: 'quicklog-empty-form', datasets: ['rich', 'empty'], run: async (page) => { await click(page, 'Quick log'); await click(page, 'Pick drills myself'); await settle(page) } },
  { id: 'quicklog-picker', run: async (page) => { await click(page, 'Quick log'); await click(page, 'Pick drills myself'); await click(page, 'Add a drill'); await heading(page, 'Pick a drill to add') } },
  { id: 'quicklog-form-template', datasets: ['rich', 'empty'], run: async (page) => { await click(page, 'Quick log'); await page.getByRole('list', { name: 'Session templates' }).getByRole('button', { name: /Original Phase 1 Session/ }).click(); await page.getByRole('heading', { level: 2, name: 'Session', exact: true }).waitFor() } },
  { id: 'quicklog-discard-dialog', run: async (page) => { await click(page, 'Quick log'); await page.getByRole('list', { name: 'Session templates' }).getByRole('button', { name: /Original Phase 1 Session/ }).click(); await page.getByRole('heading', { level: 2, name: 'Session', exact: true }).waitFor(); await click(page, 'Hit'); await click(page, 'Close'); await dialogOpen(page) } },
  { id: 'all-sessions', datasets: ['rich'], run: async (page) => { await click(page, 'All sessions'); await heading(page, 'All sessions'); await settle(page) } },
  { id: 'session-detail', run: async (page) => { await firstSession(page) } },
  { id: 'session-edit', run: async (page) => { await firstSession(page); await click(page, 'Edit', { exact: true }); await heading(page, 'Edit session'); await settle(page) } },
  { id: 'session-delete-dialog', run: async (page) => { await firstSession(page); await click(page, 'Delete', { exact: true }); await dialogOpen(page) } },
  { id: 'undo-toast', run: async (page) => { await firstSession(page); await click(page, 'Delete', { exact: true }); await dialogOpen(page); await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(); await page.getByText('Session deleted.').waitFor(); await settle(page) } },

  { id: 'runner-duration', datasets: ['rich', 'empty'], run: async (page) => { await startNow(page, 'Holistic A: Pressure Loop and Recognition') } },
  { id: 'runner-streak', datasets: ['rich', 'empty'], run: async (page) => { await startNow(page, 'Holistic A: Pressure Loop and Recognition'); await click(page, 'Next') ; await settle(page) } },
  { id: 'runner-score', datasets: ['rich', 'empty'], run: async (page) => { await startNow(page, 'Holistic A: Pressure Loop and Recognition'); await click(page, 'Next'); await click(page, 'Next'); await settle(page) } },
  { id: 'runner-summary', datasets: ['rich', 'empty'], run: async (page) => { await startNow(page, 'Holistic A: Pressure Loop and Recognition'); await click(page, 'Finish early'); await page.getByRole('heading', { name: 'Finish session' }).waitFor() } },
  { id: 'runner-rating', run: async (page) => { await startNow(page, 'Holistic B: Serve, Receive, Third Ball'); await page.getByRole('radiogroup', { name: 'Rating 1 to 5' }).waitFor() } },
  { id: 'runner-hits', datasets: ['rich', 'empty'], run: async (page) => { await startNow(page, 'Original Phase 1 Session'); await click(page, 'Hit', { exact: true }); await click(page, 'Hit', { exact: true }); await click(page, 'Miss', { exact: true }) } },
  { id: 'runner-timer-running', run: async (page) => { await startNow(page, 'Original Phase 1 Session'); await click(page, 'Start timer') ; await settle(page) } },
  { id: 'runner-discard-dialog', run: async (page) => { await startNow(page, 'Original Phase 1 Session'); await click(page, 'Discard', { exact: true }); await dialogOpen(page) } },
  { id: 'runner-conflict', run: async (page) => { await startNow(page, 'Original Phase 1 Session'); await click(page, 'Leave'); await sub(page, 'Sessions'); await btn(page, 'Start now: Holistic A: Pressure Loop and Recognition').click(); await heading(page, 'Unfinished session') } },

  {
    id: 'lazy-loading', datasets: ['rich'],
    route: async (page) => { await page.route('**/assets/Progress-*.js', async (r) => { await new Promise((res) => setTimeout(res, 4000)); await r.continue() }) },
    run: async (page) => { await tabBar(page).getByRole('button', { name: 'Progress', exact: true }).click(); await page.getByText('Loading Progress').waitFor() },
  },
  {
    id: 'lazy-error', datasets: ['rich'],
    route: async (page) => { await page.route('**/assets/Data-*.js', (r) => r.abort()) },
    run: async (page) => { await tabBar(page).getByRole('button', { name: 'Data', exact: true }).click(); await page.getByRole('heading', { name: 'Data could not be opened' }).waitFor() },
  },
]

export function statesFor(dataset) {
  return STATES.filter((s) => (s.datasets ?? ['rich']).includes(dataset))
}
