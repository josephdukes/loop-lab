import { describe, expect, it } from 'vitest'
import { BUILTIN_DRILLS } from '../content/builtinContent'
import type { Drill, Program, SessionTemplate } from '../db/types'
import { addSession, drillByKey } from '../test/fixtures'
import { programByKey, useSeededDb } from '../test/helpers'
import { blankDrill, blankProgram, blankTemplate } from './libraryRules'
import { deleteOrArchive, duplicateItem, resetToOriginal, saveItem, setArchived } from './libraryService'
import { ValidationError } from './validation'

const harness = useSeededDb()

describe('duplicate', () => {
  it('copies a built-in drill as a custom one', async () => {
    const db = await harness.create()
    const src = await drillByKey(db, 'orig-A')
    const id = await duplicateItem(db, 'drill', src.id)
    const copy = (await db.drills.get(id)) as Drill
    expect(copy.id).not.toBe(src.id)
    expect(copy.name).toBe('Copy of Pure Repetition Loop')
    expect(copy).toMatchObject({ isBuiltIn: false, modifiedByUser: false, archived: false, source: 'custom' })
    expect(copy.builtInKey).toBeUndefined()
    expect(copy.benchmark).toEqual(src.benchmark)
    // the original is untouched
    expect((await db.drills.get(src.id))?.name).toBe('Pure Repetition Loop')
  })
  it('copies sessions and programs too, deeply', async () => {
    const db = await harness.create()
    const t = (await db.sessionTemplates.toArray()).find((x) => x.builtInKey === 'T-pl-S1') as SessionTemplate
    const tid = await duplicateItem(db, 'template', t.id)
    const tc = (await db.sessionTemplates.get(tid)) as SessionTemplate
    expect(tc).toMatchObject({ name: 'Copy of ' + t.name, isBuiltIn: false, modifiedByUser: false })
    expect(tc.builtInKey).toBeUndefined()
    tc.items[0].order = 99
    expect(t.items[0].order).not.toBe(99)
    const p = await programByKey(db, 'P2')
    const pid = await duplicateItem(db, 'program', p.id)
    const pc = (await db.programs.get(pid)) as Program
    expect(pc.name).toBe('Copy of ' + p.name)
    expect(pc.builtInKey).toBeUndefined()
    expect(pc.weeks[0].sessions[0].itemOverrides).toEqual(p.weeks[0].sessions[0].itemOverrides)
  })
})

describe('edit and reset', () => {
  it('editing a built-in sets modifiedByUser and survives re-seeding', async () => {
    const db = await harness.create()
    const d = await drillByKey(db, 'orig-A')
    const saved = (await saveItem(db, 'drill', { ...d, description: 'My own words' })) as Drill
    expect(saved.modifiedByUser).toBe(true)
    expect((await db.drills.get(d.id))?.description).toBe('My own words')
    const { seedBuiltInContent } = await import('../content/seed')
    await seedBuiltInContent(db)
    expect((await db.drills.get(d.id))?.description).toBe('My own words')
  })
  it('editing a custom item does not touch modifiedByUser', async () => {
    const db = await harness.create()
    const d = { ...blankDrill('t', 'c1'), name: 'Mine' }
    await saveItem(db, 'drill', d)
    const again = (await saveItem(db, 'drill', { ...d, description: 'x' })) as Drill
    expect(again.modifiedByUser).toBe(false)
  })
  it('reset to original restores seeded values and clears modifiedByUser', async () => {
    const db = await harness.create()
    const d = await drillByKey(db, 'orig-A')
    await saveItem(db, 'drill', { ...d, name: 'Renamed', cues: 'changed', benchmark: undefined })
    await resetToOriginal(db, 'drill', d.id)
    const back = (await db.drills.get(d.id)) as Drill
    const seeded = BUILTIN_DRILLS.find((x) => x.builtInKey === 'orig-A')!
    expect(back.name).toBe(seeded.name)
    expect(back.cues).toBe(seeded.cues)
    expect(back.benchmark).toEqual(seeded.benchmark)
    expect(back.modifiedByUser).toBe(false)
    expect(back.id).toBe(d.id)
  })
  it('reset works for programs and keeps the archived flag', async () => {
    const db = await harness.create()
    const p = await programByKey(db, 'P2')
    await saveItem(db, 'program', { ...p, name: 'My P2', weeks: p.weeks.slice(0, 1) })
    await setArchived(db, 'program', p.id, true)
    await resetToOriginal(db, 'program', p.id)
    const back = (await db.programs.get(p.id)) as Program
    expect(back.name).toBe(p.name)
    expect(back.weeks).toHaveLength(2)
    expect(back.modifiedByUser).toBe(false)
    expect(back.archived).toBe(true)
  })
  it('refuses to reset a custom item', async () => {
    const db = await harness.create()
    await saveItem(db, 'drill', { ...blankDrill('t', 'c1'), name: 'Mine' })
    await expect(resetToOriginal(db, 'drill', 'c1')).rejects.toThrow(/built-in/)
  })
})

