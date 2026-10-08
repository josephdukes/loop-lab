import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { LoopLabDb } from '../db/db'
import { loadSettings } from '../db/settings'
import { BUILTIN_DRILLS, BUILTIN_PROGRAMS, BUILTIN_TEMPLATES, CATEGORIES, CONTENT_VERSION } from './builtinContent'
import { seedBuiltInContent } from './seed'

let n = 0
const names: string[] = []
function freshDb() {
  const name = `seedtest-${++n}`
  names.push(name)
  return new LoopLabDb(name)
}
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('built-in content definitions', () => {
  it('has the counts from the spec', () => {
    expect(CATEGORIES).toHaveLength(7)
    expect(BUILTIN_DRILLS).toHaveLength(25)
    expect(BUILTIN_TEMPLATES).toHaveLength(24)
    expect(BUILTIN_PROGRAMS).toHaveLength(7)
  })
  it('has unique keys and only references keys that exist', () => {
    const drillKeys = new Set(BUILTIN_DRILLS.map((d) => d.builtInKey))
    const tplKeys = new Set(BUILTIN_TEMPLATES.map((t) => t.builtInKey))
    expect(drillKeys.size).toBe(25)
    expect(tplKeys.size).toBe(24)
    for (const t of BUILTIN_TEMPLATES) for (const i of t.items) expect(drillKeys.has(i.drillKey)).toBe(true)
    for (const p of BUILTIN_PROGRAMS) for (const w of p.weeks) for (const s of w.sessions) expect(tplKeys.has(s.templateKey)).toBe(true)
    for (const d of BUILTIN_DRILLS) expect((CATEGORIES as readonly string[]).includes(d.category)).toBe(true)
  })
  it('marks the four starter drafts with source starter-draft', () => {
    const drafts = BUILTIN_DRILLS.filter((d) => d.builtInKey.startsWith('st-'))
    expect(drafts).toHaveLength(4)
    expect(drafts.every((d) => d.source === 'starter-draft')).toBe(true)
    expect(BUILTIN_DRILLS.filter((d) => d.source === 'starter-draft')).toHaveLength(4)
  })
  it('has the expected program shapes', () => {
    const byKey = Object.fromEntries(BUILTIN_PROGRAMS.map((p) => [p.builtInKey, p]))
    expect(byKey.P1.weeks).toHaveLength(12)
    expect(byKey.P2.weeks).toHaveLength(2)
    expect(byKey.P3.weeks).toHaveLength(4)
    expect(byKey.P3.repeating).toBe(true)
    expect(byKey.P3.cycleLengthWeeks).toBe(4)
    expect(byKey.P4.weeks).toHaveLength(3)
    expect(byKey.P5.repeating).toBe(true)
    expect(byKey.P6.weeks).toHaveLength(2)
    expect(byKey.P7.weeks).toHaveLength(2)
    expect(BUILTIN_PROGRAMS.every((p) => p.sessionsPerWeek === 3)).toBe(true)
  })
})

describe('seedBuiltInContent', () => {
  it('seeds everything on first run', async () => {
    const db = freshDb()
    const res = await seedBuiltInContent(db)
    expect(res.drills.added).toBe(25)
    expect(res.templates.added).toBe(24)
    expect(res.programs.added).toBe(7)
    expect(await db.drills.count()).toBe(25)
    expect(await db.sessionTemplates.count()).toBe(24)
    expect(await db.programs.count()).toBe(7)
    expect((await loadSettings(db)).contentVersion).toBe(CONTENT_VERSION)
    db.close()
  })

  it('links templates to drills and programs to templates by real ids', async () => {
    const db = freshDb()
    await seedBuiltInContent(db)
    const drillIds = new Set((await db.drills.toArray()).map((d) => d.id))
    const tplIds = new Set((await db.sessionTemplates.toArray()).map((t) => t.id))
    for (const t of await db.sessionTemplates.toArray()) for (const i of t.items) expect(drillIds.has(i.drillId)).toBe(true)
    for (const p of await db.programs.toArray()) for (const w of p.weeks) for (const s of w.sessions) expect(tplIds.has(s.templateId)).toBe(true)
    const p2 = (await db.programs.where('builtInKey').equals('P2').first())!
    const streakDrill = (await db.drills.where('builtInKey').equals('pl-streak').first())!
    expect(p2.weeks[0].sessions[0].itemOverrides?.[streakDrill.id].benchmarkOverride?.threshold).toBe(8)
    expect(p2.weeks[1].sessions[0].itemOverrides?.[streakDrill.id].benchmarkOverride?.threshold).toBe(12)
    db.close()
  })

  it('is idempotent: a second run adds and changes nothing', async () => {
    const db = freshDb()
    await seedBuiltInContent(db)
    const before = JSON.stringify(await db.drills.orderBy('builtInKey').toArray())
    const res = await seedBuiltInContent(db)
    expect(res.drills).toEqual({ added: 0, updated: 0, unchanged: 25, skippedModified: 0 })
    expect(res.templates).toEqual({ added: 0, updated: 0, unchanged: 24, skippedModified: 0 })
    expect(res.programs).toEqual({ added: 0, updated: 0, unchanged: 7, skippedModified: 0 })
    expect(await db.drills.count()).toBe(25)
    expect(JSON.stringify(await db.drills.orderBy('builtInKey').toArray())).toBe(before)
    db.close()
  })

  it('never overwrites a built-in the user has modified, but still updates unmodified ones', async () => {
    const db = freshDb()
    await seedBuiltInContent(db)
    const a = (await db.drills.where('builtInKey').equals('orig-A').first())!
    await db.drills.put({ ...a, description: 'My own wording', modifiedByUser: true })
    const b = (await db.drills.where('builtInKey').equals('orig-B').first())!
    await db.drills.put({ ...b, description: 'stale text from an older app version' }) // unmodified
    const res = await seedBuiltInContent(db)
    expect(res.drills.skippedModified).toBe(1)
    expect(res.drills.updated).toBe(1)
    expect((await db.drills.get(a.id))!.description).toBe('My own wording')
    expect((await db.drills.get(b.id))!.description).toBe(BUILTIN_DRILLS.find((d) => d.builtInKey === 'orig-B')!.description)
    expect((await db.drills.get(b.id))!.id).toBe(b.id)
    db.close()
  })

  it('keeps archived built-ins archived, and adds a missing built-in', async () => {
    const db = freshDb()
    await seedBuiltInContent(db)
    const c = (await db.drills.where('builtInKey').equals('orig-C').first())!
    await db.drills.put({ ...c, archived: true, description: 'old' })
    const e = (await db.drills.where('builtInKey').equals('orig-E').first())!
    await db.drills.delete(e.id) // simulates a built-in added in a newer app version
    const res = await seedBuiltInContent(db)
    expect(res.drills.added).toBe(1)
    expect((await db.drills.get(c.id))!.archived).toBe(true)
    expect(await db.drills.count()).toBe(25)
    db.close()
  })
})
