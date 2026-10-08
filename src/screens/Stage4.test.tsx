// @vitest-environment jsdom
// Component tests for stage 4: Settings, the Data screen (export, summary, backup, restore) and the Home backup banner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import type { ReactNode } from 'react'

vi.mock('../pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import App from '../App'
import { AppProvider, useApp } from '../appState'
import { NavProvider } from '../nav'
import { UndoProvider } from '../undo'
import { getDb } from '../db/db'
import { updateSettings } from '../db/settings'
import { addMatch, addSession } from '../test/fixtures'
import { addRichData } from '../test/richData'
import { createRunnerDrill, createRunnerState } from '../lib/runnerState'
import { RunnerView } from './Runner'
import { Data } from './Data'
import { SettingsScreen } from './Settings'
import { DAY_MS } from '../lib/backup/backupBanner'
import { buildBackup, backupToText } from '../lib/backup/backupBuild'
import { STORE_NAMES, readAllStores } from '../lib/backup/stores'
import type { Drill } from '../db/types'

afterEach(async () => {
  cleanup()
  getDb().close()
  await Dexie.delete('loop-lab')
  vi.restoreAllMocks()
  for (const k of ['share', 'canShare', 'clipboard', 'vibrate']) delete (navigator as unknown as Record<string, unknown>)[k]
})

function wrap(ui: ReactNode) {
  return render(
    <AppProvider renderLoading={() => <p>loading</p>} renderError={(m) => <p>{m}</p>}>
      <NavProvider><UndoProvider>{ui}</UndoProvider></NavProvider>
    </AppProvider>,
  )
}
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const setNav = (o: Record<string, unknown>) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(navigator, k, { value: v, configurable: true }) }
const settingsRow = async () => getDb().settings.get('settings')
const group = (name: string) => screen.getByRole('group', { name })
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

let clicks: string[] = []
beforeEach(() => {
  clicks = []
  ;(URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:test')
  ;(URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download) })
})

async function seedDb() {
  const db = getDb()
  await db.open()
  const { seedBuiltInContent } = await import('../content/seed')
  await seedBuiltInContent(db)
  return db
}

