// Program list and detail data: each program with its most relevant run and current position.
import type { LoopLabDb } from '../db/db'
import type { Drill, Program, ProgramRun, SessionTemplate } from '../db/types'
import { positionFor, scheduleBadge, totalIndex, type ProgramPosition, type ScheduleBadge } from './programPosition'
import { byId, programShape } from './slots'
import { completedSessionsInRun } from './programRuns'

export interface ProgramSummary {
  program: Program
  /** The active or paused run if there is one, else the most recent completed run. */
  run?: ProgramRun
  completed: number
  position?: ProgramPosition
  badge?: ScheduleBadge
}

function pickRun(runs: ProgramRun[]): ProgramRun | undefined {
  const open = runs.filter((r) => r.status !== 'completed').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (open[0]) return open[0]
  return runs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export async function summariseProgram(db: LoopLabDb, program: Program, today: string): Promise<ProgramSummary> {
  const runs = await db.programRuns.where('programId').equals(program.id).toArray()
  const run = pickRun(runs)
  if (!run) return { program, completed: 0 }
  const completed = await completedSessionsInRun(db, run.id)
  const position = positionFor(programShape(program), completed, run.manualOffsetSessions)
  const badge = scheduleBadge(run.startDate, today, program.sessionsPerWeek, totalIndex(completed, run.manualOffsetSessions))
  return { program, run, completed, position, badge }
}

export async function loadProgramList(db: LoopLabDb, today: string, includeArchived = false): Promise<ProgramSummary[]> {
  const programs = (await db.programs.toArray()).filter((p) => includeArchived || !p.archived)
  const out = await Promise.all(programs.map((p) => summariseProgram(db, p, today)))
  return out.sort((a, b) => (a.program.builtInKey ?? 'zz').localeCompare(b.program.builtInKey ?? 'zz', undefined, { numeric: true }) || a.program.name.localeCompare(b.program.name))
}

export interface ProgramDetailData {
  summary: ProgramSummary
  templates: Map<string, SessionTemplate>
  drills: Map<string, Drill>
  /** Another program's active run, if any (starting this program would pause it). */
  otherActive?: { run: ProgramRun; programName: string }
}

export async function loadProgramDetail(db: LoopLabDb, programId: string, today: string): Promise<ProgramDetailData | null> {
  const program = await db.programs.get(programId)
  if (!program) return null
  const [summary, templates, drills, active] = await Promise.all([
    summariseProgram(db, program, today),
    db.sessionTemplates.toArray(),
    db.drills.toArray(),
    db.programRuns.where('status').equals('active').toArray(),
  ])
  const other = active.find((r) => r.programId !== programId)
  const otherProgram = other ? await db.programs.get(other.programId) : undefined
  return {
    summary,
    templates: byId(templates),
    drills: byId(drills),
    otherActive: other && otherProgram ? { run: other, programName: otherProgram.name } : undefined,
  }
}