describe('archive, restore, delete rules', () => {
  it('archives and restores a built-in', async () => {
    const db = await harness.create()
    const d = await drillByKey(db, 'orig-B')
    await setArchived(db, 'drill', d.id, true)
    expect((await db.drills.get(d.id))?.archived).toBe(true)
    await setArchived(db, 'drill', d.id, false)
    expect((await db.drills.get(d.id))?.archived).toBe(false)
  })
  it('deleting a built-in archives it', async () => {
    const db = await harness.create()
    const d = await drillByKey(db, 'orig-B')
    expect(await deleteOrArchive(db, 'drill', d.id)).toBe('archived')
    expect(await db.drills.get(d.id)).toBeDefined()
  })
  it('deletes an unused custom drill permanently', async () => {
    const db = await harness.create()
    await saveItem(db, 'drill', { ...blankDrill('t', 'c1'), name: 'Mine' })
    expect(await deleteOrArchive(db, 'drill', 'c1')).toBe('deleted')
    expect(await db.drills.get('c1')).toBeUndefined()
  })
  it('archives a custom drill that a log references', async () => {
    const db = await harness.create()
    await saveItem(db, 'drill', { ...blankDrill('t', 'c1'), name: 'Mine' })
    const sid = await addSession(db, { date: '2026-10-01', logs: [] })
    await db.drillLogs.add({ id: 'l1', sessionId: sid, order: 1, drillId: 'c1', drillNameSnapshot: 'Mine', categorySnapshot: 'Loop from Backspin', metricType: 'hits_attempts', hits: 1, attempts: 2, createdAt: '', updatedAt: '' })
    expect(await deleteOrArchive(db, 'drill', 'c1')).toBe('archived')
    expect((await db.drills.get('c1'))?.archived).toBe(true)
  })
  it('archives a custom drill used by a session template, and a custom template used by a log or program', async () => {
    const db = await harness.create()
    await saveItem(db, 'drill', { ...blankDrill('t', 'c1'), name: 'Mine' })
    await saveItem(db, 'template', { ...blankTemplate('t', 't1'), name: 'My session', items: [{ drillId: 'c1', order: 1 }] })
    expect(await deleteOrArchive(db, 'drill', 'c1')).toBe('archived')
    await saveItem(db, 'program', { ...blankProgram('t', 'p1', 't1'), name: 'My program' })
    expect(await deleteOrArchive(db, 'template', 't1')).toBe('archived')
    expect(await deleteOrArchive(db, 'program', 'p1')).toBe('deleted')
    expect(await deleteOrArchive(db, 'template', 't1')).toBe('deleted')
  })
  it('archives a custom program that has a run', async () => {
    const db = await harness.create()
    const t = (await db.sessionTemplates.toArray())[0]
    await saveItem(db, 'program', { ...blankProgram('t', 'p1', t.id), name: 'My program' })
    await db.programRuns.add({ id: 'r1', programId: 'p1', startDate: '2026-10-01', status: 'active', manualOffsetSessions: 0, cycleNumber: 1, createdAt: '', updatedAt: '' })
    expect(await deleteOrArchive(db, 'program', 'p1')).toBe('archived')
  })
})

