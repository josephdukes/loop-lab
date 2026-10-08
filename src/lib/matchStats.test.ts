import { describe, expect, it } from 'vitest'
import type { MatchLog } from '../db/types'
import { loopPercent, loopTotals, matchStats } from './matchStats'

function m(over: Partial<MatchLog>): MatchLog {
  return { id: Math.random().toString(), date: '2026-10-01', competition: 'league', opponentStyle: 'hitter', result: 'W', gamesScore: '3-1', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '', createdAt: '2026-10-01T10:00:00Z', updatedAt: '', ...over }
}

describe('match stats', () => {
  it('loop percentage handles zero attempts', () => {
    expect(loopPercent(0, 0)).toBeNull()
    expect(loopPercent(7, 10)).toBe(70)
  })
  it('totals only count matches with both loop numbers', () => {
    const t = loopTotals([m({ loopsAttempted: 20, loopsLanded: 14 }), m({ loopsAttempted: 10 }), m({})])
    expect(t).toMatchObject({ attempted: 20, landed: 14, matchesWithLoops: 1, percent: 70 })
  })
  it('summarises results by style, confidence trend oldest first, averages', () => {
    const s = matchStats([
      m({ date: '2026-10-05', confidence: 4, opponentStyle: 'chopper', result: 'L' }),
      m({ date: '2026-10-01', confidence: 2, opponentStyle: 'chopper', result: 'W' }),
      m({ date: '2026-10-03', confidence: 3, opponentStyle: 'looper', result: 'W', loopsAttempted: 10, loopsLanded: 5 }),
    ])
    expect(s).toMatchObject({ count: 3, wins: 2, losses: 1, averageConfidence: 3 })
    expect(s.confidenceTrend.map((c) => c.confidence)).toEqual([2, 3, 4])
    expect(s.byStyle.find((x) => x.style === 'chopper')).toEqual({ style: 'chopper', wins: 1, losses: 1 })
    expect(s.byStyle.find((x) => x.style === 'blocker')).toEqual({ style: 'blocker', wins: 0, losses: 0 })
    expect(s.loops.percent).toBe(50)
  })
  it('empty list', () => {
    const s = matchStats([])
    expect(s.count).toBe(0)
    expect(s.averageConfidence).toBeNull()
    expect(s.loops.percent).toBeNull()
  })
})
