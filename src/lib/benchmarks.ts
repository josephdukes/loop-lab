// Spec 3.6: benchmark evaluation for one drill log and for the benchmark board.
import type { Benchmark, MetricType } from '../db/types'

/** The parts of a drill log that benchmarks look at. */
export interface LogResult {
  metricType: MetricType
  hits?: number
  attempts?: number
  streak?: number
  scoreYou?: number
  scoreRobot?: number
  rating?: number
  durationMin?: number
}

export interface LogEvaluation {
  /** False when the log does not count toward this benchmark (wrong metric, or attempts < minAttempts). */
  counts: boolean
  /** True only when the log counts and reaches the threshold. */
  met: boolean
}

const EPS = 1e-9

/** The single number a log is judged by: ratio for hits_attempts, otherwise the metric value. */
export function primaryValue(log: LogResult): number | undefined {
  switch (log.metricType) {
    case 'hits_attempts':
      return log.attempts && log.attempts > 0 ? (log.hits ?? 0) / log.attempts : undefined
    case 'streak':
      return log.streak
    case 'score_vs_robot':
      return log.scoreYou === undefined || log.scoreRobot === undefined ? undefined : log.scoreYou - log.scoreRobot
    case 'duration':
      return log.durationMin
    case 'rating':
      return log.rating
  }
}

export function evaluateLog(log: LogResult, b: Benchmark): LogEvaluation {
  if (log.metricType !== b.metricType) return { counts: false, met: false }
  if (log.metricType === 'hits_attempts') {
    const attempts = log.attempts ?? 0
    if (attempts < 1 || attempts < (b.minAttempts ?? 0)) return { counts: false, met: false }
  }
  const v = primaryValue(log)
  if (v === undefined) return { counts: false, met: false }
  return { counts: true, met: v >= b.threshold - EPS }
}

/** The value stored as `benchmarkMet` on a drill log: null when there is no benchmark. */
export function benchmarkMetFor(log: LogResult, b: Benchmark | undefined): boolean | null {
  if (!b) return null
  return evaluateLog(log, b).met
}

export type BoardStatus = 'met' | 'not_met' | 'no_data'

export interface BoardResult {
  status: BoardStatus
  /** The latest N counting logs that were judged (oldest first). */
  judged: Array<{ value: number; met: boolean }>
  latest?: number
  best?: number
}

/**
 * Benchmark board for one drill. `logsOldestFirst` must be in date order.
 * Logs that do not count (attempts below minAttempts) are ignored. The latest N counting logs, where
 * N = consecutiveSessions, must ALL meet the threshold. Fewer than N counting logs is "not met".
 */
export function evaluateBoard(logsOldestFirst: LogResult[], b: Benchmark): BoardResult {
  const counting: Array<{ value: number; met: boolean }> = []
  for (const log of logsOldestFirst) {
    const e = evaluateLog(log, b)
    if (e.counts) counting.push({ value: primaryValue(log) as number, met: e.met })
  }
  if (counting.length === 0) return { status: 'no_data', judged: [] }
  const n = Math.max(1, b.consecutiveSessions || 1)
  const judged = counting.slice(-n)
  const status = judged.length >= n && judged.every((j) => j.met) ? 'met' : 'not_met'
  return {
    status,
    judged,
    latest: counting[counting.length - 1].value,
    best: Math.max(...counting.map((c) => c.value)),
  }
}
