// Small text formatters shared by screens.
import type { Benchmark, DrillLog, MetricType } from '../db/types'
import { primaryValue, type LogResult } from './benchmarks'

export const METRIC_LABEL: Record<MetricType, string> = {
  hits_attempts: 'Hits out of attempts',
  streak: 'Best streak',
  score_vs_robot: 'Score vs robot',
  duration: 'Duration',
  rating: 'Rating 1-5',
}

/** Split guidance notes into separate cards: paragraphs are separated by a blank line. */
export function splitNotes(notes: string): string[] {
  return notes
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Success rate as a percentage to one decimal place, e.g. "80.0%". */
export function percent(hits: number, attempts: number): string {
  return `${((hits / attempts) * 100).toFixed(1)}%`
}

/** One-line description of a drill result, for lists and detail screens. */
export function formatResult(log: LogResult): string {
  switch (log.metricType) {
    case 'hits_attempts':
      return log.attempts ? `${log.hits ?? 0}/${log.attempts} (${percent(log.hits ?? 0, log.attempts)})` : 'No attempts'
    case 'streak':
      return `Best streak ${log.streak ?? 0}`
    case 'score_vs_robot': {
      const you = log.scoreYou ?? 0
      const robot = log.scoreRobot ?? 0
      const margin = you - robot
      return `Me ${you}, robot ${robot} (margin ${margin > 0 ? '+' : ''}${margin})`
    }
    case 'duration':
      return `${log.durationMin ?? 0} min`
    case 'rating':
      return `Rating ${log.rating ?? '-'}/5`
  }
}

/** A short text for a benchmark's threshold, used when its own description is missing. */
export function benchmarkText(b: Benchmark): string {
  if (b.description) return b.description
  if (b.metricType === 'hits_attempts') return `${Math.round(b.threshold * 100)}% with at least ${b.minAttempts ?? 1} attempts`
  return `${b.threshold} or more`
}

export function benchmarkDetail(b: Benchmark): string {
  const parts = [benchmarkText(b)]
  if (b.consecutiveSessions > 1) parts.push(`in ${b.consecutiveSessions} sessions in a row`)
  return parts.join(', ')
}

export function formatValue(metric: MetricType, value: number): string {
  return metric === 'hits_attempts' ? `${(value * 100).toFixed(1)}%` : String(value)
}

export function logValue(log: DrillLog): number | undefined {
  return primaryValue(log)
}

/** "Mon 5 Oct" style label from YYYY-MM-DD, using the calendar date only. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** "5 Oct" style label from YYYY-MM-DD (chart axes). Fixed three-letter months so axis labels have a predictable width. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dayMonth(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** Rounds to at most one decimal place and drops a trailing ".0". */
export function oneDecimal(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** "7 Oct 2026" from an ISO timestamp, in the phone's time zone. */
export function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "7 Oct 2026, 14:05" from an ISO timestamp, in the phone's time zone. */
export function longDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${longDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "today", "yesterday" or "N days ago". */
export function daysAgoText(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
