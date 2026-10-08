// Saving, editing, deleting (with undo) and loading sessions. All writes happen in one transaction.
import type { LoopLabDb } from '../db/db'
import type { Benchmark, DrillLog, SessionKind, SessionLog } from '../db/types'
import { benchmarkMetFor } from './benchmarks'
import { newId, nowIso } from './id'
import {
  drillMinutes,
  effectiveTotalMinutes,
  isRecorded,
  streakToSave,
  type RunnerDrill,
  type RunnerState,
} from './runnerState'
import { refreshRunProgress } from './programRuns'

export interface SessionDraft {
  date: string
  kind: SessionKind
  startedAt?: string
  endedAt?: string
  totalMinutes: number
  programRunId?: string
  programWeek?: number
  programCycle?: number
  sessionLabel?: string
  templateId?: string
  templateName?: string
  effort?: number
  loopConfidence?: number
  notes: string
  /** Only recorded drills; order follows the array. */
  drills: RunnerDrill[]
}

/** Turn runner/quick-log state into a draft that holds only drills with a result. */
export function draftFromState(state: RunnerState, opts: { now: number; startedAt?: string; endedAt?: string }): SessionDraft {
  const s = state.summary
  return {
    date: state.date,
    kind: state.kind,
    startedAt: opts.startedAt,
    endedAt: opts.endedAt,
    totalMinutes: effectiveTotalMinutes(state, opts.now),
    programRunId: state.programRunId,
    programWeek: state.programWeek,
    programCycle: state.programCycle,
    sessionLabel: state.sessionLabel,
    templateId: state.templateId,
    templateName: state.templateName,
    effort: s.effort ?? undefined,
    loopConfidence: s.loopConfidence ?? undefined,
    notes: s.notes.trim(),
    drills: state.drills.filter((d) => isRecorded(d, opts.now)),
  }
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

export function buildDrillLog(sessionId: string, order: number, d: RunnerDrill, now: number, ts: string): DrillLog {
  const base = {
    id: newId(),
    sessionId,
    order,
    drillId: d.drillId,
    drillNameSnapshot: d.name,
    categorySnapshot: d.category,
    metricType: d.metricType,
    robotSettingsUsed: d.settingsUsed.trim() || undefined,
    note: d.note.trim() || undefined,
    durationMin: drillMinutes(d, now),
    createdAt: ts,
    updatedAt: ts,
  }
  const metric: Partial<DrillLog> = {}
  switch (d.metricType) {
    case 'hits_attempts':
      metric.hits = d.hits
      metric.attempts = d.attempts
      break
    case 'streak':
      metric.streak = streakToSave(d)
      break
    case 'score_vs_robot':
      metric.scoreYou = d.scoreYou
      metric.scoreRobot = d.scoreRobot
      break
    case 'duration':
      metric.durationMin = d.manualMinutes ?? drillMinutes(d, now) ?? 0
      break
    case 'rating':
      metric.rating = d.rating ?? undefined
      break
  }
  const target: Benchmark | undefined = d.target
  const log = { ...base, ...metric } as DrillLog
  log.targetSnapshot = target ? { value: target.threshold, description: target.description, minAttempts: target.minAttempts } : undefined
  log.benchmarkMet = benchmarkMetFor(log, target)
  return clean(log)
}

export interface SaveResult {
  sessionId: string
  /** True when this was the very first saved session on this phone. */
  isFirst: boolean
}

/**
 * Saves a new session with its drill logs, clears the active session and (for runs) refreshes the
 * run's cycle and status. `onFirstSave` is the persistent-storage request hook: called once, after the
 * very first saved session.
 */
export async function saveSession(
  db: LoopLabDb,
  draft: SessionDraft,
  opts: { now?: number; onFirstSave?: () => void | Promise<unknown> } = {},
): Promise<SaveResult> {
  if (draft.drills.length === 0) throw new Error('Nothing to save: no drill has a result yet.')
  const now = opts.now ?? Date.now()
  const ts = nowIso()
  const sessionId = newId()
  const session: SessionLog = clean({
    id: sessionId,
    date: draft.date,
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
    totalMinutes: draft.totalMinutes,
    kind: draft.kind,
    programRunId: draft.programRunId,
    programWeek: draft.programWeek,
    programCycle: draft.programCycle,
    sessionLabel: draft.sessionLabel,
    templateId: draft.templateId,
    templateNameSnapshot: draft.templateName,
    effort: draft.effort,
    loopConfidence: draft.loopConfidence,
    notes: draft.notes,
    createdAt: ts,
    updatedAt: ts,
  })
  const logs = draft.drills.map((d, i) => buildDrillLog(sessionId, i + 1, d, now, ts))
  let isFirst = false
  await db.transaction('rw', [db.sessionLogs, db.drillLogs, db.activeSession, db.programRuns, db.programs], async () => {
    isFirst = (await db.sessionLogs.count()) === 0
    await db.sessionLogs.add(session)
    await db.drillLogs.bulkAdd(logs)
    await db.activeSession.delete('active')
    if (draft.programRunId) await refreshRunProgress(db, draft.programRunId)
  })
  if (isFirst && opts.onFirstSave) {
    try { await opts.onFirstSave() } catch { /* a refused request must not fail the save */ }
  }
  return { sessionId, isFirst }
}

/** Replace an existing session's fields and drill logs (edit). Keeps the id, createdAt and program attachment. */
export async function updateSession(db: LoopLabDb, sessionId: string, draft: SessionDraft, opts: { now?: number } = {}): Promise<void> {
  if (draft.drills.length === 0) throw new Error('Nothing to save: no drill has a result yet.')
  const now = opts.now ?? Date.now()
  const ts = nowIso()
  await db.transaction('rw', [db.sessionLogs, db.drillLogs, db.programRuns, db.programs], async () => {
    const old = await db.sessionLogs.get(sessionId)
    if (!old) throw new Error('This session no longer exists.')
    const next: SessionLog = clean({
      ...old,
      date: draft.date,
      kind: draft.kind,
      totalMinutes: draft.totalMinutes,
      effort: draft.effort,
      loopConfidence: draft.loopConfidence,
      notes: draft.notes,
      updatedAt: ts,
    })
    await db.sessionLogs.put(next)
    // Keep drill-log ids stable across edits (so a later Merge restore of an older backup matches by id):
    // reuse the id of the existing log with the same drillId and order, then any unused log with the same drillId.
    const existing = await db.drillLogs.where('sessionId').equals(sessionId).toArray()
    const unused = new Set(existing.map((l) => l.id))
    const byId = new Map(existing.map((l) => [l.id, l]))
    const pick = (match: (l: DrillLog) => boolean) => existing.find((l) => unused.has(l.id) && match(l))
    const rows = draft.drills.map((d, i) => {
      const order = i + 1
      const reuse = pick((l) => l.drillId === d.drillId && l.order === order) ?? pick((l) => l.drillId === d.drillId)
      const log = buildDrillLog(sessionId, order, d, now, ts)
      if (!reuse) return log
      unused.delete(reuse.id)
      return { ...log, id: reuse.id, createdAt: byId.get(reuse.id)!.createdAt }
    })
    if (unused.size) await db.drillLogs.bulkDelete([...unused])
    await db.drillLogs.bulkPut(rows)
  })
}

export interface DeletedSession {
  session: SessionLog
  drillLogs: DrillLog[]
}

/** Deletes a session and its drill logs; keep the result to offer Undo. */
export async function deleteSession(db: LoopLabDb, sessionId: string): Promise<DeletedSession | null> {
  let snapshot: DeletedSession | null = null
  await db.transaction('rw', [db.sessionLogs, db.drillLogs, db.programRuns, db.programs], async () => {
    const session = await db.sessionLogs.get(sessionId)
    if (!session) return
    const drillLogs = await db.drillLogs.where('sessionId').equals(sessionId).toArray()
    await db.drillLogs.where('sessionId').equals(sessionId).delete()
    await db.sessionLogs.delete(sessionId)
    snapshot = { session, drillLogs }
    if (session.programRunId) await refreshRunProgress(db, session.programRunId)
  })
  return snapshot
}

export async function restoreSession(db: LoopLabDb, snapshot: DeletedSession): Promise<void> {
  await db.transaction('rw', [db.sessionLogs, db.drillLogs, db.programRuns, db.programs], async () => {
    await db.sessionLogs.put(snapshot.session)
    await db.drillLogs.bulkPut(snapshot.drillLogs)
    if (snapshot.session.programRunId) await refreshRunProgress(db, snapshot.session.programRunId)
  })
}
