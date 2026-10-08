// Session runner state and its pure reducer (spec section 5). UI components stay thin: they only dispatch actions.
// The same state is used by the quick log / edit form (no timers shown there).
//
// Timers store a wall-clock `endsAt` while running, so the state only changes when a timer is started,
// paused, extended or finished (not every second). Use timerRemainingSec(timer, now) to display it.
import type { Benchmark, Drill, MetricType, SessionKind, SessionTemplateItem } from '../db/types'

export const RUNNER_STATE_VERSION = 1
export const DEFAULT_TIMER_MIN = 5

export interface TimerState {
  /** Total seconds including any +1 minute additions. */
  totalSec: number
  /** Seconds left as of the last start/pause/finish (use timerRemainingSec for the live value). */
  remainingSec: number
  running: boolean
  /** Epoch ms when a running timer reaches zero. */
  endsAt: number | null
}

export interface RunnerDrill {
  /** Unique within the session; used for React keys. */
  key: string
  drillId: string
  name: string
  category: string
  metricType: MetricType
  description: string
  suggestedSettings: string
  cues: string
  plannedMinutes?: number
  plannedAttempts?: number
  /** The effective benchmark: the program slot's override, else the template item's, else the drill's. */
  target?: Benchmark
  /** Note from the template item or program slot (for example "tired, end of session"). */
  templateNote?: string
  /** The editable "settings used" field, prefilled from suggestedSettings. */
  settingsUsed: string
  hits: number
  attempts: number
  /** Best streak recorded for the drill. */
  streak: number
  /** Count in the current run; "New best" copies it to `streak`. */
  streakCurrent: number
  scoreYou: number
  scoreRobot: number
  rating: number | null
  /** Manual minutes (duration drills, or an override of the timer). */
  manualMinutes: number | null
  note: string
  /** True once the metric has been changed by the user. */
  touched: boolean
  skipped: boolean
  timer: TimerState
}

export interface RunnerSummaryForm {
  effort: number | null
  loopConfidence: number | null
  notes: string
  /** null = not edited yet: use the suggested value. */
  totalMinutes: number | null
}

export interface RunnerState {
  version: typeof RUNNER_STATE_VERSION
  startedAt: string
  date: string
  kind: SessionKind
  templateId?: string
  templateName?: string
  programRunId?: string
  programWeek?: number
  programCycle?: number
  sessionLabel?: string
  currentIndex: number
  phase: 'drills' | 'summary'
  drills: RunnerDrill[]
  summary: RunnerSummaryForm
}

// --- timers ----------------------------------------------------------------------------------

export function newTimer(minutes: number): TimerState {
  const sec = Math.max(0, Math.round(minutes * 60))
  return { totalSec: sec, remainingSec: sec, running: false, endsAt: null }
}

export function timerRemainingSec(t: TimerState, now: number): number {
  if (!t.running || t.endsAt === null) return t.remainingSec
  return Math.max(0, Math.ceil((t.endsAt - now) / 1000))
}

export function timerElapsedSec(t: TimerState, now: number): number {
  return Math.max(0, t.totalSec - timerRemainingSec(t, now))
}

function pauseTimer(t: TimerState, now: number): TimerState {
  if (!t.running) return t
  return { ...t, running: false, endsAt: null, remainingSec: timerRemainingSec(t, now) }
}

// --- creation --------------------------------------------------------------------------------

export function createRunnerDrill(params: {
  key: string
  drill: Drill
  item?: Pick<SessionTemplateItem, 'durationMin' | 'note'>
  benchmark?: Benchmark
  note?: string
  durationMin?: number
}): RunnerDrill {
  const { drill, item } = params
  const planned = params.durationMin ?? item?.durationMin ?? drill.defaultDurationMin
  const target = params.benchmark ?? drill.benchmark
  const templateNote = params.note ?? item?.note
  return {
    key: params.key,
    drillId: drill.id,
    name: drill.name,
    category: drill.category,
    metricType: drill.metricType,
    description: drill.description,
    suggestedSettings: drill.suggestedSettings,
    cues: drill.cues,
    plannedMinutes: planned,
    plannedAttempts: drill.defaultAttempts,
    target,
    templateNote,
    settingsUsed: drill.suggestedSettings,
    hits: 0,
    attempts: 0,
    streak: 0,
    streakCurrent: 0,
    scoreYou: 0,
    scoreRobot: 0,
    rating: null,
    manualMinutes: null,
    note: '',
    touched: false,
    skipped: false,
    timer: newTimer(planned ?? DEFAULT_TIMER_MIN),
  }
}

export function createRunnerState(params: {
  startedAt: string
  date: string
  kind: SessionKind
  drills: RunnerDrill[]
  templateId?: string
  templateName?: string
  programRunId?: string
  programWeek?: number
  programCycle?: number
  sessionLabel?: string
}): RunnerState {
  const { drills, ...rest } = params
  return {
    version: RUNNER_STATE_VERSION,
    ...rest,
    currentIndex: 0,
    phase: 'drills',
    drills,
    summary: { effort: null, loopConfidence: null, notes: '', totalMinutes: null },
  }
}

