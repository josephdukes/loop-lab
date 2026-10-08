// Pure builders for the Progress screen (spec 5, Progress; 3.2 to 3.6). No database access here.
import { CATEGORIES } from '../content/builtinContent'
import type { Benchmark, Drill, DrillLog, MetricType, SessionKind } from '../db/types'
import { evaluateBoard, evaluateLog, primaryValue, type BoardStatus } from './benchmarks'
import { addWeeks, daysBetween, lastNWeekStarts, weekStartOf } from './dates'
import { countsTowardTarget } from './sessionCounting'

export type RangeId = '4' | '12' | 'all'
export const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: '4', label: '4 weeks' },
  { id: '12', label: '12 weeks' },
  { id: 'all', label: 'All' },
]
/** "All" never draws more than this many weekly bars. */
export const MAX_ALL_WEEKS = 104

export interface SessionStat {
  id: string
  date: string
  kind: SessionKind
  totalMinutes: number
  loopConfidence?: number
  drillCount: number
}

/** A drill log with the date (and tie-break time) of its session. */
export interface DrillLogRow {
  log: DrillLog
  date: string
  at: string
}

export function sortRows(rows: DrillLogRow[]): DrillLogRow[] {
  return rows.slice().sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.log.order - b.log.order)
}

// --- weeks ---------------------------------------------------------------------------------------

/** Monday-start weeks (oldest first) covered by the range, ending with the current week. */
export function weeksForRange(range: RangeId, firstDate: string | undefined, today: string): string[] {
  if (range !== 'all') return lastNWeekStarts(today, Number(range))
  const current = weekStartOf(today)
  if (!firstDate) return lastNWeekStarts(today, 4)
  const first = weekStartOf(firstDate > today ? today : firstDate)
  const count = Math.min(MAX_ALL_WEEKS, Math.max(4, daysBetween(first, current) / 7 + 1))
  return lastNWeekStarts(today, count)
}

export interface WeekBar {
  weekStart: string
  /** Robot sessions that count toward the target (spec 3.2). */
  robot: number
  club: number
  /** Minutes of every saved session in the week (robot and club). */
  minutes: number
  isRest: boolean
  metTarget: boolean
}

export function buildWeekBars(sessions: SessionStat[], restWeeks: Set<string>, target: number, weeks: string[]): WeekBar[] {
  const byWeek = new Map<string, WeekBar>()
  for (const w of weeks) byWeek.set(w, { weekStart: w, robot: 0, club: 0, minutes: 0, isRest: restWeeks.has(w), metTarget: false })
  for (const s of sessions) {
    const bar = byWeek.get(weekStartOf(s.date))
    if (!bar) continue
    if (s.kind === 'club') bar.club++
    else if (countsTowardTarget({ kind: s.kind, drillLogCount: s.drillCount })) bar.robot++
    bar.minutes += s.totalMinutes
  }
  for (const b of byWeek.values()) b.metTarget = b.robot >= target
  return weeks.map((w) => byWeek.get(w) as WeekBar)
}

export interface WeekConfidence {
  weekStart: string
  /** Average session loop confidence, or null when no session that week recorded one. */
  average: number | null
  count: number
}

export function confidenceByWeek(sessions: SessionStat[], weeks: string[]): WeekConfidence[] {
  const acc = new Map<string, { sum: number; n: number }>()
  for (const s of sessions) {
    if (s.loopConfidence === undefined) continue
    const k = weekStartOf(s.date)
    const a = acc.get(k) ?? { sum: 0, n: 0 }
    a.sum += s.loopConfidence
    a.n++
    acc.set(k, a)
  }
  return weeks.map((w) => {
    const a = acc.get(w)
    return { weekStart: w, average: a ? a.sum / a.n : null, count: a?.n ?? 0 }
  })
}

// --- time by category ------------------------------------------------------------------------------

export interface CategoryTime {
  category: string
  minutes: number
  share: number
}

export interface CategoryMix {
  items: CategoryTime[]
  totalMinutes: number
  /** Drill results in the range with no minutes recorded. They are NOT estimated from templates or plans. */
  withoutMinutes: number
}

const categoryOrder = (c: string) => {
  const i = (CATEGORIES as readonly string[]).indexOf(c)
  return i < 0 ? 99 : i
}

/** Time by category from drill-log durations (each log's own durationMin) on or after `fromDate`. */
export function timeByCategory(rows: DrillLogRow[], fromDate?: string): CategoryMix {
  const minutes = new Map<string, number>()
  let withoutMinutes = 0
  for (const { log, date } of rows) {
    if (fromDate && date < fromDate) continue
    if (log.durationMin === undefined) { withoutMinutes++; continue }
    minutes.set(log.categorySnapshot, (minutes.get(log.categorySnapshot) ?? 0) + log.durationMin)
  }
  const total = [...minutes.values()].reduce((a, b) => a + b, 0)
  const items = [...minutes]
    .filter(([, m]) => m > 0)
    .map(([category, m]) => ({ category, minutes: m, share: total > 0 ? m / total : 0 }))
    .sort((a, b) => b.minutes - a.minutes || categoryOrder(a.category) - categoryOrder(b.category))
  return { items, totalMinutes: total, withoutMinutes }
}

