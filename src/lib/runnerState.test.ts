import { describe, expect, it } from 'vitest'
import type { Drill } from '../db/types'
import {
  createRunnerDrill,
  createRunnerState,
  drillMinutes,
  isRecorded,
  isRunnerState,
  recordedCount,
  runnerReducer,
  suggestedTotalMinutes,
  timerRemainingSec,
  type RunnerAction,
  type RunnerState,
} from './runnerState'

const T0 = 1_000_000

function drill(over: Partial<Drill> & Pick<Drill, 'metricType'>): Drill {
  return {
    id: over.id ?? over.metricType,
    name: 'Drill ' + over.metricType,
    category: 'Loop from Backspin',
    description: 'desc',
    suggestedSettings: 'heavy backspin',
    cues: 'cue',
    source: 'custom',
    isBuiltIn: false,
    modifiedByUser: false,
    archived: false,
    createdAt: '',
    updatedAt: '',
    defaultDurationMin: 2,
    ...over,
  }
}

function makeState(...types: Drill['metricType'][]): RunnerState {
  return createRunnerState({
    startedAt: '2026-10-07T10:00:00.000Z',
    date: '2026-10-07',
    kind: 'robot',
    drills: types.map((t, i) => createRunnerDrill({ key: 'k' + i, drill: drill({ metricType: t }) })),
  })
}

function run(state: RunnerState, ...actions: RunnerAction[]) {
  return actions.reduce(runnerReducer, state)
}

describe('runner reducer: navigation', () => {
  it('opens at the first drill, Next moves on, Next on the last drill opens the summary', () => {
    let s = makeState('hits_attempts', 'rating')
    expect(s.currentIndex).toBe(0)
    s = run(s, { type: 'next', now: T0 })
    expect(s).toMatchObject({ currentIndex: 1, phase: 'drills' })
    s = run(s, { type: 'next', now: T0 })
    expect(s.phase).toBe('summary')
    s = run(s, { type: 'backToDrills' })
    expect(s).toMatchObject({ phase: 'drills', currentIndex: 1 })
  })
  it('Previous never goes below the first drill', () => {
    const s = run(makeState('rating', 'rating'), { type: 'previous', now: T0 })
    expect(s.currentIndex).toBe(0)
  })
  it('Skip marks the drill skipped and advances; changing its metric un-skips it', () => {
    let s = run(makeState('rating', 'rating'), { type: 'skip', now: T0 })
    expect(s.drills[0].skipped).toBe(true)
    expect(s.currentIndex).toBe(1)
    s = run(s, { type: 'setRating', index: 0, rating: 3 })
    expect(s.drills[0].skipped).toBe(false)
  })
  it('Skip on a drill with entered data behaves as Next: keeps and records it', () => {
    let s = makeState('hits_attempts', 'rating', 'duration', 'streak')
    s = run(s, { type: 'adjust', index: 0, field: 'attempts', delta: 10 }, { type: 'adjust', index: 0, field: 'hits', delta: 7 }, { type: 'skip', now: T0 })
    expect(s.drills[0]).toMatchObject({ skipped: false, hits: 7, attempts: 10 })
    expect(isRecorded(s.drills[0], T0)).toBe(true)
    expect(s.currentIndex).toBe(1)
    // untouched drill is still skipped
    s = run(s, { type: 'skip', now: T0 })
    expect(s.drills[1].skipped).toBe(true)
    expect(isRecorded(s.drills[1], T0)).toBe(false)
    // manual minutes entered on a duration drill are kept
    s = run(s, { type: 'setManualMinutes', index: 2, minutes: 4 }, { type: 'skip', now: T0 })
    expect(s.drills[2].skipped).toBe(false)
    expect(isRecorded(s.drills[2], T0)).toBe(true)
  })
  it('leaving a drill pauses its running timer', () => {
    let s = makeState('rating', 'rating')
    s = run(s, { type: 'timerStart', index: 0, now: T0 }, { type: 'next', now: T0 + 30_000 })
    expect(s.drills[0].timer).toMatchObject({ running: false, remainingSec: 90 })
  })
})

