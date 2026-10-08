// Data for the Home screen and the session lists.
import type { LoopLabDb } from '../db/db'
import type { SessionLog } from '../db/types'
import { weekStartOf } from './dates'
import { behindOnTargetText } from './behindTarget'
import { bucketByWeek, type SessionForCounting } from './sessionCounting'
import { computeStreaks, type StreakResult } from './streak'
import { getActiveRun } from './programRuns'
import { loadRunView, type RunView } from './runView'

export interface SessionRow {
  session: SessionLog
  drillCount: number
}

export interface HomeData {
  robotThisWeek: number
  clubThisWeek: number
  streak: StreakResult
  recent: SessionRow[]
  runView: RunView | null
  hasActiveSession: boolean
  /** Plain-English behind-on-target line, or null when the banner should not show (spec 8). */
  behindText: string | null
}

/** All sessions, newest first, with their drill-log counts. */
export async function loadSessionRows(db: LoopLabDb): Promise<SessionRow[]> {
  const [sessions, logs] = await Promise.all([db.sessionLogs.toArray(), db.drillLogs.toArray()])
  const counts = new Map<string, number>()
  for (const l of logs) counts.set(l.sessionId, (counts.get(l.sessionId) ?? 0) + 1)
  return sessions
    .map((session) => ({ session, drillCount: counts.get(session.id) ?? 0 }))
    .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.createdAt.localeCompare(a.session.createdAt))
}

export async function loadHome(db: LoopLabDb, today: string, weeklyTarget: number): Promise<HomeData> {
  const rows = await loadSessionRows(db)
  const forCounting: SessionForCounting[] = rows.map((r) => ({ id: r.session.id, date: r.session.date, kind: r.session.kind, drillLogCount: r.drillCount }))
  const weeks = bucketByWeek(forCounting)
  const thisWeek = weeks.get(weekStartOf(today)) ?? { robot: 0, club: 0 }
  const flags = await db.weekFlags.toArray()
  const streak = computeStreaks({
    robotByWeek: new Map([...weeks].map(([k, v]) => [k, v.robot])),
    restWeeks: new Set(flags.filter((f) => f.isRest).map((f) => f.weekStart)),
    target: weeklyTarget,
    today,
  })
  const run = await getActiveRun(db)
  const isRestWeek = flags.some((f) => f.isRest && f.weekStart === weekStartOf(today))
  return {
    robotThisWeek: thisWeek.robot,
    clubThisWeek: thisWeek.club,
    streak,
    recent: rows.slice(0, 5),
    runView: run ? await loadRunView(db, run, today) : null,
    hasActiveSession: !!(await db.activeSession.get('active')),
    behindText: behindOnTargetText({ today, isRestWeek, robotThisWeek: thisWeek.robot, weeklyTarget }),
  }
}
