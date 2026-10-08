// Validation and blank templates for the builders (spec 5, Builders). Pure functions, no database.
import { CATEGORIES } from '../content/builtinContent'
import type { Benchmark, Drill, MetricType, Program, SessionTemplate } from '../db/types'

export const METRIC_TYPES: MetricType[] = ['hits_attempts', 'streak', 'score_vs_robot', 'duration', 'rating']

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)
const isPositiveInt = (n: unknown): n is number => isInt(n) && n >= 1

/** Is this threshold sensible for the metric type? Returns a problem text or null. */
export function benchmarkProblem(b: Benchmark, drillMetric: MetricType): string | null {
  if (b.metricType !== drillMetric) return 'The benchmark must use the same metric type as the drill.'
  if (typeof b.threshold !== 'number' || !Number.isFinite(b.threshold)) return 'Enter a benchmark threshold.'
  switch (b.metricType) {
    case 'hits_attempts':
      if (b.threshold <= 0 || b.threshold > 1) return 'For hits out of attempts the threshold must be above 0% and at most 100%.'
      break
    case 'streak':
      if (!isPositiveInt(b.threshold)) return 'For a streak the threshold must be a whole number, 1 or more.'
      break
    case 'score_vs_robot':
      if (!isInt(b.threshold) || b.threshold < 0 || b.threshold > 11) return 'For score vs robot the threshold is the margin (your points minus the robot\'s): a whole number from 0 to 11.'
      break
    case 'duration':
      if (!isPositiveInt(b.threshold)) return 'For duration the threshold must be a whole number of minutes, 1 or more.'
      break
    case 'rating':
      if (!isInt(b.threshold) || b.threshold < 1 || b.threshold > 5) return 'For a rating the threshold must be a whole number from 1 to 5.'
      break
  }
  if (b.minAttempts !== undefined && !(b.metricType === 'hits_attempts' && isPositiveInt(b.minAttempts))) {
    return 'Minimum attempts must be a whole number, 1 or more, and only applies to hits out of attempts.'
  }
  if (!isPositiveInt(b.consecutiveSessions)) return 'Sessions in a row must be a whole number, 1 or more.'
  return null
}

export function validateDrill(d: Drill): string[] {
  const errors: string[] = []
  if (!d.name.trim()) errors.push('Give the drill a name.')
  if (!METRIC_TYPES.includes(d.metricType)) errors.push('Choose a metric type.')
  if (!(CATEGORIES as readonly string[]).includes(d.category)) errors.push('Choose a category.')
  if (d.defaultAttempts !== undefined && !isPositiveInt(d.defaultAttempts)) errors.push('Default attempts must be a whole number, 1 or more.')
  if (d.defaultDurationMin !== undefined && !isPositiveInt(d.defaultDurationMin)) errors.push('Default minutes must be a whole number, 1 or more.')
  if (d.benchmark) {
    const p = benchmarkProblem(d.benchmark, d.metricType)
    if (p) errors.push(p)
  }
  return errors
}

export function validateTemplate(t: SessionTemplate, existingDrillIds: Set<string>): string[] {
  const errors: string[] = []
  if (!t.name.trim()) errors.push('Give the session a name.')
  if (t.kind !== 'robot' && t.kind !== 'club') errors.push('Choose robot or club.')
  if (t.items.length === 0) errors.push('Add at least one drill.')
  for (const it of t.items) {
    if (!existingDrillIds.has(it.drillId)) errors.push('A drill in this session no longer exists. Remove it.')
    if (it.durationMin !== undefined && !isPositiveInt(it.durationMin)) errors.push('Minutes for each drill must be a whole number, 1 or more.')
  }
  return [...new Set(errors)]
}

export function validateProgram(p: Program, existingTemplateIds: Set<string>): string[] {
  const errors: string[] = []
  if (!p.name.trim()) errors.push('Give the program a name.')
  if (!(CATEGORIES as readonly string[]).includes(p.category)) errors.push('Choose a category.')
  if (!isPositiveInt(p.sessionsPerWeek)) errors.push('Sessions per week must be a whole number, 1 or more.')
  if (p.weeks.length < 1) errors.push('Add at least one week.')
  if (p.repeating && !(isPositiveInt(p.cycleLengthWeeks) && p.cycleLengthWeeks <= Math.max(1, p.weeks.length))) {
    errors.push('Cycle length must be a whole number of weeks, from 1 up to the number of weeks in the program.')
  }
  p.weeks.forEach((w, i) => {
    if (isPositiveInt(p.sessionsPerWeek) && w.sessions.length !== p.sessionsPerWeek) errors.push(`Week ${i + 1} needs exactly ${p.sessionsPerWeek} sessions.`)
    for (const s of w.sessions) {
      if (!s.label.trim()) errors.push(`Week ${i + 1} has a session with no name.`)
      if (!existingTemplateIds.has(s.templateId)) errors.push(`Week ${i + 1} uses a session template that no longer exists.`)
    }
  })
  return [...new Set(errors)]
}

// --- blanks ---------------------------------------------------------------------------------------

export function blankDrill(ts: string, id: string): Drill {
  return {
    id, name: '', category: CATEGORIES[0], description: '', metricType: 'hits_attempts', defaultAttempts: 10, defaultDurationMin: 10,
    suggestedSettings: '', cues: '', source: 'custom', isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: ts, updatedAt: ts,
  }
}

export function blankTemplate(ts: string, id: string): SessionTemplate {
  return { id, name: '', kind: 'robot', items: [], isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: ts, updatedAt: ts }
}

export function blankProgram(ts: string, id: string, templateId: string): Program {
  return {
    id, name: '', category: CATEGORIES[0], description: '', repeating: false, sessionsPerWeek: 3, notes: '',
    weeks: [{ weekNumber: 1, title: 'Week 1', sessions: [1, 2, 3].map((n) => ({ label: `Session ${n}`, templateId })) }],
    isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: ts, updatedAt: ts,
  }
}

/** A plain-English benchmark description for when the user leaves it blank. */
export function autoBenchmarkDescription(b: Benchmark): string {
  switch (b.metricType) {
    case 'hits_attempts':
      return `${Math.round(b.threshold * 1000) / 10}% or better${b.minAttempts ? ` with at least ${b.minAttempts} attempts` : ''}`
    case 'streak':
      return `Streak of ${b.threshold} or more`
    case 'score_vs_robot':
      return `Win by ${b.threshold} or more`
    case 'duration':
      return `${b.threshold} minutes or more`
    case 'rating':
      return `Rating ${b.threshold} or more`
  }
}
