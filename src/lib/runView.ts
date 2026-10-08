// Everything the UI needs to show a program run: position, next-up session, calendar badge,
// "Ready to move on?" and "Consider repeating this phase" (spec 3.7). Reads the database, no writing.
import type { LoopLabDb } from '../db/db'
import type { Benchmark, Drill, DrillLog, Program, ProgramRun, SessionLog, SessionTemplate } from '../db/types'
import { evaluateBoard, type BoardResult } from './benchmarks'
import {
  phaseJustFinished,
  phaseOfWeek,
  phasesOf,
  positionAt,
  positionFor,
  readyToMoveOn,
  scheduleBadge,
  totalIndex,
  type PhaseRange,
  type ProgramPosition,
  type ScheduleBadge,
} from './programPosition'
import { byId, programShape, resolveSlot, type ResolvedSlot } from './slots'

export interface BenchmarkEntry {
  drill: Drill
  benchmark: Benchmark
  slotLabel: string
  board: BoardResult
}

export interface RunView {
  run: ProgramRun
  program: Program
  completed: number
  position: ProgramPosition
  /** The next session to do, or null when a non-repeating program is finished. */
  nextUp: ResolvedSlot | null
  badge: ScheduleBadge
  /** Benchmark results for the current week's sessions. */
  weekEntries: BenchmarkEntry[]
  ready: boolean
  /** Set when the run has just left a 3+ week phase whose benchmarks were not all met. */
  repeatPhase: { phase: PhaseRange; entries: BenchmarkEntry[] } | null
}

function chronological(a: SessionLog, b: SessionLog): number {
  return a.date.localeCompare(b.date) || (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt)
}

/** Benchmark entries for the given weeks of a program, evaluated on the run's logs for those weeks and cycle. */
function entriesForWeeks(
  program: Program,
  weeks: number[],
  cycle: number,
  templates: Map<string, SessionTemplate>,
  drills: Map<string, Drill>,
  runSessions: SessionLog[],
  logsByDrill: Map<string, Array<{ log: DrillLog; session: SessionLog }>>,
): BenchmarkEntry[] {
  const seen = new Set<string>()
  const out: BenchmarkEntry[] = []
  const sessionIds = new Set(
    runSessions.filter((s) => s.programWeek !== undefined && weeks.includes(s.programWeek) && (s.programCycle ?? 1) === cycle).map((s) => s.id),
  )
  for (const week of program.weeks.filter((w) => weeks.includes(w.weekNumber))) {
    for (const slot of week.sessions) {
      const resolved = resolveSlot(slot, templates, drills)
      if (!resolved) continue
      for (const item of resolved.items) {
        if (!item.benchmark) continue
        const key = `${item.drill.id}|${item.benchmark.threshold}|${item.benchmark.consecutiveSessions}`
        if (seen.has(key)) continue
        seen.add(key)
        const logs = (logsByDrill.get(item.drill.id) ?? [])
          .filter((x) => sessionIds.has(x.session.id))
          .sort((a, b) => chronological(a.session, b.session) || a.log.order - b.log.order)
          .map((x) => x.log)
        out.push({ drill: item.drill, benchmark: item.benchmark, slotLabel: resolved.label, board: evaluateBoard(logs, item.benchmark) })
      }
    }
  }
  return out
}

export async function loadRunView(db: LoopLabDb, run: ProgramRun, today: string): Promise<RunView | null> {
  const program = await db.programs.get(run.programId)
  if (!program) return null
  const [templateRows, drillRows, runSessions] = await Promise.all([
    db.sessionTemplates.toArray(),
    db.drills.toArray(),
    db.sessionLogs.where('programRunId').equals(run.id).toArray(),
  ])
  const templates = byId(templateRows)
  const drills = byId(drillRows)
  const shape = programShape(program)
  const completed = runSessions.length
  const position = positionFor(shape, completed, run.manualOffsetSessions)
  const index = totalIndex(completed, run.manualOffsetSessions)

  const weekDef = program.weeks.find((w) => w.weekNumber === position.week)
  const slotDef = weekDef?.sessions[position.session - 1]
  const nextUp = !position.finished && slotDef ? resolveSlot(slotDef, templates, drills) : null

  // Drill logs of this run's sessions, grouped by drill.
  const sessionById = byId(runSessions)
  const logsByDrill = new Map<string, Array<{ log: DrillLog; session: SessionLog }>>()
  for (const s of runSessions) {
    for (const log of await db.drillLogs.where('sessionId').equals(s.id).toArray()) {
      const list = logsByDrill.get(log.drillId) ?? []
      list.push({ log, session: sessionById.get(log.sessionId) as SessionLog })
      logsByDrill.set(log.drillId, list)
    }
  }

  const weekEntries = position.finished
    ? []
    : entriesForWeeks(program, [position.week], position.cycleNumber, templates, drills, runSessions, logsByDrill)
  const ready = readyToMoveOn(weekEntries.map((e) => e.board.status))

  let repeatPhase: RunView['repeatPhase'] = null
  if (index > 0) {
    const prevPos = positionAt(shape, index - 1)
    const phases = phasesOf(program.weeks)
    const finishedPhase = phaseJustFinished(phases, prevPos.week, position.finished ? null : position.week)
    if (finishedPhase && phaseOfWeek(phases, prevPos.week)) {
      const weeks = Array.from({ length: finishedPhase.endWeek - finishedPhase.startWeek + 1 }, (_, i) => finishedPhase.startWeek + i)
      const entries = entriesForWeeks(program, weeks, prevPos.cycleNumber, templates, drills, runSessions, logsByDrill)
      if (entries.length > 0 && !readyToMoveOn(entries.map((e) => e.board.status))) repeatPhase = { phase: finishedPhase, entries }
    }
  }

  return {
    run,
    program,
    completed,
    position,
    nextUp,
    badge: scheduleBadge(run.startDate, today, program.sessionsPerWeek, index),
    weekEntries,
    ready,
    repeatPhase,
  }
}
