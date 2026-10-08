// Block Review (spec 3.8): window, previous window, comparison, and saving a review record.
import type { LoopLabDb } from '../db/db'
import type { BlockReview, MatchLog, Program, ProgramRun } from '../db/types'
import { addDays, daysBetween } from './dates'
import { newId, nowIso } from './id'
import { averageConfidence, loopTotals } from './matchStats'

export interface DateWindow {
  start: string
  end: string
}

export const FALLBACK_WINDOW_DAYS = 28

export function windowDays(w: DateWindow): number {
  return daysBetween(w.start, w.end) + 1
}

/** The cycle's date span: first session of the cycle to today. Falls back to the last 28 days. */
export function reviewWindow(cycleSessionDates: string[], today: string): DateWindow & { fallback: boolean } {
  if (cycleSessionDates.length === 0) return { start: addDays(today, -(FALLBACK_WINDOW_DAYS - 1)), end: today, fallback: true }
  const first = [...cycleSessionDates].sort()[0]
  return { start: first > today ? today : first, end: today, fallback: false }
}

/** The window of equal length that ends the day before `w` starts. */
export function previousWindow(w: DateWindow): DateWindow {
  const len = windowDays(w)
  return { start: addDays(w.start, -len), end: addDays(w.start, -1) }
}

export interface WindowStats {
  matches: number
  loopsAttempted: number
  loopsLanded: number
  loopPercent: number | null
  averageConfidence: number | null
  /** Best streak logged on the Pressure Streak Game drill in the window. */
  bestStreak: number | null
}

export interface StreakPoint {
  date: string
  streak: number
}

export const inWindow = (date: string, w: DateWindow) => date >= w.start && date <= w.end

export function windowStats(matches: MatchLog[], streaks: StreakPoint[], w: DateWindow): WindowStats {
  const ms = matches.filter((m) => inWindow(m.date, w))
  const loops = loopTotals(ms)
  const inW = streaks.filter((s) => inWindow(s.date, w)).map((s) => s.streak)
  return {
    matches: ms.length,
    loopsAttempted: loops.attempted,
    loopsLanded: loops.landed,
    loopPercent: loops.percent,
    averageConfidence: averageConfidence(ms),
    bestStreak: inW.length ? Math.max(...inW) : null,
  }
}

export interface BlockComparison {
  window: DateWindow
  fallback: boolean
  previousWindow: DateWindow
  current: WindowStats
  previous: WindowStats
}

export function compareWindows(
  matches: MatchLog[],
  streaks: StreakPoint[],
  cycleSessionDates: string[],
  today: string,
): BlockComparison {
  const { fallback, ...window } = reviewWindow(cycleSessionDates, today)
  const prev = previousWindow(window)
  return { window, fallback, previousWindow: prev, current: windowStats(matches, streaks, window), previous: windowStats(matches, streaks, prev) }
}

/** Programs that have a Block Review: repeating with a cycle of two or more weeks (the Holistic program). */
export function hasBlockReview(p: Pick<Program, 'repeating' | 'cycleLengthWeeks' | 'weeks'>): boolean {
  return p.repeating && (p.cycleLengthWeeks ?? p.weeks.length) >= 2
}

/** The cycle to review: the run's current cycle if it has sessions, otherwise the one just finished. */
export function cycleToReview(run: Pick<ProgramRun, 'cycleNumber'>, sessionsByCycle: Map<number, string[]>): number | null {
  if ((sessionsByCycle.get(run.cycleNumber) ?? []).length > 0) return run.cycleNumber
  if (run.cycleNumber > 1 && (sessionsByCycle.get(run.cycleNumber - 1) ?? []).length > 0) return run.cycleNumber - 1
  return null
}

// --- database ---------------------------------------------------------------------------------------

export interface BlockReviewData {
  run?: ProgramRun
  program?: Program
  cycleNumber?: number
  comparison: BlockComparison
}

export async function loadBlockReviewData(db: LoopLabDb, runId: string | undefined, today: string): Promise<BlockReviewData> {
  const run = runId ? await db.programRuns.get(runId) : undefined
  const program = run ? await db.programs.get(run.programId) : undefined
  let cycleNumber: number | undefined
  let cycleDates: string[] = []
  if (run) {
    const sessions = await db.sessionLogs.where('programRunId').equals(run.id).toArray()
    const byCycle = new Map<number, string[]>()
    for (const s of sessions) {
      const c = s.programCycle ?? 1
      byCycle.set(c, [...(byCycle.get(c) ?? []), s.date])
    }
    cycleNumber = cycleToReview(run, byCycle) ?? undefined
    cycleDates = cycleNumber !== undefined ? byCycle.get(cycleNumber) ?? [] : []
  }
  const matches = await db.matchLogs.toArray()
  const streaks = await loadStreakPoints(db)
  return { run, program, cycleNumber, comparison: compareWindows(matches, streaks, cycleDates, today) }
}

/** Streaks logged on the Pressure Streak Game drill (builtInKey "pl-streak"), with their session dates. */
export async function loadStreakPoints(db: LoopLabDb): Promise<StreakPoint[]> {
  const drill = (await db.drills.toArray()).find((d) => d.builtInKey === 'pl-streak')
  if (!drill) return []
  const logs = await db.drillLogs.where('drillId').equals(drill.id).toArray()
  const sessions = await db.sessionLogs.bulkGet([...new Set(logs.map((l) => l.sessionId))])
  const dateOf = new Map(sessions.filter((s) => !!s).map((s) => [s!.id, s!.date]))
  const out: StreakPoint[] = []
  for (const l of logs) {
    const date = dateOf.get(l.sessionId)
    if (date && l.streak !== undefined) out.push({ date, streak: l.streak })
  }
  return out
}

export interface BlockReviewInput {
  runId?: string
  cycleNumber?: number
  window: DateWindow
  emphasisNotes: string
  today: string
}

export async function saveBlockReview(db: LoopLabDb, input: BlockReviewInput): Promise<BlockReview> {
  const ts = nowIso()
  const review: BlockReview = {
    id: newId(),
    ...(input.runId ? { programRunId: input.runId } : {}),
    ...(input.runId && input.cycleNumber !== undefined ? { cycleNumber: input.cycleNumber } : {}),
    date: input.today,
    windowStart: input.window.start,
    windowEnd: input.window.end,
    emphasisNotes: input.emphasisNotes.trim(),
    createdAt: ts,
    updatedAt: ts,
  }
  await db.blockReviews.add(review)
  return review
}

export async function loadBlockReviews(db: LoopLabDb): Promise<BlockReview[]> {
  return (await db.blockReviews.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** The run a Block Review should link to by default: the active run of a program that has one. */
export async function findReviewableRun(db: LoopLabDb): Promise<ProgramRun | undefined> {
  const runs = (await db.programRuns.where('status').equals('active').toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  for (const r of runs) {
    const p = await db.programs.get(r.programId)
    if (p && hasBlockReview(p)) return r
  }
  return undefined
}

export interface Change {
  direction: 'up' | 'down' | 'same' | 'none'
  text: string
}

/** Words for how a figure moved against the previous window ("none" when either side has no data). */
export function describeChange(current: number | null, previous: number | null, unit: string, decimals = 1): Change {
  if (current === null || previous === null) return { direction: 'none', text: 'Nothing to compare yet' }
  const d = Math.round((current - previous) * 10 ** decimals) / 10 ** decimals
  if (d === 0) return { direction: 'same', text: 'No change' }
  return d > 0 ? { direction: 'up', text: `Up ${d}${unit}` } : { direction: 'down', text: `Down ${-d}${unit}` }
}
