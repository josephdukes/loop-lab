// Plain-language summaries stated under every chart (accessible text alternative with the key numbers).
import type { MetricType } from '../db/types'
import { dayMonth, oneDecimal } from './format'
import type { CategoryMix, DrillSeries, WeekBar, WeekConfidence } from './progressData'

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

export function sessionsSummary(bars: WeekBar[], target: number): string {
  if (bars.length === 0) return 'No weeks to show.'
  const counted = bars.filter((b) => !b.isRest)
  const met = counted.filter((b) => b.metTarget).length
  const rest = bars.filter((b) => b.isRest)
  const current = bars[bars.length - 1]
  return [
    `Robot sessions per week over ${plural(bars.length, 'week')}, target ${target}.`,
    `${met} of ${plural(counted.length, 'counted week')} reached the target.`,
    `This week so far: ${plural(current.robot, 'session')}.`,
    rest.length ? `Rest weeks (hatched): ${rest.map((r) => dayMonth(r.weekStart)).join(', ')}.` : 'No rest weeks marked.',
  ].join(' ')
}

export function minutesSummary(bars: WeekBar[]): string {
  const total = bars.reduce((s, b) => s + b.minutes, 0)
  if (bars.length === 0 || total === 0) return 'No training minutes recorded in this range.'
  const best = bars.reduce((a, b) => (b.minutes > a.minutes ? b : a))
  return `Training minutes per week: ${total} in total, an average of ${Math.round(total / bars.length)} a week. Most: ${best.minutes} minutes in the week of ${dayMonth(best.weekStart)}.`
}

export function formatChartValue(metric: MetricType, v: number): string {
  if (metric === 'hits_attempts') return `${v.toFixed(1)}%`
  if (metric === 'score_vs_robot') return `${v > 0 ? '+' : ''}${oneDecimal(v)}`
  if (metric === 'duration') return `${oneDecimal(v)} min`
  return oneDecimal(v)
}

export const METRIC_NOUN: Record<MetricType, string> = {
  hits_attempts: 'success rate', streak: 'best streak', score_vs_robot: 'margin against the robot', duration: 'minutes', rating: 'rating',
}

export function trendSummary(drillName: string, metric: MetricType, s: DrillSeries): string {
  const pts = s.points
  if (pts.length === 0) return `No results for ${drillName} in this range.`
  const vals = pts.map((p) => p.value)
  const best = Math.max(...vals)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const parts = [
    `${drillName}, ${METRIC_NOUN[metric]}: ${plural(pts.length, 'result')} from ${dayMonth(first.date)} to ${dayMonth(last.date)}.`,
    `Latest ${formatChartValue(metric, last.value)}, best ${formatChartValue(metric, best)}.`,
  ]
  if (s.benchmarkLine !== undefined) {
    parts.push(`Benchmark ${formatChartValue(metric, s.benchmarkLine)}: latest result ${last.met === true ? 'meets it' : last.met === false ? 'does not meet it yet' : 'does not count toward it'}.`)
  }
  return parts.join(' ')
}

export function confidenceSummary(weeks: WeekConfidence[]): string {
  const have = weeks.filter((w) => w.average !== null)
  if (have.length === 0) return 'No loop confidence ratings in this range.'
  const first = have[0]
  const last = have[have.length - 1]
  const avg = have.reduce((s, w) => s + (w.average as number), 0) / have.length
  return `Average session loop confidence (1 to 5) across ${plural(have.length, 'week')} with ratings: ${oneDecimal(avg)}. First week ${oneDecimal(first.average as number)}, latest ${oneDecimal(last.average as number)}.`
}

export function categorySummary(mix: CategoryMix): string {
  if (mix.items.length === 0) return 'No drill minutes recorded in this range.'
  const top = mix.items[0]
  return `${mix.totalMinutes} minutes of drill time. Most time: ${top.category}, ${top.minutes} minutes (${Math.round(top.share * 100)}%).${mix.withoutMinutes ? ` ${plural(mix.withoutMinutes, 'result')} had no minutes recorded and ${mix.withoutMinutes === 1 ? 'is' : 'are'} not counted.` : ''}`
}

export function matchConfidenceSummary(trend: Array<{ date: string; confidence: number }>): string {
  if (trend.length === 0) return 'No matches logged.'
  const last = trend[trend.length - 1]
  const avg = trend.reduce((s, t) => s + t.confidence, 0) / trend.length
  return `Match confidence (1 to 5) over ${plural(trend.length, 'match', 'matches')}: average ${oneDecimal(avg)}, first ${trend[0].confidence}, latest ${last.confidence}.`
}
