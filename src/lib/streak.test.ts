import { describe, expect, it } from 'vitest'
import { computeStreaks } from './streak'
import { bucketByWeek } from './sessionCounting'

// Weeks (Mondays): 2026-09-14, 09-21, 09-28, 10-05, and the current week 10-12.
const W = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']
const TODAY = '2026-10-14' // Wednesday of the current week

function weeks(counts: number[], starts = W) {
  return new Map(counts.map((c, i) => [starts[i], c]))
}

describe('streak (spec 3.3 worked example)', () => {
  it('target 3, weeks 3,4,2,3 then current week with 1 session: streak 1, longest 2', () => {
    const r = computeStreaks({ robotByWeek: weeks([3, 4, 2, 3, 1]), restWeeks: new Set(), target: 3, today: TODAY })
    expect(r).toEqual({ current: 1, longest: 2 })
  })

  it('when the current week reaches 3 sessions the streak becomes 2', () => {
    const r = computeStreaks({ robotByWeek: weeks([3, 4, 2, 3, 3]), restWeeks: new Set(), target: 3, today: TODAY })
    expect(r).toEqual({ current: 2, longest: 2 })
  })

  it('an unmet current week does not break the streak', () => {
    const r = computeStreaks({ robotByWeek: weeks([3, 3, 3, 3, 0]), restWeeks: new Set(), target: 3, today: TODAY })
    expect(r.current).toBe(4)
  })

  it('a rest week in the middle neither breaks nor adds to the streak', () => {
    // 3, 3, (rest: 0 sessions), 3, current 3 => 4 weeks counted, unbroken
    const r = computeStreaks({ robotByWeek: weeks([3, 3, 0, 3, 3]), restWeeks: new Set(['2026-09-28']), target: 3, today: TODAY })
    expect(r).toEqual({ current: 4, longest: 4 })
  })

  it('without the rest flag the same weeks break the streak', () => {
    const r = computeStreaks({ robotByWeek: weeks([3, 3, 0, 3, 3]), restWeeks: new Set(), target: 3, today: TODAY })
    expect(r).toEqual({ current: 2, longest: 2 })
  })

  it('a rest current week is skipped', () => {
    const r = computeStreaks({ robotByWeek: weeks([3, 3, 3, 3, 3]), restWeeks: new Set(['2026-10-12']), target: 3, today: TODAY })
    expect(r.current).toBe(4)
  })

  it('weeks with no sessions at all inside the history count as missed', () => {
    const r = computeStreaks({ robotByWeek: new Map([['2026-09-14', 3], ['2026-10-05', 3]]), restWeeks: new Set(), target: 3, today: TODAY })
    expect(r).toEqual({ current: 1, longest: 1 })
  })

  it('no sessions gives zero', () => {
    expect(computeStreaks({ robotByWeek: new Map(), restWeeks: new Set(), target: 3, today: TODAY })).toEqual({ current: 0, longest: 0 })
  })

  it('handles the week containing the UK clock change on Sunday 25 October 2026', () => {
    // Week Mon 19 Oct to Sun 25 Oct 2026. Sessions on Mon 19, Sat 24 and Sun 25 must all land in that week.
    const sessions = [
      { id: '1', date: '2026-10-12', kind: 'robot' as const, drillLogCount: 1 },
      { id: '2', date: '2026-10-14', kind: 'robot' as const, drillLogCount: 1 },
      { id: '3', date: '2026-10-16', kind: 'robot' as const, drillLogCount: 1 },
      { id: '4', date: '2026-10-19', kind: 'robot' as const, drillLogCount: 1 },
      { id: '5', date: '2026-10-24', kind: 'robot' as const, drillLogCount: 1 },
      { id: '6', date: '2026-10-25', kind: 'robot' as const, drillLogCount: 1 },
      { id: '7', date: '2026-10-26', kind: 'robot' as const, drillLogCount: 1 }, // next Monday: next week
    ]
    const buckets = bucketByWeek(sessions)
    expect(buckets.get('2026-10-19')?.robot).toBe(3)
    expect(buckets.get('2026-10-26')?.robot).toBe(1)
    const r = computeStreaks({
      robotByWeek: new Map([...buckets].map(([k, v]) => [k, v.robot])),
      restWeeks: new Set(),
      target: 3,
      today: '2026-10-27',
    })
    expect(r).toEqual({ current: 2, longest: 2 })
  })
})