/** Runtime check for a state read back from IndexedDB (a corrupt or old record must not crash the app). */
export function isRunnerState(v: unknown): v is RunnerState {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<RunnerState>
  return (
    s.version === RUNNER_STATE_VERSION &&
    Array.isArray(s.drills) &&
    s.drills.every((d) => d && typeof d === 'object' && typeof d.drillId === 'string' && typeof d.metricType === 'string' && d.timer && typeof d.timer === 'object') &&
    typeof s.currentIndex === 'number' &&
    (s.phase === 'drills' || s.phase === 'summary') &&
    typeof s.date === 'string' &&
    !!s.summary &&
    typeof s.summary === 'object'
  )
}

// --- actions ---------------------------------------------------------------------------------

type CountField = 'hits' | 'attempts' | 'streakCurrent' | 'scoreYou' | 'scoreRobot'

export type RunnerAction =
  | { type: 'restore'; savedAtMs: number }
  | { type: 'goTo'; index: number; now: number }
  | { type: 'next'; now: number }
  | { type: 'previous'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'backToDrills' }
  | { type: 'hitMiss'; index: number; result: 'hit' | 'miss' }
  | { type: 'adjust'; index: number; field: CountField; delta: number }
  | { type: 'newBest'; index: number }
  | { type: 'setRating'; index: number; rating: number }
  | { type: 'setNote'; index: number; note: string }
  | { type: 'setSettings'; index: number; text: string }
  | { type: 'setManualMinutes'; index: number; minutes: number | null }
  | { type: 'timerStart'; index: number; now: number }
  | { type: 'timerPause'; index: number; now: number }
  | { type: 'timerAddMinute'; index: number; now: number }
  | { type: 'timerFinish'; index: number; now: number }
  | { type: 'setSummary'; patch: Partial<RunnerSummaryForm> }
  | { type: 'setMeta'; patch: { date?: string; kind?: SessionKind } }
  | { type: 'addDrill'; drill: RunnerDrill }
  | { type: 'removeDrill'; index: number }
  | { type: 'moveDrill'; index: number; delta: -1 | 1 }

function patchDrill(state: RunnerState, index: number, fn: (d: RunnerDrill) => RunnerDrill): RunnerState {
  if (index < 0 || index >= state.drills.length) return state
  const drills = state.drills.slice()
  drills[index] = fn(state.drills[index])
  return { ...state, drills }
}

/** Changing a metric marks the drill as touched and un-skips it. */
function touch(d: RunnerDrill): RunnerDrill {
  return { ...d, touched: true, skipped: false }
}