describe('validation on save', () => {
  const fails = async (p: Promise<unknown>, re: RegExp) => {
    const e = await p.then(() => null, (x) => x)
    expect(e).toBeInstanceOf(ValidationError)
    expect((e as ValidationError).errors.join(' ')).toMatch(re)
  }
  it('drill needs a name and a sensible benchmark', async () => {
    const db = await harness.create()
    await fails(saveItem(db, 'drill', blankDrill('t', 'x')), /name/)
    const ok = { ...blankDrill('t', 'x'), name: 'N' }
    await fails(saveItem(db, 'drill', { ...ok, benchmark: { metricType: 'hits_attempts', threshold: 80, consecutiveSessions: 1, description: '' } }), /above 0%/)
    await fails(saveItem(db, 'drill', { ...ok, benchmark: { metricType: 'streak', threshold: 5, consecutiveSessions: 1, description: '' } }), /same metric/)
    await fails(saveItem(db, 'drill', { ...ok, metricType: 'rating', benchmark: { metricType: 'rating', threshold: 6, consecutiveSessions: 1, description: '' } }), /1 to 5/)
    await fails(saveItem(db, 'drill', { ...ok, benchmark: { metricType: 'hits_attempts', threshold: 0.8, minAttempts: 0, consecutiveSessions: 1, description: '' } }), /Minimum attempts/)
    await fails(saveItem(db, 'drill', { ...ok, benchmark: { metricType: 'hits_attempts', threshold: 0.8, consecutiveSessions: 0, description: '' } }), /in a row/)
    await fails(saveItem(db, 'drill', { ...ok, defaultAttempts: 0 }), /attempts/)
  })
  it('template needs a name, items, and existing drills', async () => {
    const db = await harness.create()
    await fails(saveItem(db, 'template', blankTemplate('t', 'x')), /name/)
    await fails(saveItem(db, 'template', { ...blankTemplate('t', 'x'), name: 'N' }), /at least one drill/)
    await fails(saveItem(db, 'template', { ...blankTemplate('t', 'x'), name: 'N', items: [{ drillId: 'missing', order: 1 }] }), /no longer exists/)
    await fails(saveItem(db, 'template', { ...blankTemplate('t', 'x'), name: 'N', items: [{ drillId: (await drillByKey(db, 'orig-A')).id, order: 1, durationMin: -2 }] }), /Minutes/)
  })
  it('program needs positive counts and existing templates', async () => {
    const db = await harness.create()
    const t = (await db.sessionTemplates.toArray())[0]
    const base = { ...blankProgram('t', 'x', t.id), name: 'N' }
    await fails(saveItem(db, 'program', { ...base, name: '' }), /name/)
    await fails(saveItem(db, 'program', { ...base, sessionsPerWeek: 0 }), /Sessions per week/)
    await fails(saveItem(db, 'program', { ...base, weeks: [] }), /at least one week/)
    await fails(saveItem(db, 'program', { ...base, sessionsPerWeek: 2 }), /exactly 2/)
    await fails(saveItem(db, 'program', { ...base, weeks: [{ ...base.weeks[0], sessions: base.weeks[0].sessions.map((s) => ({ ...s, templateId: 'gone' })) }] }), /no longer exists/)
    await fails(saveItem(db, 'program', { ...base, repeating: true, cycleLengthWeeks: 3 }), /Cycle length/)
    await saveItem(db, 'program', { ...base, repeating: true, cycleLengthWeeks: 1 })
    expect(await db.programs.get('x')).toBeDefined()
  })
})
