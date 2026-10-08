import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSeededDb } from '../test/helpers'
import { addSession } from '../test/fixtures'
import { behindOnTargetText } from './behindTarget'
import { todayLocal } from './dates'
import { loadHome } from './homeData'
import { setRestWeek } from './weekFlags'

// Week of Mon 2026-10-05.
const clock = (y: number, m: number, d: number) => { vi.setSystemTime(new Date(y, m, d, 12, 0)); return todayLocal() }
const rule = (today: string, robotThisWeek: number, extra: { isRestWeek?: boolean; weeklyTarget?: number } = {}) =>
  behindOnTargetText({ today, robotThisWeek, isRestWeek: false, weeklyTarget: 3, ...extra })

describe('behind-on-target banner rule (spec 8, Finding 4)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is hidden on Monday and Wednesday even when behind', () => {
    expect(rule(clock(2026, 9, 5), 0)).toBeNull()
    expect(rule(clock(2026, 9, 7), 1)).toBeNull()
  })
  it('shows from Thursday with the days left counting today', () => {
    expect(rule(clock(2026, 9, 8), 1)).toBe('1 of 3 robot sessions this week, 4 days left (including today)')
    expect(rule(clock(2026, 9, 11), 2)).toBe('2 of 3 robot sessions this week, 1 day left (including today)')
  })
  it('is hidden in a rest week', () => {
    expect(rule(clock(2026, 9, 9), 0, { isRestWeek: true })).toBeNull()
  })
  it('disappears when the target is met or exceeded', () => {
    expect(rule(clock(2026, 9, 8), 3)).toBeNull()
    expect(rule(clock(2026, 9, 11), 4)).toBeNull()
  })
  it('uses the clock-change week correctly (Sunday 25 Oct 2026 has 1 day left)', () => {
    expect(rule(clock(2026, 9, 25), 0)).toBe('0 of 3 robot sessions this week, 1 day left (including today)')
  })
})

describe('behind-on-target on Home data', () => {
  const h = useSeededDb()
  it('is set by loadHome from sessions, the target and rest weeks', async () => {
    const db = await h.create()
    await addSession(db, { date: '2026-10-06', kind: 'robot', minutes: 30, logs: [{ drillKey: 'orig-A', hits: 8, attempts: 10 }] })
    expect((await loadHome(db, '2026-10-07', 3)).behindText).toBeNull() // Wednesday
    expect((await loadHome(db, '2026-10-08', 3)).behindText).toBe('1 of 3 robot sessions this week, 4 days left (including today)')
    expect((await loadHome(db, '2026-10-08', 1)).behindText).toBeNull() // target met
    await setRestWeek(db, '2026-10-05', true, '2026-10-08')
    expect((await loadHome(db, '2026-10-08', 3)).behindText).toBeNull()
  })
})
