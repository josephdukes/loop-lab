import { describe, expect, it } from 'vitest'
import type { Drill, DrillLog } from '../db/types'
import { computeStreaks } from './streak'
import {
  buildBoard, buildWeekBars, confidenceByWeek, drillSeries, groupRowsByDrill, timeByCategory, weeksForRange, yDomain,
  type DrillLogRow, type SessionStat,
} from './progressData'

const sess = (id: string, date: string, over: Partial<SessionStat> = {}): SessionStat => ({ id, date, kind: 'robot', totalMinutes: 30, drillCount: 1, ...over })

function log(over: Partial<DrillLog>): DrillLog {
  return { id: Math.random().toString(), sessionId: 's', order: 1, drillId: 'd', drillNameSnapshot: 'Drill', categorySnapshot: 'Loop from Backspin', metricType: 'hits_attempts', createdAt: '', updatedAt: '', ...over }
}
let t = 0
const row = (over: Partial<DrillLog>, date = '2026-10-01'): DrillLogRow => ({ log: log(over), date, at: String(1000 + t++) })

function drill(over: Partial<Drill>): Drill {
  return {
    id: 'd', name: 'Drill', category: 'Loop from Backspin', description: '', metricType: 'hits_attempts', suggestedSettings: '', cues: '', source: 'custom',
    isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: '', updatedAt: '', ...over,
  }
}

describe('weeks and bars', () => {
  it('range weeks end with the current week', () => {
    const w = weeksForRange('4', undefined, '2026-10-07')
    expect(w).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'])
    expect(weeksForRange('12', undefined, '2026-10-07')).toHaveLength(12)
  })
  it('"all" starts at the first session week, at least 4 weeks, capped', () => {
    expect(weeksForRange('all', '2026-08-12', '2026-10-07')[0]).toBe('2026-08-10')
    expect(weeksForRange('all', undefined, '2026-10-07')).toHaveLength(4)
    expect(weeksForRange('all', '2020-01-01', '2026-10-07')).toHaveLength(104)
  })
  it('matches the 3.3 worked example (3, 4, 2, 3, then 1 so far)', () => {
    const counts = [3, 4, 2, 3, 1]
    const weeks = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']
    const sessions: SessionStat[] = []
    counts.forEach((n, wi) => { for (let i = 0; i < n; i++) sessions.push(sess(`${wi}-${i}`, weeks[wi])) })
    const bars = buildWeekBars(sessions, new Set(), 3, weeks)
    expect(bars.map((b) => b.robot)).toEqual(counts)
    expect(bars.map((b) => b.metTarget)).toEqual([true, true, false, true, false])
    const streak = computeStreaks({ robotByWeek: new Map(bars.map((b) => [b.weekStart, b.robot])), restWeeks: new Set(), target: 3, today: '2026-10-07' })
    expect(streak).toEqual({ current: 1, longest: 2 })
  })
  it('counts club separately, ignores robot sessions with no drill logs, sums minutes, flags rest weeks', () => {
    const weeks = ['2026-10-05']
    const bars = buildWeekBars(
      [sess('a', '2026-10-05'), sess('b', '2026-10-06', { kind: 'club', totalMinutes: 45 }), sess('c', '2026-10-07', { drillCount: 0 })],
      new Set(['2026-10-05']), 3, weeks,
    )
    expect(bars[0]).toMatchObject({ robot: 1, club: 1, minutes: 105, isRest: true })
  })
  it('buckets the clock-change week (Sunday 25 Oct 2026) into the right Monday', () => {
    const bars = buildWeekBars([sess('a', '2026-10-25'), sess('b', '2026-10-26')], new Set(), 1, ['2026-10-19', '2026-10-26'])
    expect(bars.map((b) => b.robot)).toEqual([1, 1])
  })
})

describe('confidence by week', () => {
  it('averages per week and leaves empty weeks null', () => {
    const r = confidenceByWeek([sess('a', '2026-10-05', { loopConfidence: 2 }), sess('b', '2026-10-06', { loopConfidence: 5 }), sess('c', '2026-10-07')], ['2026-09-28', '2026-10-05'])
    expect(r[0].average).toBeNull()
    expect(r[1]).toMatchObject({ average: 3.5, count: 2 })
  })
})

describe('time by category', () => {
  it('uses drill log durations only and reports logs without minutes', () => {
    const mix = timeByCategory([
      row({ durationMin: 15 }), row({ durationMin: 5 }),
      row({ categorySnapshot: 'Footwork and Conditioning', durationMin: 20 }),
      row({ durationMin: undefined }),
    ])
    expect(mix.totalMinutes).toBe(40)
    expect(mix.withoutMinutes).toBe(1)
    expect(mix.items.map((i) => [i.category, i.minutes, i.share])).toEqual([
      ['Loop from Backspin', 20, 0.5], ['Footwork and Conditioning', 20, 0.5],
    ])
  })
  it('respects the range start', () => {
    const mix = timeByCategory([row({ durationMin: 10 }, '2026-01-01'), row({ durationMin: 7 }, '2026-10-01')], '2026-09-01')
    expect(mix.totalMinutes).toBe(7)
  })
})

