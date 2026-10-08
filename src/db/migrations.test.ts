import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { LoopLabDb } from './db'
import { MIGRATIONS, SCHEMA_VERSION, V1_STORES, assertValidMigrationList, type Migration } from './migrations'

let counter = 0
const names: string[] = []
const freshName = () => {
  const n = `migtest-${++counter}`
  names.push(n)
  return n
}
afterEach(async () => {
  for (const n of names.splice(0)) await Dexie.delete(n)
})

describe('migration framework', () => {
  it('real list starts at v1 and defines every spec store', () => {
    expect(SCHEMA_VERSION).toBe(1)
    expect(Object.keys(V1_STORES).sort()).toEqual(
      ['activeSession', 'blockReviews', 'drillLogs', 'drills', 'matchLogs', 'programRuns', 'programs', 'sessionLogs', 'sessionTemplates', 'settings', 'weekFlags'].sort(),
    )
  })

  it('rejects lists that are empty, gapped or out of order', () => {
    expect(() => assertValidMigrationList([])).toThrow()
    expect(() => assertValidMigrationList([{ version: 2, stores: {}, description: '' }])).toThrow()
    const m1: Migration = MIGRATIONS[0]
    expect(() => assertValidMigrationList([m1, { version: 3, stores: V1_STORES, description: '' }])).toThrow()
  })

  it('creates a fresh database at the latest version', async () => {
    const db = new LoopLabDb(freshName())
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(db.tables.map((t) => t.name).sort()).toContain('activeSession')
    db.close()
  })

  it('runs upgrades in order: real v1 setup, then fake v2 and v3, keeping existing data', async () => {
    const name = freshName()
    const order: string[] = []

    // 1. A phone on the real v1 schema with some data.
    const v1 = new LoopLabDb(name, MIGRATIONS)
    await v1.open()
    const now = new Date().toISOString()
    await v1.settings.put({
      key: 'settings', weeklyTarget: 3, theme: 'dark', timerSound: true, timerVibrate: true,
      backupReminderDays: 14, summaryWeeks: 4, contentVersion: 1, createdAt: now, updatedAt: now,
    })
    v1.close()

    // 2. The app updates to a list with two fake later migrations.
    const fake: Migration[] = [
      ...MIGRATIONS,
      {
        version: 2,
        description: 'fake: add a store and bump weeklyTarget',
        stores: { ...V1_STORES, fakeStore: 'id' },
        upgrade: async (tx) => {
          order.push('v2')
          await tx.table('settings').toCollection().modify((s: { weeklyTarget: number }) => { s.weeklyTarget = 4 })
        },
      },
      {
        version: 3,
        description: 'fake: double weeklyTarget (must see the result of v2)',
        stores: { ...V1_STORES, fakeStore: 'id' },
        upgrade: async (tx) => {
          order.push('v3')
          await tx.table('settings').toCollection().modify((s: { weeklyTarget: number }) => { s.weeklyTarget = s.weeklyTarget * 2 })
        },
      },
    ]
    const upgraded = new LoopLabDb(name, fake)
    await upgraded.open()

    expect(order).toEqual(['v2', 'v3'])
    expect(upgraded.verno).toBe(3)
    // 3 -> v2 gives 4 -> v3 doubles to 8: proves v3 ran after v2.
    expect((await upgraded.settings.get('settings'))?.weeklyTarget).toBe(8)
    upgraded.close()
  })

  it('does not re-run migrations that already ran', async () => {
    const name = freshName()
    let runs = 0
    const list: Migration[] = [
      ...MIGRATIONS,
      { version: 2, description: 'fake', stores: V1_STORES, upgrade: () => { runs++ } },
    ]
    const old = new LoopLabDb(name, MIGRATIONS) // phone still on v1
    await old.open()
    old.close()
    const a = new LoopLabDb(name, list) // first start after the update: upgrade runs
    await a.open()
    a.close()
    const b = new LoopLabDb(name, list) // later starts: nothing to upgrade
    await b.open()
    b.close()
    expect(runs).toBe(1)
  })
})

describe('migrating a backup FILE (stage 4)', () => {
  it('runs only the transformBackup steps newer than the file, in order, and stamps the latest schemaVersion', async () => {
    const { migrateBackupData } = await import('./migrations')
    const log: number[] = []
    const list: Migration[] = [
      { version: 1, stores: V1_STORES, description: 'v1' },
      { version: 2, stores: V1_STORES, description: 'v2', transformBackup: (b) => { log.push(2); return { ...b, a: 'v2' } } },
      { version: 3, stores: V1_STORES, description: 'v3', transformBackup: (b) => { log.push(3); return { ...b, a: String(b.a) + '+v3' } } },
    ]
    expect(migrateBackupData({ schemaVersion: 1 }, 1, list)).toEqual({ schemaVersion: 3, a: 'v2+v3' })
    expect(log).toEqual([2, 3])
    log.length = 0
    expect(migrateBackupData({ schemaVersion: 2, a: 'x' }, 2, list)).toEqual({ schemaVersion: 3, a: 'x+v3' })
    expect(log).toEqual([3])
    expect(migrateBackupData({ schemaVersion: 1 }, 1, [list[0]])).toEqual({ schemaVersion: 1 })
  })
})
