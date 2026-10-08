import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isValidDate, lastNWeekStarts, parseDate, todayLocal, weekdayIndex, weekStartOf } from './dates'

describe('date parsing', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isValidDate('2026-10-25')).toBe(true)
    expect(isValidDate('2028-02-29')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-1-1')).toBe(false)
    expect(parseDate('nope')).toBeNull()
  })
})

describe('weekdays and week starts (Monday start)', () => {
  it('knows the weekday', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0) // Monday
    expect(weekdayIndex('2026-10-11')).toBe(6) // Sunday
    expect(weekdayIndex('1970-01-01')).toBe(3) // Thursday
  })
  it('buckets each day of a normal week to its Monday', () => {
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-11']) {
      expect(weekStartOf(d)).toBe('2026-10-05')
    }
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12')
  })
  it('crosses month and year boundaries', () => {
    expect(weekStartOf('2026-01-01')).toBe('2025-12-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })
})

describe('UK clock change, Sunday 25 October 2026 (clocks go back)', () => {
  // Week is Monday 19 Oct to Sunday 25 Oct 2026. The Sunday is a 25-hour day.
  const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
  it('puts all seven days, including the 25-hour Sunday, in the same week', () => {
    for (const d of week) expect(weekStartOf(d)).toBe('2026-10-19')
  })
  it('puts Monday 26 October in the next week', () => {
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26')
  })
  it('adds days across the change without drifting', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-10-19', 6)).toBe('2026-10-25')
    expect(daysBetween('2026-10-19', '2026-10-26')).toBe(7)
  })
  it('lists weeks around the change correctly', () => {
    expect(lastNWeekStarts('2026-10-25', 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(lastNWeekStarts('2026-11-02', 3)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })
  it('also holds in a time zone where the change happens, using a late-night local timestamp', () => {
    // 23:30 local on Sunday 25 Oct built from local parts: the local calendar date must stay the 25th.
    const lateSunday = new Date(2026, 9, 25, 23, 30)
    expect(todayLocal(lateSunday)).toBe('2026-10-25')
    expect(weekStartOf(todayLocal(lateSunday))).toBe('2026-10-19')
    const earlyMonday = new Date(2026, 9, 26, 0, 30)
    expect(weekStartOf(todayLocal(earlyMonday))).toBe('2026-10-26')
  })
  it('spring change (Sunday 29 March 2026) behaves the same', () => {
    expect(weekStartOf('2026-03-29')).toBe('2026-03-23')
    expect(weekStartOf('2026-03-30')).toBe('2026-03-30')
  })
})