describe('drill series', () => {
  it('plots success rate as a percentage with the benchmark line and met flags', () => {
    const d = drill({ benchmark: { metricType: 'hits_attempts', threshold: 0.8, minAttempts: 10, consecutiveSessions: 1, description: '' } })
    const s = drillSeries([row({ hits: 8, attempts: 10 }), row({ hits: 4, attempts: 5 }), row({ hits: 5, attempts: 10 })], d)
    expect(s.unit).toBe('percent')
    expect(s.benchmarkLine).toBe(80)
    expect(s.points.map((p) => [p.value, p.met])).toEqual([[80, true], [80, null], [50, false]])
  })
  it('margin, streak, minutes and rating use their primary values', () => {
    expect(drillSeries([row({ metricType: 'score_vs_robot', scoreYou: 7, scoreRobot: 11 })], drill({ metricType: 'score_vs_robot' })).points[0].value).toBe(-4)
    expect(drillSeries([row({ metricType: 'streak', streak: 9 })], drill({ metricType: 'streak' })).points[0].value).toBe(9)
    expect(drillSeries([row({ metricType: 'duration', durationMin: 12 })], drill({ metricType: 'duration' })).points[0].value).toBe(12)
    expect(drillSeries([row({ metricType: 'rating', rating: 4 })], drill({ metricType: 'rating' })).points[0].value).toBe(4)
  })
  it('range start filters points', () => {
    const s = drillSeries([row({ hits: 1, attempts: 2 }, '2026-01-01'), row({ hits: 2, attempts: 2 }, '2026-10-01')], drill({}), '2026-09-01')
    expect(s.points).toHaveLength(1)
  })
})

describe('yDomain', () => {
  it('has fixed domains for percent and rating', () => {
    expect(yDomain('percent', [10]).max).toBe(100)
    expect(yDomain('rating', [3]).ticks).toEqual([1, 2, 3, 4, 5])
  })
  it('includes data, zero and the benchmark line, with clean ticks', () => {
    const d = yDomain('count', [3, 9], 15)
    expect(d.min).toBe(0)
    expect(d.max).toBeGreaterThanOrEqual(15)
    expect(d.ticks[0]).toBe(0)
  })
  it('margins can go negative', () => {
    expect(yDomain('margin', [-4, 6]).min).toBeLessThanOrEqual(-4)
  })
})

describe('benchmark board (worked examples 3.6)', () => {
  const bench = (b: Partial<NonNullable<Drill['benchmark']>>) => ({ metricType: 'hits_attempts' as const, threshold: 0.7, minAttempts: 20, consecutiveSessions: 2, description: '', ...b })
  const rowsFor = (id: string, logs: Array<Partial<DrillLog>>) => new Map([[id, logs.map((l, i) => row({ drillId: id, ...l }, `2026-09-${String(10 + i).padStart(2, '0')}`))]])
  const pct = (p: number) => ({ hits: p, attempts: 100 })

  it('Drill I: 65, 72, 74 is met; 72, 68, 75 is not', () => {
    const d = drill({ id: 'I', benchmark: bench({ minAttempts: 20 }) })
    expect(buildBoard([d], rowsFor('I', [pct(65), pct(72), pct(74)]))[0].status).toBe('met')
    expect(buildBoard([d], rowsFor('I', [pct(72), pct(68), pct(75)]))[0].status).toBe('not_met')
  })
  it('Drill L: streak 15, 17 is met; 17, 12 is not', () => {
    const d = drill({ id: 'L', metricType: 'streak', benchmark: { metricType: 'streak', threshold: 15, consecutiveSessions: 2, description: '' } })
    expect(buildBoard([d], rowsFor('L', [{ metricType: 'streak', streak: 15 }, { metricType: 'streak', streak: 17 }]))[0].status).toBe('met')
    const r = buildBoard([d], rowsFor('L', [{ metricType: 'streak', streak: 17 }, { metricType: 'streak', streak: 12 }]))[0]
    expect(r.status).toBe('not_met')
    expect(r).toMatchObject({ latest: 12, best: 17, needed: 2, judged: 2 })
  })
  it('Drill A: 8/10 meets, 4/5 does not count', () => {
    const d = drill({ id: 'A', benchmark: bench({ threshold: 0.8, minAttempts: 10, consecutiveSessions: 1 }) })
    expect(buildBoard([d], rowsFor('A', [{ hits: 8, attempts: 10 }]))[0].status).toBe('met')
    expect(buildBoard([d], rowsFor('A', [{ hits: 4, attempts: 5 }]))[0].status).toBe('no_data')
  })
  it('lists only drills with a benchmark, not archived, in category order, with no-data rows', () => {
    const a = drill({ id: 'a', name: 'B', category: 'Pressure and Match Simulation', benchmark: bench({}) })
    const b = drill({ id: 'b', name: 'A', category: 'Loop from Backspin', benchmark: bench({}) })
    const c = drill({ id: 'c' })
    const e = drill({ id: 'e', archived: true, benchmark: bench({}) })
    const rows = buildBoard([a, b, c, e], new Map())
    expect(rows.map((r) => r.drill.id)).toEqual(['b', 'a'])
    expect(rows[0].status).toBe('no_data')
  })
  it('groups rows by drill', () => {
    expect(groupRowsByDrill([row({ drillId: 'x' }), row({ drillId: 'y' }), row({ drillId: 'x' })]).get('x')).toHaveLength(2)
  })
})
