// The three CSV files (spec 6): drill_logs.csv, sessions.csv, matches.csv. Pure functions, no database access.
import type { DrillLog, MatchLog, Program, ProgramRun, SessionLog } from '../../db/types'
import { buildCsv, fixed, type CsvCell } from './csv'

export const DRILL_LOG_COLUMNS = [
  'log_id', 'session_id', 'date', 'session_start_time', 'program', 'program_week', 'session_label', 'drill_order', 'drill_id',
  'drill_name', 'category', 'metric_type', 'hits', 'attempts', 'success_rate_pct', 'streak', 'score_you', 'score_robot', 'rating',
  'duration_min', 'target_value', 'target_description', 'benchmark_met', 'robot_settings_used', 'drill_note',
] as const

export const SESSION_COLUMNS = [
  'session_id', 'date', 'start_time', 'end_time', 'total_minutes', 'kind', 'program', 'program_week', 'session_label', 'template_name',
  'effort_1_5', 'loop_confidence_1_5', 'drills_logged', 'drills_with_benchmark_met', 'notes',
] as const

export const MATCH_COLUMNS = [
  'match_id', 'date', 'competition', 'opponent', 'opponent_style', 'result', 'games_score', 'serve_faced', 'loops_attempted',
  'loops_landed', 'loop_success_pct', 'confidence_1_5', 'cue_used', 'breakdown_note', 'notes',
] as const

export interface ExportData {
  sessions: SessionLog[]
  drillLogs: DrillLog[]
  matches: MatchLog[]
  programs: Program[]
  programRuns: ProgramRun[]
}

/** Inclusive date range on YYYY-MM-DD. Either end may be left out. */
export interface DateRange { from?: string; to?: string }

export function inRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

/** Local HH:MM of an ISO timestamp; blank if missing or not a date. */
export function localTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Percentage to one decimal place as a raw number cell, or blank when it cannot be worked out. */
function pct(part: number | undefined, whole: number | undefined): CsvCell {
  if (part === undefined || whole === undefined || whole <= 0) return null
  return fixed((part / whole) * 100, 1)
}

function programNames(data: ExportData): (session: SessionLog | undefined) => string {
  const programName = new Map(data.programs.map((p) => [p.id, p.name]))
  const runProgram = new Map(data.programRuns.map((r) => [r.id, r.programId]))
  return (s) => {
    if (!s?.programRunId) return ''
    const programId = runProgram.get(s.programRunId)
    return (programId && programName.get(programId)) || ''
  }
}

const bySessionOrder = (a: SessionLog, b: SessionLog) =>
  a.date.localeCompare(b.date) || (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt) || a.id.localeCompare(b.id)

export function buildSessionsCsv(data: ExportData, range: DateRange = {}): string {
  const programOf = programNames(data)
  const counts = new Map<string, { logged: number; met: number }>()
  for (const l of data.drillLogs) {
    const c = counts.get(l.sessionId) ?? { logged: 0, met: 0 }
    c.logged++
    if (l.benchmarkMet === true) c.met++
    counts.set(l.sessionId, c)
  }
  const rows = data.sessions
    .filter((s) => inRange(s.date, range))
    .sort(bySessionOrder)
    .map((s): CsvCell[] => {
      const c = counts.get(s.id) ?? { logged: 0, met: 0 }
      return [
        s.id, s.date, localTime(s.startedAt), localTime(s.endedAt), s.totalMinutes, s.kind, programOf(s), s.programWeek, s.sessionLabel,
        s.templateNameSnapshot, s.effort, s.loopConfidence, c.logged, c.met, s.notes,
      ]
    })
  return buildCsv(SESSION_COLUMNS, rows)
}

export function buildDrillLogsCsv(data: ExportData, range: DateRange = {}): string {
  const programOf = programNames(data)
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))
  const keep = data.drillLogs
    .map((log) => ({ log, session: sessionById.get(log.sessionId) }))
    // A drill log whose session is missing has no date, so it only appears when no date range is set.
    .filter(({ session }) => (session ? inRange(session.date, range) : !range.from && !range.to))
    .sort((a, b) => {
      if (a.session && b.session && a.session.id !== b.session.id) return bySessionOrder(a.session, b.session)
      return (a.session?.date ?? '').localeCompare(b.session?.date ?? '') || a.log.sessionId.localeCompare(b.log.sessionId) || a.log.order - b.log.order
    })
  const rows = keep.map(({ log: l, session: s }): CsvCell[] => [
    l.id, l.sessionId, s?.date, localTime(s?.startedAt), programOf(s), s?.programWeek, s?.sessionLabel, l.order, l.drillId,
    l.drillNameSnapshot, l.categorySnapshot, l.metricType, l.hits, l.attempts, pct(l.hits, l.attempts), l.streak, l.scoreYou, l.scoreRobot,
    l.rating, l.durationMin, l.targetSnapshot?.value, l.targetSnapshot?.description,
    l.benchmarkMet === true ? true : l.benchmarkMet === false ? false : null,
    l.robotSettingsUsed, l.note,
  ])
  return buildCsv(DRILL_LOG_COLUMNS, rows)
}

export function buildMatchesCsv(data: ExportData, range: DateRange = {}): string {
  const rows = data.matches
    .filter((m) => inRange(m.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((m): CsvCell[] => [
      m.id, m.date, m.competition, m.opponent, m.opponentStyle, m.result, m.gamesScore, m.serveFaced, m.loopsAttempted, m.loopsLanded,
      pct(m.loopsLanded, m.loopsAttempted), m.confidence, m.cueUsed, m.breakdownNote, m.notes,
    ])
  return buildCsv(MATCH_COLUMNS, rows)
}

export type CsvKind = 'drill-logs' | 'sessions' | 'matches'

export function csvFilename(kind: CsvKind, today: string): string {
  return `loop-lab-${kind}-${today}.csv`
}
export const backupFilename = (today: string) => `loop-lab-backup-${today}.json`

export interface CsvFileText { kind: CsvKind; filename: string; text: string }

export function buildAllCsvFiles(data: ExportData, range: DateRange, today: string): CsvFileText[] {
  return [
    { kind: 'drill-logs', filename: csvFilename('drill-logs', today), text: buildDrillLogsCsv(data, range) },
    { kind: 'sessions', filename: csvFilename('sessions', today), text: buildSessionsCsv(data, range) },
    { kind: 'matches', filename: csvFilename('matches', today), text: buildMatchesCsv(data, range) },
  ]
}
