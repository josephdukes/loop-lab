import { describe, expect, it } from 'vitest'
import {
  offsetForPosition,
  phaseJustFinished,
  phasesOf,
  positionFor,
  readyToMoveOn,
  scheduleBadge,
  type ProgramShape,
} from './programPosition'

const twelveWeek: ProgramShape = { sessionsPerWeek: 3, weekCount: 12, repeating: false }
const holistic: ProgramShape = { sessionsPerWeek: 3, weekCount: 4, repeating: true, cycleLengthWeeks: 4 }
const maintenance: ProgramShape = { sessionsPerWeek: 3, weekCount: 1, repeating: true, cycleLengthWeeks: 1 }

describe('program position (spec 3.7)', () => {
  it('12-week program, 7 completed: week 3, session 2', () => {
    const p = positionFor(twelveWeek, 7, 0)
    expect(p).toMatchObject({ week: 3, session: 2, cycleNumber: 1, finished: false })
  })
  it('starts at week 1 session 1', () => {
    expect(positionFor(twelveWeek, 0, 0)).toMatchObject({ week: 1, session: 1 })
  })
  it('the manual offset shifts the position', () => {
    expect(positionFor(twelveWeek, 7, 3)).toMatchObject({ week: 4, session: 2 })
    expect(positionFor(twelveWeek, 2, -5)).toMatchObject({ week: 1, session: 1 }) // never below the start
  })
  it('non-repeating: finished after the last session', () => {
    expect(positionFor(twelveWeek, 35, 0)).toMatchObject({ week: 12, session: 3, finished: false })
    expect(positionFor(twelveWeek, 36, 0).finished).toBe(true)
  })
  it('repeating 4-week program rolls into cycle 2', () => {
    expect(positionFor(holistic, 11, 0)).toMatchObject({ week: 4, session: 3, cycleNumber: 1 })
    expect(positionFor(holistic, 12, 0)).toMatchObject({ week: 1, session: 1, cycleNumber: 2, finished: false })
    expect(positionFor(holistic, 25, 0)).toMatchObject({ week: 1, session: 2, cycleNumber: 3 })
  })
  it('repeating 1-week program rolls every 3 sessions', () => {
    expect(positionFor(maintenance, 3, 0)).toMatchObject({ week: 1, session: 1, cycleNumber: 2 })
    expect(positionFor(maintenance, 5, 0)).toMatchObject({ week: 1, session: 3, cycleNumber: 2 })
  })
  it('set position computes an offset that lands on the chosen week and session', () => {
    const offset = offsetForPosition(twelveWeek, 7, 5, 3)
    expect(positionFor(twelveWeek, 7, offset)).toMatchObject({ week: 5, session: 3 })
    const back = offsetForPosition(twelveWeek, 7, 1, 1)
    expect(positionFor(twelveWeek, 7, back)).toMatchObject({ week: 1, session: 1 })
    const c2 = offsetForPosition(holistic, 4, 2, 1, 2)
    expect(positionFor(holistic, 4, c2)).toMatchObject({ week: 2, session: 1, cycleNumber: 2 })
  })
})

describe('phases and "Consider repeating this phase"', () => {
  const p1Weeks = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, title: `Phase ${Math.floor(i / 3) + 1}` }))
  const phases = phasesOf(p1Weeks)

  it('P1 phases are weeks 1-3, 4-6, 7-9, 10-12', () => {
    expect(phases.map((p) => [p.startWeek, p.endWeek])).toEqual([[1, 3], [4, 6], [7, 9], [10, 12]])
  })
  it('a phase that has just been left after 3 weeks is returned', () => {
    // 9 sessions done: last completed session was week 3, the next is week 4.
    expect(phaseJustFinished(phases, 3, 4)?.startWeek).toBe(1)
    expect(phaseJustFinished(phases, 9, 10)?.startWeek).toBe(7)
  })
  it('nothing while still inside the phase', () => {
    expect(phaseJustFinished(phases, 3, 3)).toBeNull()
    expect(phaseJustFinished(phases, 2, 3)).toBeNull()
    expect(phaseJustFinished(phases, null, 1)).toBeNull()
  })
  it('the last phase counts when the program is finished', () => {
    expect(phaseJustFinished(phases, 12, null)?.startWeek).toBe(10)
  })
  it('phases shorter than 3 weeks never trigger', () => {
    const p2 = phasesOf([{ weekNumber: 1, title: 'Week 1' }, { weekNumber: 2, title: 'Week 2' }])
    expect(phaseJustFinished(p2, 1, 2)).toBeNull()
  })
})

describe('ready to move on', () => {
  it('needs at least one benchmark and all met', () => {
    expect(readyToMoveOn([])).toBe(false)
    expect(readyToMoveOn(['met', 'met'])).toBe(true)
    expect(readyToMoveOn(['met', 'not_met'])).toBe(false)
    expect(readyToMoveOn(['met', 'no_data'])).toBe(false)
  })
})

describe('calendar badge', () => {
  // Started Monday 5 Oct 2026. On Tuesday 20 Oct 2026 (calendar week 3), 6 to 9 sessions is on track.
  it('behind, on track and ahead', () => {
    expect(scheduleBadge('2026-10-05', '2026-10-20', 3, 3)).toEqual({ state: 'behind', by: 3 })
    expect(scheduleBadge('2026-10-05', '2026-10-20', 3, 6)).toEqual({ state: 'on_track', by: 0 })
    expect(scheduleBadge('2026-10-05', '2026-10-20', 3, 9)).toEqual({ state: 'on_track', by: 0 })
    expect(scheduleBadge('2026-10-05', '2026-10-20', 3, 11)).toEqual({ state: 'ahead', by: 2 })
  })
  it('is on track on the first day with nothing done', () => {
    expect(scheduleBadge('2026-10-05', '2026-10-05', 3, 0)).toEqual({ state: 'on_track', by: 0 })
  })
  it('is not shifted by the clock change (date-only arithmetic)', () => {
    // Started Monday 19 Oct; Monday 26 Oct is exactly 7 days later even though 25 hours elapsed in between.
    expect(scheduleBadge('2026-10-19', '2026-10-26', 3, 2)).toEqual({ state: 'behind', by: 1 })
    expect(scheduleBadge('2026-10-19', '2026-10-25', 3, 2)).toEqual({ state: 'on_track', by: 0 })
  })
})
