import type { LoopLabDb } from './db'
import type { Settings } from './types'
import { nowIso } from '../lib/id'
import { CONTENT_VERSION } from '../content/builtinContent'

export function defaultSettings(): Settings {
  const now = nowIso()
  return {
    key: 'settings',
    weeklyTarget: 3,
    theme: 'dark',
    timerSound: true,
    timerVibrate: true,
    backupReminderDays: 14,
    summaryWeeks: 4,
    contentVersion: CONTENT_VERSION,
    createdAt: now,
    updatedAt: now,
  }
}

/** Reads the settings record, creating it with defaults on first run. */
export async function loadSettings(db: LoopLabDb): Promise<Settings> {
  const existing = await db.settings.get('settings')
  if (existing) return existing
  const fresh = defaultSettings()
  await db.settings.put(fresh)
  return fresh
}

export async function updateSettings(db: LoopLabDb, patch: Partial<Omit<Settings, 'key' | 'createdAt'>>): Promise<Settings> {
  // One transaction, so quick successive changes (two taps on +1) cannot overwrite each other.
  return db.transaction('rw', db.settings, async () => {
    const current = await loadSettings(db)
    const next: Settings = { ...current, ...patch, updatedAt: nowIso() }
    await db.settings.put(next)
    return next
  })
}
