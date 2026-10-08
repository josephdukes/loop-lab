// Structural checks for a backup file's records (spec 6). A small declarative description of every field of every
// store; unknown extra fields are ignored (left out of the cleaned record), anything structurally wrong is reported.
import { isValidDate } from '../dates'
import { STORE_LABEL, type StoreName } from './stores'

type Spec =
  | { t: 'str' }
  | { t: 'date' }
  | { t: 'iso' }
  | { t: 'int'; min?: number; max?: number }
  | { t: 'num'; min?: number }
  | { t: 'bool' }
  | { t: 'enum'; values: readonly string[] }
  | { t: 'literal'; value: string }
  | { t: 'obj'; fields: Fields }
  | { t: 'anyObj' }
  | { t: 'arr'; item: Spec }
  | { t: 'dict'; item: Spec }
type Field = { spec: Spec; optional?: boolean; nullable?: boolean }
type Fields = Record<string, Field>

const req = (spec: Spec): Field => ({ spec })
const opt = (spec: Spec): Field => ({ spec, optional: true })
const str = { t: 'str' } as const
const date = { t: 'date' } as const
const iso = { t: 'iso' } as const
const bool = { t: 'bool' } as const
const int = (min?: number, max?: number): Spec => ({ t: 'int', min, max })
const num = (min?: number): Spec => ({ t: 'num', min })
const en = (...values: string[]): Spec => ({ t: 'enum', values })

const METRICS = en('hits_attempts', 'streak', 'score_vs_robot', 'duration', 'rating')
const stamps: Fields = { createdAt: req(iso), updatedAt: req(iso) }
const flags: Fields = { isBuiltIn: req(bool), modifiedByUser: req(bool), archived: req(bool) }

const benchmark: Spec = {
  t: 'obj',
  fields: { metricType: req(METRICS), threshold: req(num()), minAttempts: opt(num(0)), consecutiveSessions: req(int(1)), description: req(str) },
}

export const RECORD_FIELDS: Record<StoreName, Fields> = {
  drills: {
    id: req(str), builtInKey: opt(str), name: req(str), category: req(str), description: req(str), metricType: req(METRICS),
    defaultAttempts: opt(num(0)), defaultDurationMin: opt(num(0)), suggestedSettings: req(str), cues: req(str), benchmark: opt(benchmark),
    source: req(en('original', 'holistic', 'pressure', 'starter-draft', 'custom')), ...flags, ...stamps,
  },
  sessionTemplates: {
    id: req(str), builtInKey: opt(str), name: req(str), kind: req(en('robot', 'club')),
    items: req({
      t: 'arr',
      item: { t: 'obj', fields: { drillId: req(str), order: req(int()), durationMin: opt(num(0)), note: opt(str), benchmarkOverride: opt(benchmark) } },
    }),
    ...flags, ...stamps,
  },
  programs: {
    id: req(str), builtInKey: opt(str), name: req(str), category: req(str), description: req(str), repeating: req(bool),
    cycleLengthWeeks: opt(int(1)), sessionsPerWeek: req(int(1)),
    weeks: req({
      t: 'arr',
      item: {
        t: 'obj',
        fields: {
          weekNumber: req(int(1)), title: req(str), goal: opt(str),
          sessions: req({
            t: 'arr',
            item: {
              t: 'obj',
              fields: {
                label: req(str), templateId: req(str),
                itemOverrides: opt({ t: 'dict', item: { t: 'obj', fields: { benchmarkOverride: opt(benchmark), note: opt(str), durationMin: opt(num(0)) } } }),
              },
            },
          }),
        },
      },
    }),
    notes: req(str), ...flags, ...stamps,
  },
  programRuns: {
    id: req(str), programId: req(str), startDate: req(date), status: req(en('active', 'paused', 'completed')),
    manualOffsetSessions: req(int()), cycleNumber: req(int(1)), ...stamps,
  },
  sessionLogs: {
    id: req(str), date: req(date), startedAt: opt(iso), endedAt: opt(iso), totalMinutes: req(num(0)), kind: req(en('robot', 'club')),
    programRunId: opt(str), programWeek: opt(int(1)), programCycle: opt(int(1)), sessionLabel: opt(str), templateId: opt(str),
    templateNameSnapshot: opt(str), effort: opt(int(1, 5)), loopConfidence: opt(int(1, 5)), notes: req(str), ...stamps,
  },
  drillLogs: {
    id: req(str), sessionId: req(str), order: req(int()), drillId: req(str), drillNameSnapshot: req(str), categorySnapshot: req(str),
    metricType: req(METRICS), hits: opt(int(0)), attempts: opt(int(0)), streak: opt(int(0)), scoreYou: opt(int(0)), scoreRobot: opt(int(0)),
    rating: opt(int(1, 5)), durationMin: opt(num(0)), robotSettingsUsed: opt(str), note: opt(str),
    targetSnapshot: opt({ t: 'obj', fields: { value: req(num()), description: req(str), minAttempts: opt(num(0)) } }),
    benchmarkMet: { spec: bool, optional: true, nullable: true }, ...stamps,
  },
  matchLogs: {
    id: req(str), date: req(date), competition: req(en('league', 'club', 'friendly')), opponent: opt(str),
    opponentStyle: req(en('hitter', 'chopper', 'blocker', 'looper', 'other')), result: req(en('W', 'L')), gamesScore: req(str), serveFaced: req(str),
    loopsAttempted: opt(int(0)), loopsLanded: opt(int(0)), confidence: req(int(1, 5)), cueUsed: req(str), breakdownNote: req(str), notes: req(str), ...stamps,
  },
  blockReviews: {
    id: req(str), programRunId: opt(str), cycleNumber: opt(int(1)), date: req(date), windowStart: req(date), windowEnd: req(date), emphasisNotes: req(str), ...stamps,
  },
  weekFlags: { weekStart: req(date), isRest: req(bool), ...stamps },
  settings: {
    key: req({ t: 'literal', value: 'settings' }), weeklyTarget: req(int(1)), theme: req(en('dark', 'light')), timerSound: req(bool), timerVibrate: req(bool),
    lastBackupAt: opt(iso), backupSnoozedUntil: opt(iso), backupReminderDays: req(int(1)), summaryWeeks: req(int(1)), contentVersion: req(int(0)), ...stamps,
  },
  activeSession: { key: req({ t: 'literal', value: 'active' }), state: req({ t: 'anyObj' }), ...stamps },
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v))

