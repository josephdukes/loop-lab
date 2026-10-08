import { afterEach, expect, it } from 'vitest'
import Dexie from 'dexie'
import { LoopLabDb } from './db'
import { loadSettings, updateSettings } from './settings'
import { CONTENT_VERSION } from '../content/builtinContent'

const name = 'settingstest'
afterEach(async () => { await Dexie.delete(name) })

it('creates spec defaults on first load and keeps edits', async () => {
  const db = new LoopLabDb(name)
  const s = await loadSettings(db)
  expect(s).toMatchObject({
    weeklyTarget: 3, theme: 'dark', timerSound: true, timerVibrate: true,
    backupReminderDays: 14, summaryWeeks: 4, contentVersion: CONTENT_VERSION,
  })
  expect(s.lastBackupAt).toBeUndefined()
  await updateSettings(db, { theme: 'light', weeklyTarget: 4 })
  const again = await loadSettings(db)
  expect(again.theme).toBe('light')
  expect(again.weeklyTarget).toBe(4)
  expect(await db.settings.count()).toBe(1)
  db.close()
})
