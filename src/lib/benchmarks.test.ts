import { describe, expect, it } from 'vitest'
import { benchmarkMetFor, evaluateBoard, evaluateLog, type LogResult } from './benchmarks'
import type { Benchmark } from '../db/types'

const drillA: Benchmark = { metricType: 'hits_attempts', threshold: 0.8, minAttempts: 10, consecutiveSessions: 1, description: '8/10' }
const drillI: Benchmark = { metricType: 'hits_attempts', threshold: 0.7, minAttempts: 20, consecutiveSessions: 2, description: '70% in 2 sessions' }
const drillL: Benchmark = { metricType: 'streak', threshold: 15, consecutiveSessions: 2, description: 'Streak 15' }

const ha = (hits: number, attempts: number): LogResult => ({ metricType: 'hits_attempts', hits, attempts })
const pct20 = (pct: number): LogResult => ha((pct / 100) * 20, 20)
const st = (streak: number): LogResult => ({ metricType: 'streak', streak })

describe('single log evaluation (spec 3.6)', () => {
  it('Drill A: 8/10 meets the benchmark', () => {
    expect(evaluateLog(ha(8, 10), drillA)).toEqual({ counts: true, met: true })
  })
  it('Drill A: 4/5 (80%) does not count because attempts are below minAttempts', () => {
    expect(evaluateLog(ha(4, 5), drillA)).toEqual({ counts: false, met: false })
    expect(benchmarkMetFor(ha(4, 5), drillA)).toBe(false)
  })
  it('7/10 does not meet 0.8', () => {
    expect(evaluateLog(ha(7, 10), drillA)).toEqual({ counts: true, met: false })
  })
  it('benchmarkMet is null when there is no benchmark', () => {
    expect(benchmarkMetFor(ha(8, 10), undefined)).toBeNull()
  })
  it('a benchmark override from a program slot is evaluated like any benchmark (streak 8 vs 12)', () => {
    const week1: Benchmark = { metricType: 'streak', threshold: 8, consecutiveSessions: 1, description: 'Streak of 8' }
    const week2: Benchmark = { ...week1, threshold: 12, description: 'Streak of 12' }
    expect(benchmarkMetFor(st(10), week1)).toBe(true)
    expect(benchmarkMetFor(st(10), week2)).toBe(false)
  })
  it('a log of a different metric type does not count', () => {
    expect(evaluateLog(st(20), drillA)).toEqual({ counts: false, met: false })
  })
})

describe('benchmark board (spec 3.6)', () => {
  it('Drill I: 65, 72, 74 is met (the last two are at least 70%)', () => {
    const r = evaluateBoard([pct20(65), pct20(72), pct20(74)], drillI)
    expect(r.status).toBe('met')
    expect(r.latest).toBeCloseTo(0.74)
    expect(r.best).toBeCloseTo(0.74)
  })
  it('Drill I: 72, 68, 75 is not met (the last two are 68 and 75)', () => {
    expect(evaluateBoard([pct20(72), pct20(68), pct20(75)], drillI).status).toBe('not_met')
  })
  it('Drill I: only one qualifying log is not enough for two consecutive sessions', () => {
    expect(evaluateBoard([pct20(80)], drillI).status).toBe('not_met')
  })
  it('Drill I: a log below minAttempts is ignored, not counted as a miss', () => {
    expect(evaluateBoard([pct20(72), ha(1, 5), pct20(74)], drillI).status).toBe('met')
  })
  it('Drill L: streak logs 15, 17 are met', () => {
    expect(evaluateBoard([st(15), st(17)], drillL).status).toBe('met')
  })
  it('Drill L: streak logs 17, 12 are not met', () => {
    expect(evaluateBoard([st(17), st(12)], drillL).status).toBe('not_met')
  })
  it('Drill A with one required session uses only the latest log', () => {
    expect(evaluateBoard([ha(5, 10), ha(9, 10)], drillA).status).toBe('met')
    expect(evaluateBoard([ha(9, 10), ha(5, 10)], drillA).status).toBe('not_met')
  })
  it('no logs gives no_data', () => {
    expect(evaluateBoard([], drillA).status).toBe('no_data')
  })
})