function describeSpec(s: Spec): string {
  switch (s.t) {
    case 'str': return 'text'
    case 'date': return 'a real date written YYYY-MM-DD'
    case 'iso': return 'a date and time'
    case 'int': return s.min !== undefined && s.max !== undefined ? `a whole number from ${s.min} to ${s.max}` : s.min !== undefined ? `a whole number, ${s.min} or more` : 'a whole number'
    case 'num': return s.min !== undefined ? `a number, ${s.min} or more` : 'a number'
    case 'bool': return 'true or false'
    case 'enum': return `one of: ${s.values.join(', ')}`
    case 'literal': return `exactly "${s.value}"`
    case 'obj': case 'anyObj': case 'dict': return 'an object'
    case 'arr': return 'a list'
  }
}

/** Returns the cleaned value, or reports the problem (path says where) and returns undefined. */
function check(spec: Spec, value: unknown, path: string, problems: string[]): unknown {
  const bad = () => { problems.push(`${path} must be ${describeSpec(spec)}.`); return undefined }
  switch (spec.t) {
    case 'str': return typeof value === 'string' ? value : bad()
    case 'date': return typeof value === 'string' && isValidDate(value) ? value : bad()
    case 'iso': return isIso(value) ? value : bad()
    case 'int':
      return typeof value === 'number' && Number.isInteger(value) && (spec.min === undefined || value >= spec.min) && (spec.max === undefined || value <= spec.max) ? value : bad()
    case 'num': return typeof value === 'number' && Number.isFinite(value) && (spec.min === undefined || value >= spec.min) ? value : bad()
    case 'bool': return typeof value === 'boolean' ? value : bad()
    case 'enum': return typeof value === 'string' && spec.values.includes(value) ? value : bad()
    case 'literal': return value === spec.value ? value : bad()
    case 'anyObj': return isObject(value) ? value : bad()
    case 'arr': {
      if (!Array.isArray(value)) return bad()
      return value.map((v, i) => check(spec.item, v, `${path}[${i + 1}]`, problems))
    }
    case 'dict': {
      if (!isObject(value)) return bad()
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, check(spec.item, v, `${path}.${k}`, problems)]))
    }
    case 'obj': return checkFields(spec.fields, value, path, problems)
  }
}

function checkFields(fields: Fields, value: unknown, path: string, problems: string[]): Record<string, unknown> | undefined {
  if (!isObject(value)) { problems.push(`${path} must be an object.`); return undefined }
  const out: Record<string, unknown> = {}
  for (const [name, f] of Object.entries(fields)) {
    const v = value[name]
    if (v === undefined || (v === null && f.optional)) {
      if (!f.optional) problems.push(`${path} is missing the required field "${name}".`)
      else if (v === null && f.nullable) out[name] = null
      continue
    }
    if (v === null && f.nullable) { out[name] = null; continue }
    const cleaned = check(f.spec, v, `${path} field "${name}"`, problems)
    if (cleaned !== undefined) out[name] = cleaned
  }
  return out
}

export interface StoreCheck {
  records: Record<string, unknown>[]
  problems: string[]
}

const MAX_PROBLEMS = 50

/** Checks every record of one store. Records are cleaned (unknown fields dropped). Problems name the store, the record number and the field. */
export function checkStore(store: StoreName, raw: unknown, keyField: string): StoreCheck {
  const label = STORE_LABEL[store]
  if (!Array.isArray(raw)) return { records: [], problems: [`The "${store}" part of the file must be a list.`] }
  const problems: string[] = []
  const records: Record<string, unknown>[] = []
  const seen = new Set<string>()
  raw.forEach((item, i) => {
    if (problems.length >= MAX_PROBLEMS) return
    const idText = isObject(item) && typeof item[keyField] === 'string' ? ` (${keyField} ${String(item[keyField]).slice(0, 12)})` : ''
    const where = `${label}, record ${i + 1}${idText}`
    const before = problems.length
    const cleaned = checkFields(RECORD_FIELDS[store], item, where, problems)
    if (problems.length === before && cleaned) {
      const key = String(cleaned[keyField])
      if (key === '') problems.push(`${where} has an empty ${keyField}.`)
      else if (seen.has(key)) problems.push(`${where} has the same ${keyField} as an earlier record in the same list.`)
      else { seen.add(key); records.push(cleaned) }
    }
  })
  if ((store === 'settings' || store === 'activeSession') && raw.length > 1) problems.push(`${label} may have at most one record, but the file has ${raw.length}.`)
  return { records, problems }
}
