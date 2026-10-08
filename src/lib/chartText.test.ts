import { describe, expect, it } from 'vitest'
import { categorySummary, confidenceSummary, matchConfidenceSummary, minutesSummary, sessionsSummary, trendSummary } from './chartText'
import type { WeekBar } from './progressData'

const bar = (weekStart: string, robot: number, over: Partial<WeekBar> = {}): WeekBar => ({ weekStart, robot, club: 0, minutes: robot * 30, isRest: false, metTarget: robot >= 3, ...over })

describe('chart summaries', () => {
  it('sessions summary states target, weeks met, this week and rest weeks', () => {
    const t = sessionsSummary([bar('2026-09-21', 3), bar('2026-09-28', 0, { isRest: true }), bar('2026-10-05', 1)], 3)
    expect(t).toContain('target 3')
    expect(t).toContain('1 of 2 counted weeks reached the target')
    expect(t).toContain('This week so far: 1 session.')
    expect(t).toContain('Rest weeks (hatched): 28 Sep')
  })
  it('minutes summary', () => {
    expect(minutesSummary([bar('2026-09-21', 3), bar('2026-09-28', 1)])).toContain('120 in total')
    expect(minutesSummary([])).toContain('No training minutes')
  })
  it('trend summary mentions latest, best and the benchmark state', () => {
    const t = trendSummary('Pure Repetition Loop', 'hits_attempts', {
      unit: 'percent', benchmarkLine: 80,
      points: [{ date: '2026-09-01', value: 60, met: false }, { date: '2026-09-08', value: 85, met: true }],
    })
    expect(t).toContain('Latest 85.0%, best 85.0%')
    expect(t).toContain('meets it')
    expect(trendSummary('X', 'streak', { unit: 'count', points: [] })).toContain('No results')
  })
  it('other summaries', () => {
    expect(confidenceSummary([{ weekStart: '2026-10-05', average: 3.5, count: 2 }])).toContain('3.5')
    expect(confidenceSummary([])).toContain('No loop confidence')
    expect(categorySummary({ items: [{ category: 'A', minutes: 10, share: 1 }], totalMinutes: 10, withoutMinutes: 2 })).toContain('2 results had no minutes')
    expect(matchConfidenceSummary([{ date: 'x', confidence: 2 }, { date: 'y', confidence: 4 }])).toContain('average 3')
  })
})
