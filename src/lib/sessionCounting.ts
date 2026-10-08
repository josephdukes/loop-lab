// Spec 3.2: which saved sessions count, and bucketing sessions into Monday-start weeks.
import type { SessionKind } from '../db/types'
import { weekStartOf } from './dates'

export interface SessionForCounting {
  id: string
  date: string
  kind: SessionKind
  drillLogCount: number
}

export interface WeekCounts {
  /** Robot sessions that count toward the weekly target. */
  robot: number
  /** Club sessions, shown separately ("club sessions this week"). */
  club: number
}

/** A robot session counts only if it has at least one drill log. Club sessions never count. */
export function countsTowardTarget(s: Pick<SessionForCounting, 'kind' | 'drillLogCount'>): boolean {
  return s.kind === 'robot' && s.drillLogCount >= 1
}

/** Map of week start (Monday) to counts. Weeks without any session are absent. */
export function bucketByWeek(sessions: SessionForCounting[]): Map<string, WeekCounts> {
  const out = new Map<string, WeekCounts>()
  for (const s of sessions) {
    const key = weekStartOf(s.date)
    const c = out.get(key) ?? { robot: 0, club: 0 }
    if (s.kind === 'club') c.club++
    else if (countsTowardTarget(s)) c.robot++
    out.set(key, c)
  }
  return out
}
