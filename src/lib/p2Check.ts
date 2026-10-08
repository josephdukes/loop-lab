// The Pressure Loop (P2) end-of-week-2 check, assembled from data (spec A.4, P2).
import type { LoopLabDb } from '../db/db'
import type { MatchLog, ProgramRun, SessionLog } from '../db/types'
import { daysBetween } from './dates'
import { totalIndex } from './programPosition'

export interface P2Check {
  /** Best pl-streak result logged in the run's sessions. */
  bestStreak: number | null
  matchesSinceStart: number
  loopAttempts: number
  confidence: { value: number; source: 'match' | 'session' } | null
}

/** Pure part. Matches must already be filtered to those on or after the run's start date. */
export function buildP2Check(streaks: number[], matchesSinceStart: MatchLog[], runSessions: SessionLog[]): P2Check {
  const latestMatch = matchesSinceStart.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
  const withConfidence = runSessions
    .filter((s) => s.loopConfidence !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  let confidence: P2Check['confidence'] = null
  if (latestMatch) confidence = { value: latestMatch.confidence, source: 'match' }
  else if (withConfidence[0]) confidence = { value: withConfidence[0].loopConfidence as number, source: 'session' }
  return {
    bestStreak: streaks.length ? Math.max(...streaks) : null,
    matchesSinceStart: matchesSinceStart.length,
    loopAttempts: matchesSinceStart.reduce((s, m) => s + (m.loopsAttempted ?? 0), 0),
    confidence,
  }
}

/** The run has completed its second week once it has done (or been set past) two weeks of sessions. */
export function secondWeekDone(completed: number, manualOffset: number, sessionsPerWeek: number): boolean {
  return totalIndex(completed, manualOffset) >= 2 * sessionsPerWeek
}

/** Home shows the card for this many days after the run's last session. */
export const P2_HOME_DAYS = 14

export interface P2CheckData {
  run: ProgramRun
  reached: boolean
  check: P2Check
  /** Date of the run's last session (or its start date). */
  lastActivity: string
}

/** The most recent run of the built-in Pressure Loop program (builtInKey "P2"), if any. */
export async function loadP2Check(db: LoopLabDb): Promise<P2CheckData | null> {
  const program = (await db.programs.toArray()).find((p) => p.builtInKey === 'P2')
  if (!program) return null
  const run = (await db.programRuns.where('programId').equals(program.id).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!run) return null
  const sessions = await db.sessionLogs.where('programRunId').equals(run.id).toArray()
  const reached = secondWeekDone(sessions.length, run.manualOffsetSessions, program.sessionsPerWeek)
  const streakDrill = (await db.drills.toArray()).find((d) => d.builtInKey === 'pl-streak')
  const streaks: number[] = []
  if (streakDrill) {
    const sessionIds = new Set(sessions.map((s) => s.id))
    for (const l of await db.drillLogs.where('drillId').equals(streakDrill.id).toArray()) {
      if (sessionIds.has(l.sessionId) && l.streak !== undefined) streaks.push(l.streak)
    }
  }
  const matches = (await db.matchLogs.toArray()).filter((m) => m.date >= run.startDate)
  const lastActivity = sessions.map((s) => s.date).sort().pop() ?? run.startDate
  return { run, reached, check: buildP2Check(streaks, matches, sessions), lastActivity }
}

export function showP2OnHome(d: P2CheckData | null, today: string): boolean {
  return !!d && d.reached && daysBetween(d.lastActivity, today) <= P2_HOME_DAYS
}
