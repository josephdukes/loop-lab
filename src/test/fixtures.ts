// Direct database fixtures for stage 3 tests and the screenshot seeding: sessions, drill logs, matches.
import type { LoopLabDb } from '../db/db'
import type { DrillLog, MatchLog, SessionLog } from '../db/types'
import { newId } from '../lib/id'

export async function drillByKey(db: LoopLabDb, key: string) {
  const d = (await db.drills.toArray()).find((x) => x.builtInKey === key)
  if (!d) throw new Error('no drill ' + key)
  return d
}

export interface FixtureLog {
  drillKey: string
  hits?: number
  attempts?: number
  streak?: number
  rating?: number
  durationMin?: number
}

/** Adds a session with drill logs straight into the database (no run bookkeeping). */
export async function addSession(
  db: LoopLabDb,
  o: { date: string; kind?: 'robot' | 'club'; minutes?: number; loopConfidence?: number; effort?: number; runId?: string; week?: number; cycle?: number; logs?: FixtureLog[] },
): Promise<string> {
  const id = newId()
  const ts = `${o.date}T10:00:00.000Z`
  const session: SessionLog = {
    id, date: o.date, kind: o.kind ?? 'robot', totalMinutes: o.minutes ?? 30, notes: '', createdAt: ts, updatedAt: ts,
    ...(o.loopConfidence !== undefined ? { loopConfidence: o.loopConfidence } : {}),
    ...(o.effort !== undefined ? { effort: o.effort } : {}),
    ...(o.runId ? { programRunId: o.runId, programWeek: o.week ?? 1, programCycle: o.cycle ?? 1, sessionLabel: 'Session 1' } : {}),
  }
  await db.sessionLogs.add(session)
  let order = 1
  for (const l of o.logs ?? [{ drillKey: 'orig-A', hits: 8, attempts: 10, durationMin: 15 }]) {
    const d = await drillByKey(db, l.drillKey)
    const log: DrillLog = {
      id: newId(), sessionId: id, order: order++, drillId: d.id, drillNameSnapshot: d.name, categorySnapshot: d.category, metricType: d.metricType,
      ...(l.hits !== undefined ? { hits: l.hits } : {}), ...(l.attempts !== undefined ? { attempts: l.attempts } : {}),
      ...(l.streak !== undefined ? { streak: l.streak } : {}), ...(l.rating !== undefined ? { rating: l.rating } : {}),
      ...(l.durationMin !== undefined ? { durationMin: l.durationMin } : {}),
      createdAt: ts, updatedAt: ts,
    }
    await db.drillLogs.add(log)
  }
  return id
}

export async function addMatch(db: LoopLabDb, o: Partial<MatchLog> & { date: string }): Promise<string> {
  const id = newId()
  const ts = `${o.date}T20:00:00.000Z`
  await db.matchLogs.add({
    id, competition: 'league', opponentStyle: 'hitter', result: 'W', gamesScore: '3-1', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '',
    createdAt: ts, updatedAt: ts, ...o,
  })
  return id
}
