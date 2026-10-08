import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSeededDb } from '../../test/helpers'
import { addSession } from '../../test/fixtures'
import { DAY_MS, SNOOZE_DAYS, backupBannerDue, loadDataTimestamps } from './backupBanner'
import { updateSettings } from '../../db/settings'
import { saveItem } from '../libraryService'
import { drillByKey } from '../../test/fixtures'
import { seedBuiltInContent } from '../../content/seed'
import type { Drill } from '../../db/types'

const h = useSeededDb()
afterEach(() => { vi.useRealTimers() })

const iso = (d: Date) => d.toISOString()
const T0 = new Date('2026-10-07T12:00:00Z')
const daysAgo = (n: number) => iso(new Date(T0.getTime() - n * DAY_MS))

describe('backup banner rule', () => {
  const base = { now: T0, reminderDays: 14 }

  it('shows when the last backup is older than the reminder period AND there is newer data', () => {
    expect(backupBannerDue({ ...base, lastBackupAt: daysAgo(15), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(1) })).toBe(true)
  })
  it('hides when the backup is recent, even with newer data', () => {
    expect(backupBannerDue({ ...base, lastBackupAt: daysAgo(13), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(1) })).toBe(false)
    expect(backupBannerDue({ ...base, lastBackupAt: daysAgo(14), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(1) })).toBe(false) // exactly 14 days is not "older than"
  })
  it('hides when the backup is old but nothing has changed since', () => {
    expect(backupBannerDue({ ...base, lastBackupAt: daysAgo(30), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(31) })).toBe(false)
  })
  it('never backed up: measured from the oldest record', () => {
    expect(backupBannerDue({ ...base, oldestDataAt: daysAgo(15), newestChangeAt: daysAgo(15) })).toBe(true)
    expect(backupBannerDue({ ...base, oldestDataAt: daysAgo(3), newestChangeAt: daysAgo(1) })).toBe(false)
  })
  it('hides when there is no data at all', () => {
    expect(backupBannerDue({ ...base })).toBe(false)
  })
  it('follows the reminder setting', () => {
    const i = { now: T0, lastBackupAt: daysAgo(10), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(1) }
    expect(backupBannerDue({ ...i, reminderDays: 14 })).toBe(false)
    expect(backupBannerDue({ ...i, reminderDays: 7 })).toBe(true)
  })
  it('"Remind me later" hides it until the snooze ends', () => {
    const i = { ...base, lastBackupAt: daysAgo(30), oldestDataAt: daysAgo(60), newestChangeAt: daysAgo(1) }
    expect(backupBannerDue({ ...i, snoozedUntil: iso(new Date(T0.getTime() + SNOOZE_DAYS * DAY_MS)) })).toBe(false)
    expect(backupBannerDue({ ...i, snoozedUntil: iso(new Date(T0.getTime() - 1000)) })).toBe(true)
  })
})

describe('backup banner with the database and a faked clock', () => {
  it('appears once the clock is moved more than 14 days past the last backup, after new data was saved', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-01T09:00:00Z'))
    const db = await h.create()
    await addSession(db, { date: '2026-09-01' }) // fixtures stamp their own times; real writes below use the fake clock
    await updateSettings(db, { lastBackupAt: new Date().toISOString() }) // backed up "today"

    const check = async () => {
      const t = await loadDataTimestamps(db)
      const s = (await db.settings.get('settings'))!
      return backupBannerDue({ now: new Date(), lastBackupAt: s.lastBackupAt, reminderDays: s.backupReminderDays, ...t, snoozedUntil: s.backupSnoozedUntil })
    }
    // Save a custom drill 3 days later (new data since the backup).
    vi.setSystemTime(new Date('2026-09-04T09:00:00Z'))
    const base = await drillByKey(db, 'orig-A')
    const custom: Drill = { ...base, id: 'custom-1', builtInKey: undefined, name: 'Mine', isBuiltIn: false, modifiedByUser: false, source: 'custom', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await saveItem(db, 'drill', custom)

    expect(await check()).toBe(false) // 3 days after the backup
    vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    expect(await check()).toBe(false) // 13 days
    vi.setSystemTime(new Date('2026-09-16T09:00:00Z'))
    expect(await check()).toBe(true) // 15 days, and new data since the backup
    // Backing up again clears it.
    await updateSettings(db, { lastBackupAt: new Date().toISOString() })
    expect(await check()).toBe(false)
  })

  it('does not count built-in content that the app seeded or refreshed as new data', async () => {
    const db = await h.create()
    const t = await loadDataTimestamps(db)
    expect(t.oldestDataAt).toBeUndefined() // a freshly seeded app has no data of its own
    await seedBuiltInContent(db)
    expect((await loadDataTimestamps(db)).oldestDataAt).toBeUndefined()
  })
})
