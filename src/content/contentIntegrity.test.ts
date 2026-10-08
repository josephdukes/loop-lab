import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { LoopLabDb } from '../db/db'
import { updateSettings } from '../db/settings'
import { BUILTIN_DRILLS, BUILTIN_PROGRAMS, BUILTIN_TEMPLATES, CATEGORIES, CONTENT_VERSION, MATCH_DAY_PROTOCOL } from './builtinContent'
import { GUIDES } from './guides'
import { seedBuiltInContent } from './seed'

const drill = (k: string) => BUILTIN_DRILLS.find((d) => d.builtInKey === k)!
const program = (k: string) => BUILTIN_PROGRAMS.find((p) => p.builtInKey === k)!
const template = (k: string) => BUILTIN_TEMPLATES.find((t) => t.builtInKey === k)!

describe('content integrity against spec Appendix A', () => {
  it('has the spec counts and a numeric CONTENT_VERSION', () => {
    expect(CATEGORIES).toHaveLength(7)
    expect(BUILTIN_DRILLS).toHaveLength(25) // 13 original + 8 holistic/pressure + 4 starter
    expect(BUILTIN_TEMPLATES).toHaveLength(24)
    expect(BUILTIN_PROGRAMS).toHaveLength(7)
    expect(Number.isInteger(CONTENT_VERSION)).toBe(true)
  })

  it('has exact benchmark values from the spec', () => {
    expect(drill('orig-A').benchmark).toMatchObject({ metricType: 'hits_attempts', threshold: 0.8, minAttempts: 10 })
    expect(drill('orig-D').benchmark).toMatchObject({ threshold: 0.7, minAttempts: 10 })
    expect(drill('orig-I').benchmark).toMatchObject({ threshold: 0.7, minAttempts: 20, consecutiveSessions: 2 })
    expect(drill('orig-J').benchmark).toMatchObject({ threshold: 0.7, minAttempts: 10 })
    expect(drill('orig-L').benchmark).toMatchObject({ metricType: 'streak', threshold: 15, consecutiveSessions: 2 })
    expect(drill('orig-B').benchmark).toBeUndefined()
  })

  it('has default attempts, minutes and metrics from the A.2 table', () => {
    expect(drill('orig-B')).toMatchObject({ defaultAttempts: 30, defaultDurationMin: 15, metricType: 'hits_attempts' })
    expect(drill('orig-F').metricType).toBe('rating')
    expect(drill('pl-streak')).toMatchObject({ metricType: 'streak', defaultDurationMin: 25 })
    expect(drill('pl-play11').metricType).toBe('score_vs_robot')
    expect(drill('orig-cooldown').metricType).toBe('duration')
    expect(drill('sp-tactical').defaultDurationMin).toBe(45)
  })

  it('has the template items and minutes from A.3', () => {
    expect(template('T-orig-p1').items.map((i) => [i.drillKey, i.durationMin])).toEqual([
      ['orig-A', 15], ['orig-B', 15], ['orig-C', 15], ['orig-cooldown', 5],
    ])
    expect(template('T-club').kind).toBe('club')
    expect(template('T-pl-S3').items[1].note).toContain('tired')
    expect(BUILTIN_TEMPLATES.filter((t) => t.kind === 'club')).toHaveLength(1)
  })

  it('has P2 week 1 / week 2 streak overrides of 8 and 12', () => {
    const p2 = program('P2')
    const thr = (w: number, s: number, key: string) => p2.weeks[w].sessions[s].benchmarkOverrides?.[key]?.benchmark.threshold
    expect(thr(0, 0, 'pl-streak')).toBe(8)
    expect(thr(0, 1, 'pl-third')).toBe(0.7)
    expect(thr(0, 2, 'pl-streak')).toBe(8)
    expect(thr(1, 0, 'pl-streak')).toBe(12)
    expect(thr(1, 1, 'pl-third')).toBe(0.8)
    expect(thr(1, 2, 'pl-streak')).toBe(12)
  })

  it('has P3 as a repeating 4-week cycle, P5 repeating, and guidance notes', () => {
    expect(program('P3')).toMatchObject({ repeating: true, cycleLengthWeeks: 4, sessionsPerWeek: 3 })
    expect(program('P3').weeks).toHaveLength(4)
    expect(program('P5').repeating).toBe(true)
    expect(program('P1').weeks).toHaveLength(12)
    for (const p of BUILTIN_PROGRAMS) expect(p.sessionsPerWeek).toBe(3)
    expect(program('P1').notes.length).toBeGreaterThan(50)
    expect(program('P2').notes.length).toBeGreaterThan(50)
  })

  it('has the guide texts', () => {
    const text = JSON.stringify(GUIDES).toLowerCase()
    expect(text).toContain('diagnosis')
    expect(text).toContain('between-ball')
    expect(text).toContain('match-day')
  })

  it('guides use only the spec wording (Finding 5): no added coaching sentences', () => {
    const byId = (id: string) => GUIDES.find((g) => g.id === id)!
    expect(byId('diagnosis').points.map((p) => p.text.toLowerCase())).toEqual([
      'rushing', 'racket angle not matched to spin', 'inconsistent brush contact', 'weak leg drive', 'push-to-attack is a recognition skill.',
    ])
    expect(byId('routine').points.map((p) => p.text)).toEqual(['Breath', 'Towel', 'Reset'])
    expect(byId('match-day').points.map((p) => p.text)).toEqual(MATCH_DAY_PROTOCOL)
    const all = JSON.stringify(GUIDES)
    for (const invented of ['Most loop inconsistency', 'thin and sometimes thick', 'arm alone', 'Wipe your hands', 'base position', 'Spin Calibration Blocks', 'Traffic Light', 'let the ball drop']) {
      expect(all).not.toContain(invented)
    }
  })
})

describe('seeding on a content version bump', () => {
  const names: string[] = []
  afterEach(async () => { for (const n of names.splice(0)) await Dexie.delete(n) })

  it('updates unmodified built-ins, keeps modified ones, leaves user data alone', async () => {
    const name = `integrity-${Math.random()}`
    names.push(name)
    const db = new LoopLabDb(name)
    await seedBuiltInContent(db)
    const a = (await db.drills.where('builtInKey').equals('orig-A').first())!
    const b = (await db.drills.where('builtInKey').equals('orig-B').first())!
    await db.drills.put({ ...a, description: 'mine', modifiedByUser: true })
    await db.drills.put({ ...b, description: 'old text' })
    await updateSettings(db, { contentVersion: CONTENT_VERSION - 1 })
    const custom = crypto.randomUUID()
    await db.drills.put({ ...b, id: custom, builtInKey: undefined, isBuiltIn: false, name: 'My drill', source: 'custom' })
    await seedBuiltInContent(db)
    expect((await db.drills.get(a.id))!.description).toBe('mine')
    expect((await db.drills.get(b.id))!.description).toBe(drill('orig-B').description)
    expect((await db.drills.get(custom))!.name).toBe('My drill')
    expect((await db.settings.get('settings'))!.contentVersion).toBe(CONTENT_VERSION)
    db.close()
  })
})
