import { describe, expect, it } from 'vitest'
import { addMatch, addSession } from '../test/fixtures'
import { programByKey, useSeededDb } from '../test/helpers'
import { startProgramRun } from './programRuns'
import {
  compareWindows, cycleToReview, findReviewableRun, hasBlockReview, loadBlockReviewData, loadBlockReviews, previousWindow, reviewWindow, saveBlockReview, windowDays, windowStats,
} from './blockReview'
import { BLOCK_REVIEW_PROMPTS } from '../content/builtinContent'
import type { MatchLog } from '../db/types'

const harness = useSeededDb()

describe('windows', () => {
  it('uses first cycle session to today', () => {
    expect(reviewWindow(['2026-09-14', '2026-09-30'], '2026-10-07')).toEqual({ start: '2026-09-14', end: '2026-10-07', fallback: false })
  })
  it('falls back to the last 28 days', () => {
    expect(reviewWindow([], '2026-10-07')).toEqual({ start: '2026-09-10', end: '2026-10-07', fallback: true })
    expect(windowDays(reviewWindow([], '2026-10-07'))).toBe(28)
  })
  it('previous window has equal length and ends the day before', () => {
    const w = { start: '2026-09-14', end: '2026-10-07' }
    const p = previousWindow(w)
    expect(p.end).toBe('2026-09-13')
    expect(windowDays(p)).toBe(windowDays(w))
    expect(p.start).toBe('2026-08-21')
  })
  it('has the static prompts from 3.8', () => {
    expect(BLOCK_REVIEW_PROMPTS[0]).toMatch(/recognition under pressure/)
    expect(BLOCK_REVIEW_PROMPTS[1]).toMatch(/block\/counter rallies/)
  })
})

const match = (date: string, o: Partial<MatchLog>): MatchLog => ({
  id: date + Math.random(), date, competition: 'league', opponentStyle: 'hitter', result: 'W', gamesScore: '', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '', createdAt: date, updatedAt: date, ...o,
})

describe('comparison', () => {
  it('compares loops landed %, average confidence and best pl-streak against the previous window', () => {
    const matches = [
      match('2026-09-20', { loopsAttempted: 10, loopsLanded: 6, confidence: 4 }),
      match('2026-09-25', { loopsAttempted: 10, loopsLanded: 8, confidence: 5 }),
      match('2026-08-25', { loopsAttempted: 20, loopsLanded: 10, confidence: 2 }),
    ]
    const streaks = [{ date: '2026-09-21', streak: 9 }, { date: '2026-09-28', streak: 12 }, { date: '2026-08-30', streak: 7 }]
    const c = compareWindows(matches, streaks, ['2026-09-14'], '2026-10-07')
    expect(c.current).toMatchObject({ matches: 2, loopsAttempted: 20, loopsLanded: 14, loopPercent: 70, averageConfidence: 4.5, bestStreak: 12 })
    expect(c.previous).toMatchObject({ matches: 1, loopsAttempted: 20, loopsLanded: 10, loopPercent: 50, averageConfidence: 2, bestStreak: 7 })
  })
  it('empty windows give nulls, not zeros or NaN', () => {
    const s = windowStats([], [], { start: '2026-09-01', end: '2026-09-28' })
    expect(s).toMatchObject({ matches: 0, loopsAttempted: 0, loopPercent: null, averageConfidence: null, bestStreak: null })
  })
  it('knows which programs have a review and which cycle to review', () => {
    expect(hasBlockReview({ repeating: true, cycleLengthWeeks: 4, weeks: [] })).toBe(true)
    expect(hasBlockReview({ repeating: true, cycleLengthWeeks: 1, weeks: [] })).toBe(false)
    expect(hasBlockReview({ repeating: false, weeks: [] })).toBe(false)
    expect(cycleToReview({ cycleNumber: 2 }, new Map([[1, ['x']]]))).toBe(1)
    expect(cycleToReview({ cycleNumber: 2 }, new Map([[1, ['x']], [2, ['y']]]))).toBe(2)
    expect(cycleToReview({ cycleNumber: 1 }, new Map())).toBeNull()
  })
})

describe('database', () => {
  it('loads data for a run, links it, and saves a review record', async () => {
    const db = await harness.create()
    const p3 = await programByKey(db, 'P3')
    const run = await startProgramRun(db, p3, '2026-09-14')
    await addSession(db, { date: '2026-09-15', runId: run.id, week: 1, cycle: 1, logs: [{ drillKey: 'pl-streak', streak: 10 }] })
    await addMatch(db, { date: '2026-09-20', loopsAttempted: 10, loopsLanded: 7, confidence: 4 })
    const data = await loadBlockReviewData(db, run.id, '2026-10-07')
    expect(data.cycleNumber).toBe(1)
    expect(data.comparison.window).toEqual({ start: '2026-09-15', end: '2026-10-07' })
    expect(data.comparison.current).toMatchObject({ loopPercent: 70, bestStreak: 10 })
    const saved = await saveBlockReview(db, { runId: run.id, cycleNumber: 1, window: data.comparison.window, emphasisNotes: ' more pressure ', today: '2026-10-07' })
    const list = await loadBlockReviews(db)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: saved.id, programRunId: run.id, cycleNumber: 1, windowStart: '2026-09-15', windowEnd: '2026-10-07', emphasisNotes: 'more pressure', date: '2026-10-07' })
    expect((await findReviewableRun(db))?.id).toBe(run.id)
  })
  it('saves standalone with no run and uses the 28-day fallback', async () => {
    const db = await harness.create()
    expect(await findReviewableRun(db)).toBeUndefined()
    const data = await loadBlockReviewData(db, undefined, '2026-10-07')
    expect(data.comparison.fallback).toBe(true)
    const saved = await saveBlockReview(db, { window: data.comparison.window, emphasisNotes: 'x', today: '2026-10-07' })
    expect(saved.programRunId).toBeUndefined()
    expect(saved.cycleNumber).toBeUndefined()
    expect(await db.blockReviews.count()).toBe(1)
  })
  it('reviews the previous cycle when the run has just rolled into a new one', async () => {
    const db = await harness.create()
    const p3 = await programByKey(db, 'P3')
    const run = await startProgramRun(db, p3, '2026-09-01')
    await db.programRuns.put({ ...run, cycleNumber: 2 })
    await addSession(db, { date: '2026-09-03', runId: run.id, week: 1, cycle: 1 })
    const data = await loadBlockReviewData(db, run.id, '2026-10-07')
    expect(data.cycleNumber).toBe(1)
    expect(data.comparison.window.start).toBe('2026-09-03')
  })
})

import { describeChange } from './blockReview'
describe('describeChange', () => {
  it('words the movement and handles missing data', () => {
    expect(describeChange(70, 50, ' points')).toEqual({ direction: 'up', text: 'Up 20 points' })
    expect(describeChange(3.5, 4, '')).toEqual({ direction: 'down', text: 'Down 0.5' })
    expect(describeChange(4, 4, '')).toEqual({ direction: 'same', text: 'No change' })
    expect(describeChange(null, 4, '').direction).toBe('none')
  })
})
