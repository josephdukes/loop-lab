// Building the runner state for a new session from a template, optionally from a program run (spec 5).
import type { LoopLabDb } from '../db/db'
import type { Drill, SessionKind } from '../db/types'
import { newId, nowIso } from './id'
import { todayLocal } from './dates'
import { positionFor } from './programPosition'
import { programShape, resolveItems, resolveSlot, byId } from './slots'
import { createRunnerDrill, createRunnerState, type RunnerState } from './runnerState'
import { completedSessionsInRun } from './programRuns'

/** A new session from a template ("Start now"). Not attached to any run. */
export async function buildStateFromTemplate(db: LoopLabDb, templateId: string, now = new Date()): Promise<RunnerState> {
  const template = await db.sessionTemplates.get(templateId)
  if (!template) throw new Error('That session template no longer exists.')
  const drills = byId(await db.drills.toArray())
  const items = resolveItems(template, drills)
  if (items.length === 0) throw new Error('That session has no drills.')
  return createRunnerState({
    startedAt: nowIso(),
    date: todayLocal(now),
    kind: template.kind,
    templateId: template.id,
    templateName: template.name,
    drills: items.map((it) => createRunnerDrill({ key: newId(), drill: it.drill, benchmark: it.benchmark, note: it.note, durationMin: it.durationMin })),
  })
}

/** The next session of a program run, with the slot's benchmark overrides, attached to the run. */
export async function buildStateFromRun(db: LoopLabDb, runId: string, now = new Date()): Promise<RunnerState> {
  const run = await db.programRuns.get(runId)
  const program = run && (await db.programs.get(run.programId))
  if (!run || !program) throw new Error('That program run no longer exists.')
  const completed = await completedSessionsInRun(db, run.id)
  const pos = positionFor(programShape(program), completed, run.manualOffsetSessions)
  if (pos.finished) throw new Error('This program is finished. Use Set position to go back, or start it again.')
  const slotDef = program.weeks.find((w) => w.weekNumber === pos.week)?.sessions[pos.session - 1]
  if (!slotDef) throw new Error('Could not find the next session in this program.')
  const [templates, drills] = await Promise.all([db.sessionTemplates.toArray(), db.drills.toArray()])
  const slot = resolveSlot(slotDef, byId(templates), byId(drills))
  if (!slot || slot.items.length === 0) throw new Error('The next session has no drills (its template may have been removed).')
  return createRunnerState({
    startedAt: nowIso(),
    date: todayLocal(now),
    kind: slot.kind,
    templateId: slot.templateId,
    templateName: slot.templateName,
    programRunId: run.id,
    programWeek: pos.week,
    programCycle: pos.cycleNumber,
    sessionLabel: slot.label,
    drills: slot.items.map((it) => createRunnerDrill({ key: newId(), drill: it.drill, benchmark: it.benchmark, note: it.note, durationMin: it.durationMin })),
  })
}

/** An empty quick-log form, optionally pre-filled from a template. */
export async function buildQuickLogState(db: LoopLabDb, opts: { templateId?: string; kind?: SessionKind }, now = new Date()): Promise<RunnerState> {
  if (opts.templateId) return buildStateFromTemplate(db, opts.templateId, now)
  return createRunnerState({ startedAt: nowIso(), date: todayLocal(now), kind: opts.kind ?? 'robot', drills: [] })
}

export function drillToRunnerDrill(drill: Drill) {
  return createRunnerDrill({ key: newId(), drill })
}