describe('runner reducer: metrics', () => {
  it('hits_attempts: Hit and Miss increment attempts, Hit also increments hits', () => {
    const s = run(makeState('hits_attempts'),
      { type: 'hitMiss', index: 0, result: 'hit' },
      { type: 'hitMiss', index: 0, result: 'hit' },
      { type: 'hitMiss', index: 0, result: 'miss' })
    expect(s.drills[0]).toMatchObject({ hits: 2, attempts: 3, touched: true })
  })
  it('steppers: hits can never exceed attempts and attempts can never drop below hits', () => {
    let s = makeState('hits_attempts')
    s = run(s, { type: 'adjust', index: 0, field: 'hits', delta: 1 })
    expect(s.drills[0].hits).toBe(0)
    s = run(s, { type: 'adjust', index: 0, field: 'attempts', delta: 5 }, { type: 'adjust', index: 0, field: 'hits', delta: 4 })
    expect(s.drills[0]).toMatchObject({ hits: 4, attempts: 5 })
    s = run(s, { type: 'adjust', index: 0, field: 'attempts', delta: -3 })
    expect(s.drills[0]).toMatchObject({ hits: 2, attempts: 2 })
    s = run(s, { type: 'adjust', index: 0, field: 'attempts', delta: -10 })
    expect(s.drills[0]).toMatchObject({ hits: 0, attempts: 0 })
  })
  it('streak: stepper changes the current run, New best copies it to the best streak', () => {
    let s = run(makeState('streak'),
      { type: 'adjust', index: 0, field: 'streakCurrent', delta: 1 },
      { type: 'adjust', index: 0, field: 'streakCurrent', delta: 1 },
      { type: 'adjust', index: 0, field: 'streakCurrent', delta: 1 },
      { type: 'newBest', index: 0 })
    expect(s.drills[0]).toMatchObject({ streak: 3, streakCurrent: 3 })
    s = run(s, { type: 'adjust', index: 0, field: 'streakCurrent', delta: -3 }, { type: 'newBest', index: 0 })
    expect(s.drills[0]).toMatchObject({ streak: 3, streakCurrent: 0 }) // best is never lowered
  })
  it('score_vs_robot: two counters that never go below zero', () => {
    const s = run(makeState('score_vs_robot'),
      { type: 'adjust', index: 0, field: 'scoreYou', delta: 1 },
      { type: 'adjust', index: 0, field: 'scoreRobot', delta: -1 })
    expect(s.drills[0]).toMatchObject({ scoreYou: 1, scoreRobot: 0 })
  })
  it('rating: 1 to 5 only', () => {
    expect(run(makeState('rating'), { type: 'setRating', index: 0, rating: 9 }).drills[0].rating).toBe(5)
    expect(run(makeState('rating'), { type: 'setRating', index: 0, rating: 0 }).drills[0].rating).toBe(1)
  })
  it('notes and settings used are stored per drill', () => {
    const s = run(makeState('rating'), { type: 'setNote', index: 0, note: 'good' }, { type: 'setSettings', index: 0, text: 'medium' })
    expect(s.drills[0]).toMatchObject({ note: 'good', settingsUsed: 'medium' })
  })
  it('settings used is prefilled from the suggested settings', () => {
    expect(makeState('rating').drills[0].settingsUsed).toBe('heavy backspin')
  })
  it('ignores actions for a drill index that does not exist', () => {
    const s = makeState('rating')
    expect(runnerReducer(s, { type: 'setRating', index: 7, rating: 3 })).toBe(s)
  })
})

describe('runner reducer: timers', () => {
  it('starts, counts down by the clock and pauses with the remaining time', () => {
    let s = run(makeState('rating'), { type: 'timerStart', index: 0, now: T0 })
    expect(timerRemainingSec(s.drills[0].timer, T0 + 45_000)).toBe(75)
    s = run(s, { type: 'timerPause', index: 0, now: T0 + 45_000 })
    expect(s.drills[0].timer).toMatchObject({ running: false, remainingSec: 75 })
    expect(timerRemainingSec(s.drills[0].timer, T0 + 999_000)).toBe(75)
  })
  it('+1 minute extends a running or paused timer', () => {
    let s = run(makeState('rating'), { type: 'timerStart', index: 0, now: T0 }, { type: 'timerAddMinute', index: 0, now: T0 + 20_000 })
    expect(timerRemainingSec(s.drills[0].timer, T0 + 20_000)).toBe(160)
    s = run(makeState('rating'), { type: 'timerAddMinute', index: 0, now: T0 })
    expect(s.drills[0].timer).toMatchObject({ totalSec: 180, remainingSec: 180, running: false })
  })
  it('finish only takes effect once the time is up', () => {
    let s = run(makeState('rating'), { type: 'timerStart', index: 0, now: T0 }, { type: 'timerFinish', index: 0, now: T0 + 60_000 })
    expect(s.drills[0].timer.running).toBe(true)
    s = run(s, { type: 'timerFinish', index: 0, now: T0 + 120_000 })
    expect(s.drills[0].timer).toMatchObject({ running: false, remainingSec: 0 })
  })
  it('a finished timer can be extended by +1 minute and started again', () => {
    let s = run(makeState('rating'), { type: 'timerStart', index: 0, now: T0 }, { type: 'timerFinish', index: 0, now: T0 + 120_000 }, { type: 'timerAddMinute', index: 0, now: T0 + 130_000 })
    expect(s.drills[0].timer).toMatchObject({ remainingSec: 60, running: false })
    s = run(s, { type: 'timerStart', index: 0, now: T0 + 140_000 })
    expect(s.drills[0].timer.running).toBe(true)
  })
  it('restore pauses a timer at the moment of the last save', () => {
    let s = run(makeState('rating'), { type: 'timerStart', index: 0, now: T0 })
    s = run(s, { type: 'restore', savedAtMs: T0 + 30_000 })
    expect(s.drills[0].timer).toMatchObject({ running: false, remainingSec: 90 })
  })
  it('elapsed time from timers gives the suggested total minutes; with no timers use the planned minutes of recorded drills', () => {
    let s = makeState('rating', 'rating')
    s = run(s, { type: 'setRating', index: 0, rating: 4 })
    expect(suggestedTotalMinutes(s, T0)).toBe(2) // planned 2 min for the one recorded drill
    s = run(s, { type: 'timerStart', index: 1, now: T0 }, { type: 'timerPause', index: 1, now: T0 + 90_000 })
    expect(suggestedTotalMinutes(s, T0 + 90_000)).toBe(2) // 90 s rounds to 2 min
    expect(drillMinutes(s.drills[1], T0 + 90_000)).toBe(2)
  })
})

