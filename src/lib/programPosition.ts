// Spec 3.7 and 3.8: where a program run is, phases, and the calendar badge. Pure functions, no database.
import { daysBetween } from './dates'

export interface ProgramShape {
  sessionsPerWeek: number
  weekCount: number
  repeating: boolean
  cycleLengthWeeks?: number
}

export interface ProgramPosition {
  /** Zero-based index of the next session (completed + manual offset, never below 0). */
  index: number
  week: number
  session: number
  cycleNumber: number
  /** True when a non-repeating program has no sessions left. Week/session then show the last ones. */
  finished: boolean
}

function cycleWeeks(p: ProgramShape): number {
  const w = p.cycleLengthWeeks ?? p.weekCount
  return Math.max(1, Math.min(w, p.weekCount))
}

/** Sessions in one pass through the program (one cycle for repeating programs). */
export function sessionsPerCycle(p: ProgramShape): number {
  return cycleWeeks(p) * p.sessionsPerWeek
}

export function totalIndex(completed: number, manualOffset: number): number {
  return Math.max(0, completed + manualOffset)
}

/**
 * Week = floor(index / sessionsPerWeek) + 1, session = (index mod sessionsPerWeek) + 1.
 * Repeating programs roll into the next cycle (cycleNumber + 1) after the last week.
 * Non-repeating programs are finished after the last session.
 */
export function positionAt(p: ProgramShape, index: number): ProgramPosition {
  const spw = p.sessionsPerWeek
  const perCycle = sessionsPerCycle(p)
  if (p.repeating) {
    const cycleIdx = Math.floor(index / perCycle)
    const within = index % perCycle
    return {
      index,
      week: Math.floor(within / spw) + 1,
      session: (within % spw) + 1,
      cycleNumber: cycleIdx + 1,
      finished: false,
    }
  }
  if (index >= perCycle) {
    return { index, week: cycleWeeks(p), session: spw, cycleNumber: 1, finished: true }
  }
  return { index, week: Math.floor(index / spw) + 1, session: (index % spw) + 1, cycleNumber: 1, finished: false }
}

export function positionFor(p: ProgramShape, completed: number, manualOffset: number): ProgramPosition {
  return positionAt(p, totalIndex(completed, manualOffset))
}

/** The manualOffsetSessions that puts the run at the given week and session (and cycle, for repeating programs). */
export function offsetForPosition(p: ProgramShape, completed: number, week: number, session: number, cycleNumber = 1): number {
  const w = Math.min(Math.max(1, week), cycleWeeks(p))
  const s = Math.min(Math.max(1, session), p.sessionsPerWeek)
  const cycleBase = p.repeating ? (Math.max(1, cycleNumber) - 1) * sessionsPerCycle(p) : 0
  return cycleBase + (w - 1) * p.sessionsPerWeek + (s - 1) - completed
}

// --- phases ----------------------------------------------------------------------------------

export interface PhaseRange {
  startWeek: number
  endWeek: number
  title: string
}

/** A phase is a run of consecutive weeks with the same title (P1: weeks 1-3, 4-6, 7-9, 10-12). */
export function phasesOf(weeks: Array<{ weekNumber: number; title: string }>): PhaseRange[] {
  const out: PhaseRange[] = []
  for (const w of [...weeks].sort((a, b) => a.weekNumber - b.weekNumber)) {
    const last = out[out.length - 1]
    if (last && last.title === w.title && last.endWeek === w.weekNumber - 1) last.endWeek = w.weekNumber
    else out.push({ startWeek: w.weekNumber, endWeek: w.weekNumber, title: w.title })
  }
  return out
}

export function phaseOfWeek(phases: PhaseRange[], week: number): PhaseRange | null {
  return phases.find((p) => week >= p.startWeek && week <= p.endWeek) ?? null
}

/** A phase of at least this many weeks can trigger "Consider repeating this phase". */
export const REPEAT_PHASE_WEEKS = 3

/**
 * The phase the run has just left (the last completed session was in it, the next session is not),
 * if it lasted at least 3 weeks. `currentWeek` is null when the program is finished.
 * The caller then checks whether that phase's benchmarks were met.
 */
export function phaseJustFinished(phases: PhaseRange[], lastCompletedWeek: number | null, currentWeek: number | null): PhaseRange | null {
  if (lastCompletedWeek === null) return null
  const prev = phaseOfWeek(phases, lastCompletedWeek)
  if (!prev) return null
  const cur = currentWeek === null ? null : phaseOfWeek(phases, currentWeek)
  if (cur && cur.startWeek === prev.startWeek) return null
  return prev.endWeek - prev.startWeek + 1 >= REPEAT_PHASE_WEEKS ? prev : null
}

/** "Ready to move on?" : every benchmarked drill meets its benchmark (and there is at least one). */
export function readyToMoveOn(statuses: Array<'met' | 'not_met' | 'no_data'>): boolean {
  return statuses.length > 0 && statuses.every((s) => s === 'met')
}

// --- calendar badge --------------------------------------------------------------------------

export type ScheduleBadge = { state: 'ahead' | 'on_track' | 'behind'; by: number }

/**
 * Compares the position (sessions done plus offset) with the calendar since startDate.
 * Calendar week c (0-based) expects c * sessionsPerWeek sessions done at its start and (c + 1) * sessionsPerWeek at its end.
 * Fewer than the start figure is "behind by N sessions"; more than the end figure is "ahead by N sessions".
 */
export function scheduleBadge(startDate: string, today: string, sessionsPerWeek: number, index: number): ScheduleBadge {
  const days = Math.max(0, daysBetween(startDate, today))
  const c = Math.floor(days / 7)
  const low = c * sessionsPerWeek
  const high = (c + 1) * sessionsPerWeek
  if (index < low) return { state: 'behind', by: low - index }
  if (index > high) return { state: 'ahead', by: index - high }
  return { state: 'on_track', by: 0 }
}
