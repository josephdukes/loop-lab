// Loading a saved session back into editable form state (edit log).
import type { LoopLabDb } from '../db/db'
import type { Benchmark, DrillLog } from '../db/types'
import { newId } from './id'
import { createRunnerState, newTimer, type RunnerDrill, type RunnerState } from './runnerState'

function targetFromSnapshot(log: DrillLog): Benchmark | undefined {
  const t = log.targetSnapshot
  if (!t) return undefined
  return { metricType: log.metricType, threshold: t.value, minAttempts: t.minAttempts, consecutiveSessions: 1, description: t.description }
}

function drillFromLog(log: DrillLog, current: { description: string; suggestedSettings: string; cues: string } | undefined): RunnerDrill {
  return {
    key: newId(),
    drillId: log.drillId,
    name: log.drillNameSnapshot,
    category: log.categorySnapshot,
    metricType: log.metricType,
    description: current?.description ?? '',
    suggestedSettings: current?.suggestedSettings ?? '',
    cues: current?.cues ?? '',
    target: targetFromSnapshot(log),
    settingsUsed: log.robotSettingsUsed ?? '',
    hits: log.hits ?? 0,
    attempts: log.attempts ?? 0,
    streak: log.streak ?? 0,
    streakCurrent: 0,
    scoreYou: log.scoreYou ?? 0,
    scoreRobot: log.scoreRobot ?? 0,
    rating: log.rating ?? null,
    manualMinutes: log.durationMin ?? null,
    note: log.note ?? '',
    touched: true,
    skipped: false,
    timer: newTimer(0),
  }
}

export async function loadStateForEdit(db: LoopLabDb, sessionId: string): Promise<RunnerState> {
  const session = await db.sessionLogs.get(sessionId)
  if (!session) throw new Error('This session no longer exists.')
  const logs = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
  const drills = await db.drills.bulkGet(logs.map((l) => l.drillId))
  const state = createRunnerState({
    startedAt: session.startedAt ?? session.createdAt,
    date: session.date,
    kind: session.kind,
    templateId: session.templateId,
    templateName: session.templateNameSnapshot,
    programRunId: session.programRunId,
    programWeek: session.programWeek,
    programCycle: session.programCycle,
    sessionLabel: session.sessionLabel,
    drills: logs.map((l, i) => drillFromLog(l, drills[i] ?? undefined)),
  })
  return {
    ...state,
    summary: { effort: session.effort ?? null, loopConfidence: session.loopConfidence ?? null, notes: session.notes, totalMinutes: session.totalMinutes },
  }
}
