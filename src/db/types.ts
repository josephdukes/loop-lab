// Record types for every IndexedDB store (spec section 4).
// All dates named `date` are local calendar dates as YYYY-MM-DD. createdAt/updatedAt are ISO timestamps.

export type MetricType = 'hits_attempts' | 'streak' | 'score_vs_robot' | 'duration' | 'rating'
export type DrillSource = 'original' | 'holistic' | 'pressure' | 'starter-draft' | 'custom'
export type SessionKind = 'robot' | 'club'

export interface Timestamps {
  createdAt: string
  updatedAt: string
}

/** Spec 3.6. For hits_attempts threshold is a ratio (0.8 = 8/10); for streak it is the minimum streak. */
export interface Benchmark {
  metricType: MetricType
  threshold: number
  minAttempts?: number
  consecutiveSessions: number
  description: string
}

export interface Drill extends Timestamps {
  id: string
  builtInKey?: string
  name: string
  category: string
  description: string
  metricType: MetricType
  defaultAttempts?: number
  defaultDurationMin?: number
  suggestedSettings: string
  cues: string
  benchmark?: Benchmark
  source: DrillSource
  isBuiltIn: boolean
  modifiedByUser: boolean
  archived: boolean
}

export interface SessionTemplateItem {
  drillId: string
  order: number
  durationMin?: number
  note?: string
  benchmarkOverride?: Benchmark
}

export interface SessionTemplate extends Timestamps {
  id: string
  builtInKey?: string
  name: string
  kind: SessionKind
  items: SessionTemplateItem[]
  isBuiltIn: boolean
  modifiedByUser: boolean
  archived: boolean
}

export interface ProgramSessionSlot {
  label: string
  templateId: string
  /** Per-drill overrides for this slot (e.g. the pressure-loop plan's different targets). Keyed by drillId. */
  itemOverrides?: Record<string, { benchmarkOverride?: Benchmark; note?: string; durationMin?: number }>
}

export interface ProgramWeek {
  weekNumber: number
  title: string
  goal?: string
  sessions: ProgramSessionSlot[]
}

export interface Program extends Timestamps {
  id: string
  builtInKey?: string
  name: string
  category: string
  description: string
  repeating: boolean
  cycleLengthWeeks?: number
  sessionsPerWeek: number
  weeks: ProgramWeek[]
  /** Shown as guidance cards. */
  notes: string
  isBuiltIn: boolean
  modifiedByUser: boolean
  archived: boolean
}

export type ProgramRunStatus = 'active' | 'paused' | 'completed'

export interface ProgramRun extends Timestamps {
  id: string
  programId: string
  startDate: string
  status: ProgramRunStatus
  manualOffsetSessions: number
  cycleNumber: number
}

export interface SessionLog extends Timestamps {
  id: string
  date: string
  startedAt?: string
  endedAt?: string
  totalMinutes: number
  kind: SessionKind
  programRunId?: string
  programWeek?: number
  /** Stage 2 addition: which cycle of a repeating program this session belonged to. */
  programCycle?: number
  sessionLabel?: string
  templateId?: string
  templateNameSnapshot?: string
  effort?: number
  loopConfidence?: number
  notes: string
}

export interface DrillLog extends Timestamps {
  id: string
  sessionId: string
  order: number
  drillId: string
  drillNameSnapshot: string
  categorySnapshot: string
  metricType: MetricType
  hits?: number
  attempts?: number
  streak?: number
  scoreYou?: number
  scoreRobot?: number
  rating?: number
  durationMin?: number
  robotSettingsUsed?: string
  note?: string
  /** minAttempts is a stage 2 addition so an edited log can be re-evaluated against its original target. */
  targetSnapshot?: { value: number; description: string; minAttempts?: number }
  benchmarkMet?: boolean | null
}

export type Competition = 'league' | 'club' | 'friendly'
export type OpponentStyle = 'hitter' | 'chopper' | 'blocker' | 'looper' | 'other'

export interface MatchLog extends Timestamps {
  id: string
  date: string
  competition: Competition
  opponent?: string
  opponentStyle: OpponentStyle
  result: 'W' | 'L'
  gamesScore: string
  serveFaced: string
  loopsAttempted?: number
  loopsLanded?: number
  confidence: number
  cueUsed: string
  breakdownNote: string
  notes: string
}

export interface BlockReview extends Timestamps {
  id: string
  /** Stage 3: optional, so a review opened with no active repeating run can be saved standalone. */
  programRunId?: string
  cycleNumber?: number
  date: string
  windowStart: string
  windowEnd: string
  emphasisNotes: string
}

export interface WeekFlag extends Timestamps {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string
  isRest: boolean
}

export type Theme = 'dark' | 'light'

/** Single record, key "settings". */
export interface Settings extends Timestamps {
  key: 'settings'
  weeklyTarget: number
  theme: Theme
  timerSound: boolean
  timerVibrate: boolean
  lastBackupAt?: string
  /** Stage 4 addition (no migration needed): "Remind me later" on the Home backup banner hides it until this time. */
  backupSnoozedUntil?: string
  backupReminderDays: number
  summaryWeeks: number
  contentVersion: number
}

/**
 * Single record, key "active": the in-progress runner state, saved on every change.
 * `state` holds a RunnerState (see src/lib/runnerState.ts).
 */
export interface ActiveSession extends Timestamps {
  key: 'active'
  state: Record<string, unknown>
}
