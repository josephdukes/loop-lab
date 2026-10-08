import { describe, expect, it } from 'vitest'
import { useSeededDb } from '../test/helpers'
import { deleteMatch, inputFromMatch, restoreMatch, saveMatch, validateMatch, type MatchInput } from './matchService'
import { ValidationError } from './validation'

const harness = useSeededDb()
const today = '2026-10-07'
const base: MatchInput = {
  date: '2026-10-06', competition: 'league', opponent: ' Sam ', opponentStyle: 'chopper', result: 'W', gamesScore: '3-1', serveFaced: 'short backspin',
  loopsAttempted: 20, loopsLanded: 15, confidence: 4, cueUsed: 'let it drop', breakdownNote: ' third game ', notes: '',
}

describe('match log', () => {
  it('saves every field, trimming text', async () => {
    const db = await harness.create()
    const m = await saveMatch(db, base, today)
    const stored = await db.matchLogs.get(m.id)
    expect(stored).toMatchObject({ date: '2026-10-06', competition: 'league', opponent: 'Sam', opponentStyle: 'chopper', result: 'W', gamesScore: '3-1', serveFaced: 'short backspin', loopsAttempted: 20, loopsLanded: 15, confidence: 4, cueUsed: 'let it drop', breakdownNote: 'third game' })
  })
  it('edits keep id and createdAt', async () => {
    const db = await harness.create()
    const m = await saveMatch(db, base, today)
    const e = await saveMatch(db, { ...inputFromMatch(m), result: 'L', confidence: 2 }, today, m.id)
    expect(e.id).toBe(m.id)
    expect(e.createdAt).toBe(m.createdAt)
    expect((await db.matchLogs.get(m.id))?.result).toBe('L')
    expect(await db.matchLogs.count()).toBe(1)
  })
  it('delete then undo restores the same record', async () => {
    const db = await harness.create()
    const m = await saveMatch(db, base, today)
    const snap = await deleteMatch(db, m.id)
    expect(await db.matchLogs.count()).toBe(0)
    await restoreMatch(db, snap!)
    expect(await db.matchLogs.get(m.id)).toEqual(m)
  })
  it('validates', () => {
    expect(validateMatch(base, today)).toEqual([])
    expect(validateMatch({ ...base, result: null }, today).join()).toMatch(/win or loss/)
    expect(validateMatch({ ...base, confidence: 6 }, today).join()).toMatch(/1 to 5/)
    expect(validateMatch({ ...base, date: '2026-10-08' }, today).join()).toMatch(/future/)
    expect(validateMatch({ ...base, loopsLanded: 25 }, today).join()).toMatch(/more than/)
    expect(validateMatch({ ...base, loopsLanded: undefined }, today).join()).toMatch(/both/)
    expect(validateMatch({ ...base, loopsAttempted: undefined, loopsLanded: undefined }, today)).toEqual([])
    expect(validateMatch({ ...base, loopsAttempted: -1 }, today).length).toBeGreaterThan(0)
  })
  it('refuses to save invalid input without writing', async () => {
    const db = await harness.create()
    await expect(saveMatch(db, { ...base, result: null }, today)).rejects.toBeInstanceOf(ValidationError)
    expect(await db.matchLogs.count()).toBe(0)
  })
})
