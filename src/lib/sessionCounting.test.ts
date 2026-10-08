import { describe, expect, it } from 'vitest'
import { bucketByWeek, countsTowardTarget } from './sessionCounting'

describe('session counting (spec 3.2)', () => {
  it('counts a robot session only if it has at least one drill log', () => {
    expect(countsTowardTarget({ kind: 'robot', drillLogCount: 1 })).toBe(true)
    expect(countsTowardTarget({ kind: 'robot', drillLogCount: 0 })).toBe(false)
  })

  it('never counts a club session toward the target', () => {
    expect(countsTowardTarget({ kind: 'club', drillLogCount: 3 })).toBe(false)
  })

  it('buckets robot and club sessions into Monday-start weeks, club counted separately', () => {
    const weeks = bucketByWeek([
      { id: 'a', date: '2026-10-05', kind: 'robot', drillLogCount: 2 }, // Monday
      { id: 'b', date: '2026-10-11', kind: 'robot', drillLogCount: 1 }, // Sunday, same week
      { id: 'c', date: '2026-10-08', kind: 'club', drillLogCount: 1 },
      { id: 'd', date: '2026-10-09', kind: 'robot', drillLogCount: 0 }, // no drill logs: does not count
      { id: 'e', date: '2026-10-12', kind: 'robot', drillLogCount: 1 }, // next Monday
    ])
    expect(weeks.get('2026-10-05')).toEqual({ robot: 2, club: 1 })
    expect(weeks.get('2026-10-12')).toEqual({ robot: 1, club: 0 })
  })
})
