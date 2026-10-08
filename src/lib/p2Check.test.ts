import { describe, expect, it } from 'vitest'
import { addMatch, addSession } from '../test/fixtures'
import { programByKey, useSeededDb } from '../test/helpers'
import { startProgramRun } from './programRuns'
import { buildP2Check, loadP2Check, secondWeekDone, showP2OnHome } from './p2Check'
import type { MatchLog, SessionLog } from '../db/types'

const harness = useSeededDb()

describe('P2 check (pure)', () => {
  const m = (date: string, o: Partial<MatchLog>): MatchLog => ({ id: date, date, competition: 'league', opponentStyle: 'hitter', result: 'W', gamesScore: '', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '', createdAt: date, updatedAt: date, ...o })
  const s = (date: string, loopConfidence?: number): SessionLog => ({ id: date, date, kind: 'robot', totalMinutes: 30, notes: '', createdAt: date, updatedAt: date, loopConfidence })
  it('uses the latest match confidence', () => {
    const c = buildP2Check([8, 12, 10], [m('2026-10-01', { confidence: 2, loopsAttempted: 10 }), m('2026-10-05', { confidence: 4, loopsAttempted: 15 })], [s('2026-10-06', 5)])
    expect(c).toEqual({ bestStreak: 12, matchesSinceStart: 2, loopAttempts: 25, confidence: { value: 4, source: 'match' } })
  })
  it('falls back to the latest session loop confidence, then to nothing', () => {
    expect(buildP2Check([], [], [s('2026-10-01', 2), s('2026-10-06', 5), s('2026-10-07')]).confidence).toEqual({ value: 5, source: 'session' })
    expect(buildP2Check([], [], [s('2026-10-07')])).toEqual({ bestStreak: null, matchesSinceStart: 0, loopAttempts: 0, confidence: null })
  })
  it('second week is done after two weeks of sessions (including set position)', () => {
    expect(secondWeekDone(5, 0, 3)).toBe(false)
    expect(secondWeekDone(6, 0, 3)).toBe(true)
    expect(secondWeekDone(0, 6, 3)).toBe(true)
  })
})

describe('P2 check (database)', () => {
  it('assembles from run sessions and matches since the run started', async () => {
    const db = await harness.create()
    const p2 = await programByKey(db, 'P2')
    const run = await startProgramRun(db, p2, '2026-09-28')
    for (let i = 0; i < 5; i++) await addSession(db, { date: `2026-09-${29 + (i % 2)}`, runId: run.id, logs: [{ drillKey: 'pl-streak', streak: 6 + i }] })
    expect((await loadP2Check(db))?.reached).toBe(false)
    await addSession(db, { date: '2026-10-05', runId: run.id, loopConfidence: 3, logs: [{ drillKey: 'pl-streak', streak: 12 }] })
    await addMatch(db, { date: '2026-09-20', loopsAttempted: 99 }) // before the run: excluded
    await addMatch(db, { date: '2026-10-02', loopsAttempted: 14, loopsLanded: 9, confidence: 4 })
    const d = (await loadP2Check(db))!
    expect(d.reached).toBe(true)
    expect(d.check).toEqual({ bestStreak: 12, matchesSinceStart: 1, loopAttempts: 14, confidence: { value: 4, source: 'match' } })
    expect(d.lastActivity).toBe('2026-10-05')
    expect(showP2OnHome(d, '2026-10-07')).toBe(true)
    expect(showP2OnHome(d, '2026-11-30')).toBe(false)
    expect(showP2OnHome(null, '2026-10-07')).toBe(false)
  })
  it('returns null when the program was never started', async () => {
    const db = await harness.create()
    expect(await loadP2Check(db)).toBeNull()
  })
})
