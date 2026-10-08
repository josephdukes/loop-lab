// Program runs (spec 3.7): start, pause, resume, set position, and keeping cycle/status in step with saved sessions.
import type { LoopLabDb } from '../db/db'
import type { Program, ProgramRun } from '../db/types'
import { newId, nowIso } from './id'
import { offsetForPosition, positionFor } from './programPosition'
import { programShape } from './slots'

/** A session counts as completed for a run when it is saved with that run attached. */
export async function completedSessionsInRun(db: LoopLabDb, runId: string): Promise<number> {
  return db.sessionLogs.where('programRunId').equals(runId).count()
}

export async function getActiveRun(db: LoopLabDb): Promise<ProgramRun | undefined> {
  const runs = await db.programRuns.where('status').equals('active').toArray()
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return runs[0]
}

/** Creates an active run starting today. Any other active run is paused (one active run at a time). */
export async function startProgramRun(db: LoopLabDb, program: Program, today: string): Promise<ProgramRun> {
  const ts = nowIso()
  const run: ProgramRun = {
    id: newId(),
    programId: program.id,
    startDate: today,
    status: 'active',
    manualOffsetSessions: 0,
    cycleNumber: 1,
    createdAt: ts,
    updatedAt: ts,
  }
  await db.transaction('rw', db.programRuns, async () => {
    const active = await db.programRuns.where('status').equals('active').toArray()
    for (const r of active) await db.programRuns.put({ ...r, status: 'paused', updatedAt: ts })
    await db.programRuns.add(run)
  })
  return run
}

export async function pauseRun(db: LoopLabDb, runId: string): Promise<void> {
  const run = await db.programRuns.get(runId)
  if (run && run.status === 'active') await db.programRuns.put({ ...run, status: 'paused', updatedAt: nowIso() })
}

/** Resuming makes this run the active one; another active run is paused. */
export async function resumeRun(db: LoopLabDb, runId: string): Promise<void> {
  const ts = nowIso()
  await db.transaction('rw', db.programRuns, async () => {
    const run = await db.programRuns.get(runId)
    if (!run || run.status !== 'paused') return
    const active = await db.programRuns.where('status').equals('active').toArray()
    for (const r of active) await db.programRuns.put({ ...r, status: 'paused', updatedAt: ts })
    await db.programRuns.put({ ...run, status: 'active', updatedAt: ts })
  })
}

/** "Set position": stores manualOffsetSessions so the run lands on the chosen week and session. */
export async function setRunPosition(db: LoopLabDb, runId: string, week: number, session: number, cycleNumber = 1): Promise<void> {
  await db.transaction('rw', [db.programRuns, db.programs, db.sessionLogs], async () => {
    const run = await db.programRuns.get(runId)
    const program = run && (await db.programs.get(run.programId))
    if (!run || !program) throw new Error('This program run no longer exists.')
    const shape = programShape(program)
    const completed = await completedSessionsInRun(db, runId)
    const offset = offsetForPosition(shape, completed, week, session, cycleNumber)
    await db.programRuns.put({ ...run, manualOffsetSessions: offset, updatedAt: nowIso() })
    await refreshRunProgress(db, runId)
  })
}

/**
 * Brings cycleNumber and status in line with the position: a non-repeating run that has used all its
 * sessions becomes completed; a completed run moved back becomes active again. Paused runs stay paused.
 * Call inside a transaction that includes programRuns, programs and sessionLogs.
 */
export async function refreshRunProgress(db: LoopLabDb, runId: string): Promise<void> {
  const run = await db.programRuns.get(runId)
  if (!run) return
  const program = await db.programs.get(run.programId)
  if (!program) return
  const completed = await completedSessionsInRun(db, runId)
  const pos = positionFor(programShape(program), completed, run.manualOffsetSessions)
  let status = run.status
  if (pos.finished) status = 'completed'
  else if (run.status === 'completed') status = 'active'
  if (status !== run.status || pos.cycleNumber !== run.cycleNumber) {
    await db.programRuns.put({ ...run, status, cycleNumber: pos.cycleNumber, updatedAt: nowIso() })
  }
}