// --- per-drill trend -------------------------------------------------------------------------------

export type SeriesUnit = 'percent' | 'count' | 'margin' | 'minutes' | 'rating'

export interface SeriesPoint {
  date: string
  /** In chart units: percent (0 to 100) for hits_attempts, otherwise the metric value. */
  value: number
  /** True when the log meets the drill's current benchmark; null when it has none or the log does not count toward it. */
  met: boolean | null
}

export interface DrillSeries {
  unit: SeriesUnit
  points: SeriesPoint[]
  /** Benchmark threshold in chart units, when the drill has a benchmark for this metric. */
  benchmarkLine?: number
}

export function unitFor(metric: MetricType): SeriesUnit {
  return ({ hits_attempts: 'percent', streak: 'count', score_vs_robot: 'margin', duration: 'minutes', rating: 'rating' } as const)[metric]
}

/** Primary metric over time: success rate, best streak, margin, minutes or rating (spec 3.5). */
export function drillSeries(rowsOldestFirst: DrillLogRow[], drill: Pick<Drill, 'metricType' | 'benchmark'>, fromDate?: string): DrillSeries {
  const bench = drill.benchmark && drill.benchmark.metricType === drill.metricType ? drill.benchmark : undefined
  const scale = drill.metricType === 'hits_attempts' ? 100 : 1
  const points: SeriesPoint[] = []
  for (const { log, date } of rowsOldestFirst) {
    if (fromDate && date < fromDate) continue
    const v = primaryValue(log)
    if (v === undefined) continue
    const ev = bench ? evaluateLog(log, bench) : undefined
    points.push({ date, value: v * scale, met: ev && ev.counts ? ev.met : null })
  }
  return { unit: unitFor(drill.metricType), points, benchmarkLine: bench ? bench.threshold * scale : undefined }
}

export interface YDomain {
  min: number
  max: number
  ticks: number[]
}

function niceStep(range: number): number {
  const rough = range / 4
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const f = rough / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}

/** A y range that always includes the data and the benchmark line, with clean tick values. */
export function yDomain(unit: SeriesUnit, values: number[], line?: number): YDomain {
  if (unit === 'rating') return { min: 1, max: 5, ticks: [1, 2, 3, 4, 5] }
  if (unit === 'percent') return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }
  const all = [...values, ...(line === undefined ? [] : [line])]
  let lo = Math.min(...all, unit === 'margin' ? 0 : 0)
  let hi = Math.max(...all, 1)
  if (hi === lo) hi = lo + 1
  const step = niceStep(hi - lo)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 1000; t += step) ticks.push(Math.round(t * 1000) / 1000)
  return { min: lo, max: hi, ticks }
}

// --- benchmark board -------------------------------------------------------------------------------

export interface BoardRow {
  drill: Drill
  benchmark: Benchmark
  status: BoardStatus
  latest?: number
  best?: number
  /** Counting logs judged / needed (consecutiveSessions). */
  judged: number
  needed: number
  logCount: number
}

/** One row for every non-archived drill that has a benchmark, in category order. Uses evaluateBoard (spec 3.6). */
export function buildBoard(drills: Drill[], rowsByDrill: Map<string, DrillLogRow[]>): BoardRow[] {
  return drills
    .filter((d) => d.benchmark && !d.archived)
    .map((drill) => {
      const benchmark = drill.benchmark as Benchmark
      const logs = sortRows(rowsByDrill.get(drill.id) ?? [])
      const board = evaluateBoard(logs.map((r) => r.log), benchmark)
      return {
        drill,
        benchmark,
        status: board.status,
        latest: board.latest,
        best: board.best,
        judged: board.judged.length,
        needed: Math.max(1, benchmark.consecutiveSessions || 1),
        logCount: logs.length,
      }
    })
    .sort((a, b) => categoryOrder(a.drill.category) - categoryOrder(b.drill.category) || a.drill.name.localeCompare(b.drill.name))
}

export function groupRowsByDrill(rows: DrillLogRow[]): Map<string, DrillLogRow[]> {
  const out = new Map<string, DrillLogRow[]>()
  for (const r of rows) {
    const list = out.get(r.log.drillId) ?? []
    list.push(r)
    out.set(r.log.drillId, list)
  }
  return out
}

export { addWeeks }
