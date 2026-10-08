// Loads the raw data the Progress screen needs. All charting maths is in progressData.ts.
import type { LoopLabDb } from '../db/db'
import type { Drill } from '../db/types'
import { loadRestWeeks } from './weekFlags'
import type { DrillLogRow, SessionStat } from './progressData'

export interface ProgressRaw {
  sessions: SessionStat[]
  rows: DrillLogRow[]
  restWeeks: Set<string>
  drills: Drill[]
}

export async function loadProgressRaw(db: LoopLabDb): Promise<ProgressRaw> {
  const [sessionLogs, drillLogs, restWeeks, drills] = await Promise.all([
    db.sessionLogs.toArray(),
    db.drillLogs.toArray(),
    loadRestWeeks(db),
    db.drills.toArray(),
  ])
  const counts = new Map<string, number>()
  for (const l of drillLogs) counts.set(l.sessionId, (counts.get(l.sessionId) ?? 0) + 1)
  const sessions: SessionStat[] = sessionLogs.map((s) => ({
    id: s.id, date: s.date, kind: s.kind, totalMinutes: s.totalMinutes, loopConfidence: s.loopConfidence, drillCount: counts.get(s.id) ?? 0,
  }))
  const byId = new Map(sessionLogs.map((s) => [s.id, s]))
  const rows: DrillLogRow[] = []
  for (const log of drillLogs) {
    const s = byId.get(log.sessionId)
    if (s) rows.push({ log, date: s.date, at: s.startedAt ?? s.createdAt })
  }
  return { sessions, rows, restWeeks, drills }
}
