import type { LoopLabDb } from '../db/db'
import { addDays, weekStartOf } from './dates'

export interface WeekProgress {
  weekStart: string
  robotSessions: number
  clubSessions: number
}

/**
 * Sessions saved in the week containing `today` (spec 3.2): a robot session counts only if it has
 * at least one drill log; club sessions are counted separately.
 */
export async function weekProgressFor(db: LoopLabDb, today: string): Promise<WeekProgress> {
  const weekStart = weekStartOf(today)
  const weekEnd = addDays(weekStart, 6)
  const sessions = await db.sessionLogs.where('date').between(weekStart, weekEnd, true, true).toArray()
  let robotSessions = 0
  let clubSessions = 0
  for (const s of sessions) {
    if (s.kind === 'club') {
      clubSessions++
    } else if ((await db.drillLogs.where('sessionId').equals(s.id).count()) > 0) {
      robotSessions++
    }
  }
  return { weekStart, robotSessions, clubSessions }
}