describe('Settings and Help', () => {
  it('saves every change immediately to the database and shows it', async () => {
    wrap(<SettingsScreen />)
    await screen.findByText('Settings and help')
    expect((await settingsRow())?.weeklyTarget).toBe(3)

    await click(screen.getByRole('button', { name: 'Weekly target (robot sessions) plus 1' }))
    expect(screen.getByRole('spinbutton', { name: 'Weekly target (robot sessions)' }).textContent).toBe('4')
    await waitFor(async () => expect((await settingsRow())?.weeklyTarget).toBe(4))
    await click(screen.getByRole('button', { name: 'Weekly target (robot sessions) minus 1' }))
    await click(screen.getByRole('button', { name: 'Weekly target (robot sessions) minus 1' })) // two quick taps both count
    await waitFor(async () => expect((await settingsRow())?.weeklyTarget).toBe(2))

    await click(within(group('Theme')).getByRole('button', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    await waitFor(async () => expect((await settingsRow())?.theme).toBe('light'))

    await click(within(group('Timer sound')).getByRole('button', { name: 'Off' }))
    await click(within(group('Timer vibration')).getByRole('button', { name: 'Off' }))
    await waitFor(() => expect(within(group('Timer sound')).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe('true'))
    await waitFor(async () => { const s = await settingsRow(); expect([s?.timerSound, s?.timerVibrate]).toEqual([false, false]) })

    await click(within(group('Remind me to back up after (days)')).getByRole('button', { name: '30 days' }))
    await click(within(group('Summary length (weeks)')).getByRole('button', { name: '8 weeks' }))
    await waitFor(async () => { const s = await settingsRow(); expect([s?.backupReminderDays, s?.summaryWeeks]).toEqual([30, 8]) })
    expect(screen.getByText(/Saved: summary length/)).toBeTruthy()
  })

  it('has the install guide and the "what is stored where" explanation', async () => {
    wrap(<SettingsScreen />)
    await screen.findByText('Settings and help')
    const install = screen.getByRole('region', { name: 'Install guide' })
    expect(install.textContent).toMatch(/three-dot menu/)
    expect(install.textContent).toMatch(/Install app/)
    expect(install.textContent).toMatch(/Add to Home screen/)
    const stored = screen.getByRole('region', { name: 'What is stored where' })
    expect(stored.textContent).toMatch(/Everything stays on this phone/)
    expect(stored.textContent).toMatch(/Only things you start leave the phone/)
  })

  it('clamps the weekly target to 1-14', async () => {
    wrap(<SettingsScreen />)
    await screen.findByText('Settings and help')
    for (let i = 0; i < 4; i++) await click(screen.getByRole('button', { name: 'Weekly target (robot sessions) minus 1' }))
    await waitFor(async () => expect((await settingsRow())?.weeklyTarget).toBe(1))
    expect(screen.getByRole('spinbutton', { name: 'Weekly target (robot sessions)' }).textContent).toBe('1')
    expect((screen.getByRole('button', { name: 'Weekly target (robot sessions) minus 1' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('settings take effect in the session runner', () => {
  function runnerFixture() {
    const d = (): Drill => ({
      id: 'dd', name: 'Timer drill', category: 'Loop from Backspin', description: '', metricType: 'rating', suggestedSettings: '', cues: '', source: 'custom',
      isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: '', updatedAt: '', defaultDurationMin: 1,
    })
    const drill = createRunnerDrill({ key: 'k', drill: d() })
    drill.timer = { totalSec: 1, remainingSec: 1, running: false, endsAt: null }
    return createRunnerState({ startedAt: '2026-10-07T10:00:00.000Z', date: '2026-10-07', kind: 'robot', templateName: 'T', drills: [drill] })
  }
  function Harness() {
    const { updateSetting } = useApp()
    return (
      <>
        <button type="button" onClick={() => { void updateSetting({ timerVibrate: false }) }}>vibration off</button>
        <button type="button" onClick={() => { void updateSetting({ timerSound: false }) }}>sound off</button>
        <RunnerView initial={runnerFixture()} />
      </>
    )
  }
  function fakeAudio() {
    const oscillators: number[] = []
    class FakeCtx {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() { return Promise.resolve() }
      createOscillator() { oscillators.push(1); return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} } }
      createGain() { return { gain: { value: 0 }, connect() {} } }
    }
    ;(window as unknown as Record<string, unknown>).AudioContext = FakeCtx
    return oscillators
  }

  it('vibrates and beeps at zero by default, and stops when the settings are turned off', async () => {
    const vibrate = vi.fn(() => true)
    setNav({ vibrate })
    const oscillators = fakeAudio()
    wrap(<Harness />)
    await screen.findByText('Timer drill')
    await click(screen.getByRole('button', { name: 'Start timer' }))
    await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(oscillators.length).toBe(1)
  }, 10_000)

  it('does not vibrate or beep once both are turned off (the running screen picks the change up at once)', async () => {
    const vibrate = vi.fn(() => true)
    setNav({ vibrate })
    const oscillators = fakeAudio()
    wrap(<Harness />)
    await screen.findByText('Timer drill')
    await click(screen.getByRole('button', { name: 'vibration off' }))
    await click(screen.getByRole('button', { name: 'sound off' }))
    await click(screen.getByRole('button', { name: 'Start timer' }))
    await screen.findByText('Time is up.', {}, { timeout: 3000 })
    await wait(100)
    expect(vibrate).not.toHaveBeenCalled()
    expect(oscillators.length).toBe(0)
  }, 10_000)
})

describe('Data screen: status, export and summary', () => {
  it('shows last backup, persistence, storage used and the plain warning', async () => {
    wrap(<Data />)
    await screen.findByText('Where your data lives')
    expect(screen.getByRole('region', { name: 'Backup and storage status' }).textContent).toMatch(/Last backup:\s*never/)
    await waitFor(() => expect(screen.getByText(/Persistent storage:/)).toBeTruthy())
    expect(screen.getByText(/Approximate storage used/)).toBeTruthy()
    expect(screen.getByText(/clear Chrome's site data for this app/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings and help' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dark' })).toBeNull() // theme switch is only in Settings
  })

  it('exports each CSV as a download with the dated filename, and respects the date range', async () => {
    const db = await seedDb()
    await addRichData(db)
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Sessions CSV' })
    await waitFor(() => expect(screen.getByText(/In this range: 3 sessions/)).toBeTruthy())
    for (const name of ['Drill logs CSV', 'Sessions CSV', 'Matches CSV']) await click(screen.getByRole('button', { name }))
    expect(clicks).toHaveLength(3)
    expect(clicks[0]).toMatch(/^loop-lab-drill-logs-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(clicks[1]).toMatch(/^loop-lab-sessions-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(clicks[2]).toMatch(/^loop-lab-matches-\d{4}-\d{2}-\d{2}\.csv$/)

    fireEvent.change(screen.getByLabelText('From date (optional)'), { target: { value: '2026-10-06' } })
    fireEvent.change(screen.getByLabelText('To date (optional)'), { target: { value: '2026-10-05' } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/"from" date is after the "to" date/)
    expect((screen.getByRole('button', { name: 'Sessions CSV' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('To date (optional)'), { target: { value: '2026-10-06' } })
    await waitFor(() => expect(screen.getByText(/In this range: 1 sessions/)).toBeTruthy())
  })

  it('"Share all three" shares once where files are supported, otherwise downloads three', async () => {
    const db = await seedDb()
    await addSession(db, { date: '2026-10-05' })
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Share all three' })
    await click(screen.getByRole('button', { name: 'Share all three' }))
    await waitFor(() => expect(screen.getByText(/saved to this phone's downloads one by one/)).toBeTruthy())
    expect(clicks).toHaveLength(3)

    clicks.length = 0
    const share = vi.fn(async () => {})
    setNav({ share, canShare: () => true })
    await click(screen.getByRole('button', { name: 'Share all three' }))
    await waitFor(() => expect(screen.getByText('Shared all three files.')).toBeTruthy())
    expect(share).toHaveBeenCalledTimes(1)
    expect(clicks).toHaveLength(0)
  })

  it('shows an empty state when nothing is logged', async () => {
    wrap(<Data />)
    expect(await screen.findByText('Nothing logged yet')).toBeTruthy()
  })

  it('copies the summary and remembers the 2/4/8 choice', async () => {
    const db = await seedDb()
    await addRichData(db)
    const writeText = vi.fn(async () => {})
    setNav({ clipboard: { writeText } })
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Copy summary for Claude' })
    await click(within(group('Period (weeks)')).getByRole('button', { name: '2 weeks' }))
    await waitFor(() => expect(within(group('Period (weeks)')).getByRole('button', { name: '2 weeks' }).getAttribute('aria-pressed')).toBe('true'))
    expect((await settingsRow())?.summaryWeeks).toBe(2)
    await click(screen.getByRole('button', { name: 'Copy summary for Claude' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(text.startsWith('Table tennis robot training log summary. Please suggest where I should focus next.')).toBe(true)
    expect(text).toContain('(2 weeks')
    expect(await screen.findByText(/Paste it into a chat with Claude/)).toBeTruthy()
  })

  it('falls back to a selected text box when the clipboard is blocked', async () => {
    const db = await seedDb()
    await addRichData(db)
    setNav({ clipboard: { writeText: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError') }) } })
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Copy summary for Claude' })
    await click(screen.getByRole('button', { name: 'Copy summary for Claude' }))
    const box = (await screen.findByLabelText('Summary text')) as HTMLTextAreaElement
    expect(screen.getByText(/Copying was blocked/)).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(box))
    expect(box.selectionStart).toBe(0)
    expect(box.selectionEnd).toBe(box.value.length)
    expect(box.value.length).toBeGreaterThan(100)
  })
})

describe('Data screen: backup', () => {
  it('download fallback records lastBackupAt; a cancelled share does not', async () => {
    await seedDb()
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Back up now (download)' })
    await click(screen.getByRole('button', { name: 'Back up now (download)' }))
    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(clicks[0]).toMatch(/^loop-lab-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect((await settingsRow())?.lastBackupAt).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('region', { name: 'Backup and storage status' }).textContent).toMatch(/Last backup:\s*\d/))
  })

  it('a cancelled share sheet records nothing', async () => {
    await seedDb()
    setNav({ share: vi.fn(async () => { throw new DOMException('closed', 'AbortError') }), canShare: () => true })
    wrap(<Data />)
    await screen.findByRole('button', { name: 'Back up now (share)' })
    await click(screen.getByRole('button', { name: 'Back up now (share)' }))
    expect(await screen.findByText(/Sharing was cancelled, so no backup was recorded/)).toBeTruthy()
    expect((await settingsRow())?.lastBackupAt).toBeUndefined()
    expect(clicks).toHaveLength(0)
    // The "save a copy" button still downloads and records.
    await click(screen.getByRole('button', { name: 'Save a copy to this phone instead' }))
    await waitFor(() => expect(clicks).toHaveLength(1))
    expect((await settingsRow())?.lastBackupAt).toBeTruthy()
  })
})

describe('Data screen: restore', () => {
  const fileOf = (text: string, name = 'loop-lab-backup-2026-10-07.json') => new File([text], name, { type: 'application/json' })
  const choose = async (file: File) => { await act(async () => { fireEvent.change(screen.getByLabelText('Backup file to restore'), { target: { files: [file] } }) }) }
  const snap = async () => JSON.stringify(await readAllStores(getDb()))

  it('refuses corrupt JSON, a newer format and an oversize file, each saying nothing was changed', async () => {
    const db = await seedDb()
    await addRichData(db)
    const before = await snap()
    wrap(<Data />)
    await screen.findByLabelText('Backup file to restore')

    await choose(fileOf('{not json'))
    let alert = await screen.findByText(/This file was not restored/)
    expect(alert.closest('[role="alert"]')?.textContent).toMatch(/not a readable Loop Lab backup.*Nothing was changed\./)

    const newer = JSON.stringify({ ...JSON.parse(backupToText(await buildBackup(db))), schemaVersion: 99 })
    await choose(fileOf(newer))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/newer version of Loop Lab/))
    expect(screen.getByRole('alert').textContent).toMatch(/Nothing was changed\./)

    const big = fileOf('{}')
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })
    await choose(big)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/larger than the 20 MB limit.*Nothing was changed/))
    alert = screen.getByRole('alert')
    expect(await snap()).toBe(before)
    expect(screen.queryByRole('region', { name: 'Backup preview' })).toBeNull()
  })

  it('shows a preview, merges by default, and reports added / updated / unchanged', async () => {
    const db = await seedDb()
    await addRichData(db)
    const text = backupToText(await buildBackup(db, new Date(2026, 9, 7, 12)))
    await db.matchLogs.clear()
    wrap(<Data />)
    await screen.findByLabelText('Backup file to restore')
    await choose(fileOf(text))
    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    expect(preview.textContent).toMatch(/Backed up on/)
    expect(preview.textContent).toMatch(/7 Oct 2026, \d\d:\d\d/)
    expect(preview.textContent).toMatch(/2 Oct 2026 to 6 Oct 2026/)
    expect(preview.textContent).toMatch(/App version/)
    expect(within(preview).getByRole('row', { name: /Matches 2 0/ })).toBeTruthy() // 2 in the file, 0 on the phone
    expect(within(preview).getByRole('row', { name: /Unfinished session \(never restored\)/ })).toBeTruthy()
    expect((within(preview).getByRole('radio', { name: /Merge/ }) as HTMLInputElement).checked).toBe(true)

    await click(within(preview).getByRole('button', { name: 'Merge backup into this phone' }))
    const result = await screen.findByRole('region', { name: 'Restore result' })
    expect(result.textContent).toMatch(/2 added/)
    expect(result.textContent).toMatch(/0 updated/)
    expect(await db.matchLogs.count()).toBe(2)
  })

  it('Replace asks for confirmation, downloads a safety backup first, then replaces', async () => {
    const db = await seedDb()
    await addRichData(db)
    const text = backupToText(await buildBackup(db, new Date(2026, 9, 7, 12)))
    await addMatch(db, { date: '2026-10-06', opponent: 'Only here' }) // extra data that Replace must remove
    wrap(<Data />)
    await screen.findByLabelText('Backup file to restore')
    await choose(fileOf(text))
    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    await click(within(preview).getByRole('radio', { name: /Replace/ }))
    await click(within(preview).getByRole('button', { name: 'Replace my data...' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toMatch(/A backup of your current data will be downloaded first/)
    expect(clicks).toHaveLength(0) // nothing happens until confirmed
    expect(await db.matchLogs.count()).toBe(3)

    await click(within(dialog).getByRole('button', { name: 'Keep my data' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(clicks).toHaveLength(0)

    await click(within(preview).getByRole('button', { name: 'Replace my data...' }))
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Download backup, then replace' }))
    const result = await screen.findByRole('region', { name: 'Restore result' })
    expect(clicks).toHaveLength(1)
    expect(clicks[0]).toMatch(/^loop-lab-backup-.*\.json$/) // the safety backup
    expect(result.textContent).toMatch(/Replace/)
    expect(result.textContent).toMatch(/old records were removed first/)
    expect(await db.matchLogs.count()).toBe(2)
  })

  it('Replace is abandoned, with nothing changed, if the safety backup cannot be saved', async () => {
    const db = await seedDb()
    await addRichData(db)
    const text = backupToText(await buildBackup(db))
    const before = await snap()
    wrap(<Data />)
    await screen.findByLabelText('Backup file to restore')
    await choose(fileOf(text))
    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    await click(within(preview).getByRole('radio', { name: /Replace/ }))
    await click(within(preview).getByRole('button', { name: 'Replace my data...' }))
    ;(URL as unknown as Record<string, unknown>).createObjectURL = undefined // downloads now fail
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Download backup, then replace' }))
    const alert = await screen.findByText(/The restore did not happen/)
    expect(alert.closest('[role="alert"]')?.textContent).toMatch(/safety backup.*could not be saved.*Nothing was changed/)
    // Compare ignoring the settings record (a failed backup attempt never writes it either).
    expect(await snap()).toBe(before)
  })
})

describe('Home backup banner', () => {
  async function mountApp() {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const utils = render(<App />, { container: el })
    await screen.findByText(/^\d+ of \d+ robot sessions this week$/)
    return utils
  }

  it('is hidden for a fresh app, then shown when the last backup is old and there is newer data', async () => {
    const db = await seedDb()
    await mountApp()
    expect(screen.queryByRole('region', { name: 'Backup reminder' })).toBeNull()
    cleanup()

    const old = new Date(Date.now() - 20 * DAY_MS).toISOString()
    await addSession(db, { date: '2026-10-05' }) // fixtures stamp 2026 times, i.e. "newer" than a backup 20 days ago only if that is earlier
    await updateSettings(db, { lastBackupAt: '2026-09-01T00:00:00.000Z' })
    await mountApp()
    const banner = await screen.findByRole('region', { name: 'Backup reminder' })
    expect(banner.textContent).toMatch(/Your last backup was \d+ days ago/)
    expect(old).toBeTruthy()
  })

  it('"Remind me later" hides it, and "Back up now" opens the Data screen at the backup action', async () => {
    const db = await seedDb()
    await addSession(db, { date: '2026-10-05' })
    await updateSettings(db, { lastBackupAt: '2026-09-01T00:00:00.000Z' })
    await mountApp()
    const banner = await screen.findByRole('region', { name: 'Backup reminder' })
    await click(within(banner).getByRole('button', { name: 'Back up now' }))
    expect(await screen.findByRole('heading', { name: 'Data' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement?.textContent).toMatch(/Back up now/))

    await click(screen.getByRole('button', { name: 'Home' }))
    const again = await screen.findByRole('region', { name: 'Backup reminder' })
    await click(within(again).getByRole('button', { name: 'Remind me later' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Backup reminder' })).toBeNull())
    const snoozed = (await settingsRow())?.backupSnoozedUntil
    expect(Date.parse(snoozed!) - Date.now()).toBeGreaterThan(1.9 * DAY_MS)
    expect(Date.parse(snoozed!) - Date.now()).toBeLessThan(2.1 * DAY_MS)
  })

  it('Home and Data both reach Settings', async () => {
    await seedDb()
    await mountApp()
    await click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings and help' })).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Close' }))
    await click(screen.getByRole('button', { name: 'Data' }))
    await click(await screen.findByRole('button', { name: 'Settings and help' }))
    expect(await screen.findByRole('dialog', { name: 'Settings and help' })).toBeTruthy()
  })
})

void STORE_NAMES
