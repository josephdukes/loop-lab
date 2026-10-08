import { describe, expect, it } from 'vitest'
import { formatResult, percent, shortDate, splitNotes } from './format'

describe('format helpers', () => {
  it('splits guidance notes on blank lines into separate cards', () => {
    expect(splitNotes('One.\n\nTwo.\n  \nThree.\n')).toEqual(['One.', 'Two.', 'Three.'])
    expect(splitNotes('')).toEqual([])
  })
  it('shows success rate to one decimal place', () => {
    expect(percent(8, 10)).toBe('80.0%')
    expect(percent(1, 3)).toBe('33.3%')
  })
  it('describes each metric result', () => {
    expect(formatResult({ metricType: 'hits_attempts', hits: 8, attempts: 10 })).toBe('8/10 (80.0%)')
    expect(formatResult({ metricType: 'streak', streak: 15 })).toBe('Best streak 15')
    expect(formatResult({ metricType: 'score_vs_robot', scoreYou: 9, scoreRobot: 11 })).toBe('Me 9, robot 11 (margin -2)')
    expect(formatResult({ metricType: 'duration', durationMin: 12 })).toBe('12 min')
    expect(formatResult({ metricType: 'rating', rating: 4 })).toBe('Rating 4/5')
  })
  it('formats a calendar date without time zone shifts', () => {
    expect(shortDate('2026-10-25')).toBe('Sun 25 Oct')
  })
})