function clampInt(n: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function pauseCurrent(state: RunnerState, now: number): RunnerState {
  return patchDrill(state, state.currentIndex, (d) => ({ ...d, timer: pauseTimer(d.timer, now) }))
}

function leaveTo(state: RunnerState, index: number, now: number): RunnerState {
  const paused = pauseCurrent(state, now)
  const last = paused.drills.length - 1
  if (index > last) return { ...paused, phase: 'summary' }
  return { ...paused, phase: 'drills', currentIndex: clampInt(index, 0, Math.max(0, last)) }
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'restore': {
      // A timer that was running when the app was killed is paused at the moment of the last save.
      return { ...state, drills: state.drills.map((d) => ({ ...d, timer: pauseTimer(d.timer, action.savedAtMs) })) }
    }
    case 'goTo':
      return leaveTo(state, action.index, action.now)
    case 'next':
      return leaveTo(state, state.currentIndex + 1, action.now)
    case 'previous':
      return leaveTo(state, Math.max(0, state.currentIndex - 1), action.now)
    case 'skip': {
      // Skip never discards entered data: a drill that already has a result is kept (same as Next).
      const marked = patchDrill(state, state.currentIndex, (d) => (hasResult(d, action.now) ? d : { ...d, skipped: true }))
      return leaveTo(marked, state.currentIndex + 1, action.now)
    }
    case 'backToDrills':
      return { ...state, phase: 'drills', currentIndex: Math.max(0, state.drills.length - 1) }
    case 'hitMiss':
      return patchDrill(state, action.index, (d) => {
        const attempts = d.attempts + 1
        const hits = action.result === 'hit' ? d.hits + 1 : d.hits
        return touch({ ...d, attempts, hits })
      })
    case 'adjust':
      return patchDrill(state, action.index, (d) => {
        const next = { ...d }
        if (action.field === 'attempts') {
          next.attempts = clampInt(d.attempts + action.delta, 0)
          next.hits = Math.min(next.hits, next.attempts)
        } else if (action.field === 'hits') {
          next.hits = clampInt(d.hits + action.delta, 0, d.attempts)
        } else {
          next[action.field] = clampInt(d[action.field] + action.delta, 0)
        }
        return touch(next)
      })
    case 'newBest':
      return patchDrill(state, action.index, (d) => touch({ ...d, streak: Math.max(d.streak, d.streakCurrent) }))
    case 'setRating':
      return patchDrill(state, action.index, (d) => touch({ ...d, rating: clampInt(action.rating, 1, 5) }))
    case 'setNote':
      return patchDrill(state, action.index, (d) => ({ ...d, note: action.note }))
    case 'setSettings':
      return patchDrill(state, action.index, (d) => ({ ...d, settingsUsed: action.text }))
    case 'setManualMinutes':
      return patchDrill(state, action.index, (d) =>
        action.minutes === null
          ? { ...d, manualMinutes: null }
          : { ...(d.metricType === 'duration' ? touch(d) : d), manualMinutes: clampInt(action.minutes, 0) },
      )
    case 'timerStart':
      return patchDrill(state, action.index, (d) => {
        if (d.timer.running || d.timer.remainingSec <= 0) return d
        return { ...d, timer: { ...d.timer, running: true, endsAt: action.now + d.timer.remainingSec * 1000 } }
      })
    case 'timerPause':
      return patchDrill(state, action.index, (d) => ({ ...d, timer: pauseTimer(d.timer, action.now) }))
    case 'timerAddMinute':
      return patchDrill(state, action.index, (d) => {
        const t = d.timer
        const base = pauseTimer(t, action.now)
        const added = { ...base, totalSec: base.totalSec + 60, remainingSec: base.remainingSec + 60 }
        return { ...d, timer: t.running ? { ...added, running: true, endsAt: action.now + added.remainingSec * 1000 } : added }
      })
    case 'timerFinish':
      return patchDrill(state, action.index, (d) => {
        const t = d.timer
        if (!t.running || timerRemainingSec(t, action.now) > 0) return d
        return { ...d, timer: { ...t, running: false, endsAt: null, remainingSec: 0 } }
      })
    case 'setSummary':
      return { ...state, summary: { ...state.summary, ...action.patch } }
    case 'setMeta':
      return { ...state, ...action.patch }
    case 'addDrill':
      return { ...state, drills: [...state.drills, action.drill] }
    case 'removeDrill': {
      const drills = state.drills.filter((_, i) => i !== action.index)
      return { ...state, drills, currentIndex: clampInt(state.currentIndex, 0, Math.max(0, drills.length - 1)) }
    }
    case 'moveDrill': {
      // Used by the quick log form to put drills in order (the order is saved as the drill logs' order).
      const to = action.index + action.delta
      if (action.index < 0 || action.index >= state.drills.length || to < 0 || to >= state.drills.length) return state
      const drills = state.drills.slice()
      const [moved] = drills.splice(action.index, 1)
      drills.splice(to, 0, moved)
      return { ...state, drills }
    }
  }
}

// --- derived values --------------------------------------------------------------------------

/** Minutes for a drill log: manual entry wins, else the timer's elapsed time (rounded), else undefined. */
export function drillMinutes(d: RunnerDrill, now: number): number | undefined {
  if (d.manualMinutes !== null) return d.manualMinutes
  const mins = Math.round(timerElapsedSec(d.timer, now) / 60)
  return mins > 0 ? mins : undefined
}

/** Does this drill have a result that can be saved as a drill log? Skipped drills never are. */
export function isRecorded(d: RunnerDrill, now: number): boolean {
  if (d.skipped) return false
  return hasResult(d, now)
}

/** Has anything been entered for this drill (ignoring the skipped flag)? Used so Skip never throws data away. */
export function hasResult(d: RunnerDrill, now: number): boolean {
  switch (d.metricType) {
    case 'hits_attempts':
      return d.attempts >= 1
    case 'streak':
    case 'score_vs_robot':
      return d.touched
    case 'rating':
      return d.rating !== null
    case 'duration':
      return d.manualMinutes !== null || timerElapsedSec(d.timer, now) > 0
  }
}

/** Streak to save: the larger of the recorded best and the current run (nothing typed is lost). */
export function streakToSave(d: RunnerDrill): number {
  return Math.max(d.streak, d.streakCurrent)
}

/**
 * Total minutes to prefill in the summary form: the timers' elapsed time. If no timer was used,
 * the planned minutes of the recorded drills (labelled assumption in STATUS.md).
 */
export function suggestedTotalMinutes(state: RunnerState, now: number): number {
  const elapsed = state.drills.reduce((sum, d) => sum + (d.skipped ? 0 : timerElapsedSec(d.timer, now)), 0)
  if (elapsed > 0) return Math.round(elapsed / 60)
  return state.drills.filter((d) => isRecorded(d, now)).reduce((sum, d) => sum + (d.plannedMinutes ?? 0), 0)
}

export function effectiveTotalMinutes(state: RunnerState, now: number): number {
  return state.summary.totalMinutes ?? suggestedTotalMinutes(state, now)
}

export function recordedCount(state: RunnerState, now: number): number {
  return state.drills.filter((d) => isRecorded(d, now)).length
}
