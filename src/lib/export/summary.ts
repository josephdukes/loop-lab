// "Copy summary for Claude" (spec 3.10): a plain-text digest of the last 2, 4 or 8 weeks.
// Pure function. It never includes opponent names or any free-text opponent field, and it never includes match notes.
import type { Benchmark, Drill, DrillLog, MatchLog, SessionLog } from '../../db/types'
import { evaluateBoard, primaryValue } from '../benchmarks'
import { addDays, lastNWeekStarts } from '../dates'
import { formatResult, oneDecimal } from '../format'
import { matchStats } from '../matchStats'
import { timeByCategory, type DrillLogRow } from '../progressData'
import { bucketByWeek } from '../sessionCounting'

export const SUMMARY_FIRST_LINE = 'Table tennis robot training log summary. Please suggest where I should focus next.'
/** "Under about 6,000 characters" (spec 3.10). Oldest notes are dropped first to stay under it. */
export const SUMMARY_MAX_CHARS = 6000
export const SUMMARY_MAX_NOTES = 10
export const NOTE_MAX_CHARS = 200
export const SUMMARY_WEEK_CHOICES = [2, 4, 8] as const

export interface SummaryInput {
  today: string
  weeks: number
  weeklyTarget: number
  sessions: SessionLog[]
  drillLogs: DrillLog[]
  matches: MatchLog[]
  drills: Drill[]
  restWeeks: Set<string>
}

interface NoteLine { date: string; at: string; order: number; text: string }

/** One line, at most NOTE_MAX_CHARS characters (longer notes end in "..."). */
export function truncateNote(note: string): string {
  const one = note.replace(/\s+/g, ' ').trim()
  return one.length > NOTE_MAX_CHARS ? one.slice(0, NOTE_MAX_CHARS - 3) + '...' : one
}

/** A short, fixed wording of a benchmark target (the drill's own description can be long). */
export function targetText(b: Benchmark): string {
  const base =
    b.metricType === 'hits_attempts' ? `${Math.round(b.threshold * 1000) / 10}% or better with at least ${b.minAttempts ?? 1} attempts`
      : b.metricType === 'streak' ? `streak of ${b.threshold} or more`
        : b.metricType === 'score_vs_robot' ? `win margin of ${b.threshold} or more`
          : b.metricType === 'duration' ? `${b.threshold} minutes or more`
            : `rating of ${b.threshold} or more`
  return b.consecutiveSessions > 1 ? `${base}, ${b.consecutiveSessions} sessions in a row` : base
}

const weekLabel = (weekStart: string) => `Week of ${weekStart}`
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function collectNotes(sessions: SessionLog[], logs: DrillLog[]): NoteLine[] {
  const out: NoteLine[] = []
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  for (const s of sessions) {
    const t = truncateNote(s.notes ?? '')
    if (t) out.push({ date: s.date, at: s.startedAt ?? s.createdAt, order: 0, text: `${s.date}, session: ${t}` })
  }
  for (const l of logs) {
    const s = sessionById.get(l.sessionId)
    const t = truncateNote(l.note ?? '')
    if (s && t) out.push({ date: s.date, at: s.startedAt ?? s.createdAt, order: l.order, text: `${s.date}, ${l.drillNameSnapshot}: ${t}` })
  }
  // Most recent first.
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at) || b.order - a.order)
}