describe('runner state: recorded drills and validation', () => {
  it('a drill is recorded only when it has a result and is not skipped', () => {
    let s = makeState('hits_attempts', 'streak', 'score_vs_robot', 'duration', 'rating')
    expect(recordedCount(s, T0)).toBe(0)
    s = run(s,
      { type: 'hitMiss', index: 0, result: 'miss' },
      { type: 'adjust', index: 1, field: 'streakCurrent', delta: 0 },
      { type: 'adjust', index: 2, field: 'scoreRobot', delta: 1 },
      { type: 'setManualMinutes', index: 3, minutes: 6 },
      { type: 'setRating', index: 4, rating: 2 })
    expect(recordedCount(s, T0)).toBe(5)
    s = run(s, { type: 'goTo', index: 4, now: T0 }, { type: 'skip', now: T0 })
    expect(isRecorded(s.drills[4], T0)).toBe(true) // Skip keeps entered data (Finding 3)
  })
  it('isRunnerState accepts a good state and rejects junk', () => {
    expect(isRunnerState(makeState('rating'))).toBe(true)
    expect(isRunnerState(null)).toBe(false)
    expect(isRunnerState({ version: 1, drills: 'x' })).toBe(false)
    expect(isRunnerState({ ...makeState('rating'), version: 99 })).toBe(false)
  })
  it('summary and meta patches', () => {
    const s = run(makeState('rating'), { type: 'setSummary', patch: { effort: 4, notes: 'ok' } }, { type: 'setMeta', patch: { date: '2026-10-01', kind: 'club' } })
    expect(s.summary).toMatchObject({ effort: 4, notes: 'ok', loopConfidence: null })
    expect(s).toMatchObject({ date: '2026-10-01', kind: 'club' })
  })
  it('add and remove drills keep the current index valid', () => {
    let s = makeState('rating', 'rating')
    s = run(s, { type: 'goTo', index: 1, now: T0 }, { type: 'removeDrill', index: 1 })
    expect(s.currentIndex).toBe(0)
    s = run(s, { type: 'addDrill', drill: createRunnerDrill({ key: 'z', drill: drill({ metricType: 'streak' }) }) })
    expect(s.drills).toHaveLength(2)
  })
})

describe('runner reducer: moveDrill (Quick log ordering)', () => {
  const keys = (s: RunnerState) => s.drills.map((d) => d.key)
  it('moves a drill up or down by one place', () => {
    let s = makeState('hits_attempts', 'rating', 'streak')
    s = run(s, { type: 'moveDrill', index: 2, delta: -1 })
    expect(keys(s)).toEqual(['k0', 'k2', 'k1'])
    s = run(s, { type: 'moveDrill', index: 0, delta: 1 })
    expect(keys(s)).toEqual(['k2', 'k0', 'k1'])
  })
  it('ignores a move off either end or out of range', () => {
    const s = makeState('hits_attempts', 'rating')
    expect(run(s, { type: 'moveDrill', index: 0, delta: -1 })).toBe(s)
    expect(run(s, { type: 'moveDrill', index: 1, delta: 1 })).toBe(s)
    expect(run(s, { type: 'moveDrill', index: 5, delta: -1 })).toBe(s)
  })
})
