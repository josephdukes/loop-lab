// The Home backup banner rule (spec 5): show when the last backup is older than the reminder period
// AND there is data created or updated since that backup. With no backup yet, age is measured from the oldest record.
import type { LoopLabDb } from '../../db/db'

export const DAY_MS = 86_400_000
/** "Remind me later" hides the banner for this long. */
export const SNOOZE_DAYS = 2

export interface BannerInput {
  now: Date
  lastBackupAt?: string
  reminderDays: number
  /** createdAt of the oldest record that is Joe's data; undefined when there is none. */
  oldestDataAt?: string
  /** Latest createdAt or updatedAt among Joe's data. */
  newestChangeAt?: string
  snoozedUntil?: string
}

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN)

export function backupBannerDue(i: BannerInput): boolean {
  if (i.oldestDataAt === undefined || Number.isNaN(ms(i.oldestDataAt))) return false // nothing to lose yet
  const now = i.now.getTime()
  if (!Number.isNaN(ms(i.snoozedUntil)) && now < ms(i.snoozedUntil)) return false
  const last = ms(i.lastBackupAt)
  const hasBackup = !Number.isNaN(last)
  const reference = hasBackup ? last : ms(i.oldestDataAt)
  if (now - reference <= i.reminderDays * DAY_MS) return false
  if (!hasBackup) return true
  const newest = ms(i.newestChangeAt)
  return !Number.isNaN(newest) && newest > last
}

export interface DataTimestamps { oldestDataAt?: string; newestChangeAt?: string }

interface Stamped { createdAt: string; updatedAt: string }

/**
 * Looks at Joe's own data: sessions, drill logs, matches, block reviews, rest weeks, program runs, and drills,
 * templates and programs that he created, edited or archived. Built-in content that was only seeded or updated by
 * the app does not count, and neither do the settings.
 */
export async function loadDataTimestamps(db: LoopLabDb): Promise<DataTimestamps> {
  const stamps: Stamped[] = []
  const add = (rows: Stamped[]) => { for (const r of rows) stamps.push(r) }
  const [sessions, drillLogs, matches, reviews, flags, runs] = await Promise.all([
    db.sessionLogs.toArray(), db.drillLogs.toArray(), db.matchLogs.toArray(), db.blockReviews.toArray(), db.weekFlags.toArray(), db.programRuns.toArray(),
  ])
  add(sessions); add(drillLogs); add(matches); add(reviews); add(flags); add(runs)
  const mine = (r: { isBuiltIn: boolean; modifiedByUser: boolean; archived: boolean } & Stamped) => !r.isBuiltIn || r.modifiedByUser || r.archived
  add((await db.drills.toArray()).filter(mine))
  add((await db.sessionTemplates.toArray()).filter(mine))
  add((await db.programs.toArray()).filter(mine))
  let oldest: string | undefined
  let newest: string | undefined
  for (const s of stamps) {
    if (oldest === undefined || s.createdAt < oldest) oldest = s.createdAt
    const changed = s.updatedAt > s.createdAt ? s.updatedAt : s.createdAt
    if (newest === undefined || changed > newest) newest = changed
  }
  return { oldestDataAt: oldest, newestChangeAt: newest }
}