export function buildSummary(input: SummaryInput): string {
  const weekStarts = lastNWeekStarts(input.today, input.weeks)
  const periodStart = weekStarts[0]
  const inPeriod = (date: string) => date >= periodStart && date <= input.today
  const sessions = input.sessions.filter((s) => inPeriod(s.date))
  const sessionIds = new Set(sessions.map((s) => s.id))
  const logs = input.drillLogs.filter((l) => sessionIds.has(l.sessionId))
  const matches = input.matches.filter((m) => inPeriod(m.date))
  const dateOfSession = new Map(input.sessions.map((s) => [s.id, s.date]))

  const lines: string[] = [SUMMARY_FIRST_LINE, '']
  lines.push(`Period: ${periodStart} to ${input.today} (${input.weeks} weeks, Monday to Sunday; the last week is still in progress).`, '')

  // Robot sessions per week against the target.
  const logCount = new Map<string, number>()
  for (const l of input.drillLogs) logCount.set(l.sessionId, (logCount.get(l.sessionId) ?? 0) + 1)
  const byWeek = bucketByWeek(sessions.map((s) => ({ id: s.id, date: s.date, kind: s.kind, drillLogCount: logCount.get(s.id) ?? 0 })))
  lines.push(`Robot sessions per week (target ${input.weeklyTarget}):`)
  let robotTotal = 0
  let clubTotal = 0
  for (const w of weekStarts) {
    const c = byWeek.get(w) ?? { robot: 0, club: 0 }
    robotTotal += c.robot
    clubTotal += c.club
    const note = input.restWeeks.has(w) ? ' (rest week)' : c.robot >= input.weeklyTarget ? ' (target met)' : ''
    lines.push(`- ${weekLabel(w)}: ${c.robot} of ${input.weeklyTarget}${note}`)
  }
  const restCount = weekStarts.filter((w) => input.restWeeks.has(w)).length
  lines.push(`Total robot sessions: ${robotTotal} against a target of ${input.weeklyTarget * (input.weeks - restCount)} (rest weeks excluded). Club sessions: ${clubTotal} (not counted toward the target).`, '')

  // Total minutes and time by category.
  const totalMinutes = sessions.reduce((a, s) => a + s.totalMinutes, 0)
  lines.push(`Total training minutes: ${totalMinutes} across ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}.`)
  const rows: DrillLogRow[] = logs.map((log) => ({ log, date: dateOfSession.get(log.sessionId) ?? '', at: '' }))
  const mix = timeByCategory(rows)
  if (mix.items.length === 0) lines.push('Time by category: no drill minutes were recorded in this period.')
  else {
    lines.push('Time by category (from drill minutes):')
    for (const c of mix.items) lines.push(`- ${c.category}: ${c.minutes} min (${Math.round(c.share * 100)}%)`)
    if (mix.withoutMinutes > 0) lines.push(`(${mix.withoutMinutes} drill ${mix.withoutMinutes === 1 ? 'result has' : 'results have'} no minutes recorded and ${mix.withoutMinutes === 1 ? 'is' : 'are'} not counted.)`)
  }
  lines.push('')

  // Benchmarked drills: latest and best in the period, met or not by the benchmark board rule (all history).
  const allRowsByDrill = new Map<string, DrillLogRow[]>()
  for (const l of input.drillLogs) {
    const date = dateOfSession.get(l.sessionId)
    if (!date || date > input.today) continue
    const list = allRowsByDrill.get(l.drillId) ?? []
    list.push({ log: l, date, at: '' })
    allRowsByDrill.set(l.drillId, list)
  }
  const benchmarked = input.drills.filter((d) => d.benchmark && !d.archived)
  lines.push('Benchmarked drills (latest and best result in this period; met or not follows the benchmark rule over all history):')
  if (benchmarked.length === 0) lines.push('- No drills have a benchmark.')
  for (const d of benchmarked) {
    const b = d.benchmark!
    const all = (allRowsByDrill.get(d.id) ?? []).sort((x, y) => x.date.localeCompare(y.date) || x.log.order - y.log.order)
    const board = evaluateBoard(all.map((r) => r.log), b)
    const status = board.status === 'met' ? 'benchmark met' : board.status === 'not_met' ? 'benchmark not met yet' : 'no result counts toward the benchmark yet'
    const here = all.filter((r) => inPeriod(r.date))
    const head = `- ${d.name} (target: ${targetText(b)})`
    if (here.length === 0) { lines.push(`${head}: not trained in this period; ${status}.`); continue }
    const latest = here[here.length - 1]
    const best = here.reduce((m, r) => ((primaryValue(r.log) ?? -Infinity) > (primaryValue(m.log) ?? -Infinity) ? r : m))
    lines.push(`${head}: latest ${formatResult(latest.log)} on ${latest.date}; best ${formatResult(best.log)}; ${status}.`)
  }
  lines.push('')

  // Effort and loop confidence per week.
  lines.push('Average effort and loop confidence per week (ratings 1 to 5):')
  for (const w of weekStarts) {
    const end = addDays(w, 6)
    const inWeek = sessions.filter((s) => s.date >= w && s.date <= end)
    const effort = avg(inWeek.flatMap((s) => (s.effort === undefined ? [] : [s.effort])))
    const conf = avg(inWeek.flatMap((s) => (s.loopConfidence === undefined ? [] : [s.loopConfidence])))
    lines.push(`- ${weekLabel(w)}: effort ${effort === null ? 'no rating' : oneDecimal(effort)}, loop confidence ${conf === null ? 'no rating' : oneDecimal(conf)}`)
  }
  lines.push('')

  // Matches (no opponent names, no match notes).
  const ms = matchStats(matches)
  if (ms.count === 0) lines.push('Matches in this period: none logged.')
  else {
    lines.push(`Matches in this period: ${ms.count} (${ms.wins} won, ${ms.losses} lost).`)
    lines.push(ms.loops.percent === null
      ? 'Loops attempted vs landed: not recorded.'
      : `Loops attempted vs landed: ${ms.loops.landed} of ${ms.loops.attempted} landed (${ms.loops.percent.toFixed(1)}%).`)
    lines.push(`Average match confidence: ${ms.averageConfidence === null ? 'not recorded' : oneDecimal(ms.averageConfidence) + ' of 5'}.`)
  }

  // Notes: up to 10 most recent, oldest dropped first if the text is too long.
  const notes = collectNotes(sessions, logs).slice(0, SUMMARY_MAX_NOTES)
  const render = (kept: NoteLine[]) => {
    const tail = kept.length === 0
      ? ['', 'Recent notes: none.']
      : ['', `Most recent notes (up to ${SUMMARY_MAX_NOTES}, each cut to ${NOTE_MAX_CHARS} characters):`, ...kept.map((n) => `- ${n.text}`)]
    return [...lines, ...tail].join('\n')
  }
  let text = render(notes)
  while (text.length > SUMMARY_MAX_CHARS && notes.length > 0) {
    notes.pop() // the list is newest first, so this drops the oldest
    text = render(notes)
  }
  return text.length > SUMMARY_MAX_CHARS ? text.slice(0, SUMMARY_MAX_CHARS) : text
}
