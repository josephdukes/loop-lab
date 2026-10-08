import { describe, expect, it, vi } from 'vitest'
import { useSeededDb } from '../../test/helpers'
import { addRichData } from '../../test/richData'
import type { LoopLabDb } from '../../db/db'
import { MIGRATIONS, V1_STORES, SCHEMA_VERSION, type Migration } from '../../db/migrations'
import { BACKUP_MAX_BYTES } from '../appInfo'
import { seedBuiltInContent } from '../../content/seed'
import { backupToText, buildBackup } from './backupBuild'
import { loadStateForEdit } from '../sessionDraft'
import { draftFromState, updateSession } from '../sessionService'
import { runnerReducer } from '../runnerState'
import { commitRestore, RestoreError } from './restoreCommit'
import { NOTHING_CHANGED, validateBackupText, type ValidBackup } from './restoreValidate'
import { STORE_NAMES, readAllStores, type StoreName } from './stores'

const h = useSeededDb()

const counts = async (db: LoopLabDb) => {
  const s = await readAllStores(db)
  return Object.fromEntries(STORE_NAMES.map((n) => [n, s[n].length])) as Record<StoreName, number>
}
const snapshot = async (db: LoopLabDb) => JSON.stringify(await readAllStores(db))
async function wipe(db: LoopLabDb) {
  await db.transaction('rw', STORE_NAMES.map((n) => db.table(n)), async () => { for (const n of STORE_NAMES) await db.table(n).clear() })
}
async function makeBackupText(db: LoopLabDb) { return backupToText(await buildBackup(db, new Date('2026-10-07T12:00:00Z'))) }
function mustValidate(text: string): ValidBackup {
  const r = validateBackupText(text)
  if (!r.ok) throw new Error(r.message)
  return r.backup
}
function edit(text: string, fn: (o: Record<string, any>) => void): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  const o = JSON.parse(text)
  fn(o)
  return JSON.stringify(o)
}

describe('backup file', () => {
  it('contains schemaVersion, appVersion, exportedAt and every store', async () => {
    const db = await h.create()
    await addRichData(db)
    const b = JSON.parse(await makeBackupText(db))
    expect(b.schemaVersion).toBe(SCHEMA_VERSION)
    expect(b.appVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(b.exportedAt).toBe('2026-10-07T12:00:00.000Z')
    for (const n of STORE_NAMES) expect(Array.isArray(b[n])).toBe(true)
    expect(b.sessionLogs).toHaveLength(3)
    expect(b.matchLogs).toHaveLength(2)
    expect(b.activeSession).toHaveLength(1) // the draft is IN the file
    expect(b.settings).toHaveLength(1)
  })

  it('app version matches package.json', async () => {
    const { APP_VERSION } = await import('../appInfo')
    const pkg = JSON.parse((await import('node:fs')).readFileSync('package.json', 'utf8'))
    expect(APP_VERSION).toBe(pkg.version)
  })
})

describe('validation and preview', () => {
  it('accepts its own backup and gives a preview with counts, date range, exportedAt and appVersion', async () => {
    const db = await h.create()
    await addRichData(db)
    const r = validateBackupText(await makeBackupText(db))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preview.counts).toEqual(await counts(db))
    expect(r.preview.dateFrom).toBe('2026-10-02')
    expect(r.preview.dateTo).toBe('2026-10-06')
    expect(r.preview.exportedAt).toBe('2026-10-07T12:00:00.000Z')
    expect(r.preview.appVersion).toMatch(/\d/)
    expect(r.preview.totalRecords).toBe(Object.values(await counts(db)).reduce((a, b) => a + b, 0))
  })

  it('every record in a real database passes validation (schema covers all fields)', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    const r = mustValidate(text)
    // Cleaning must not have dropped anything: the cleaned stores equal what was read.
    const { schemaVersion: _a, appVersion: _b, exportedAt: _c, ...stores } = JSON.parse(text)
    void _a; void _b; void _c
    expect(r.stores).toEqual(stores)
  })

  it('refuses corrupt JSON with a clear message', () => {
    const r = validateBackupText('{"schemaVersion": 1, "drills": [')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/not a readable Loop Lab backup/)
      expect(r.message).toContain(NOTHING_CHANGED)
    }
    for (const bad of ['', 'null', '[]', '"text"', '42']) expect(validateBackupText(bad).ok).toBe(false)
  })

  it('refuses a file over 20 MB without parsing it', () => {
    const r = validateBackupText('{}', { sizeBytes: BACKUP_MAX_BYTES + 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.message).toMatch(/larger than the 20 MB limit/); expect(r.message).toContain(NOTHING_CHANGED) }
    const big = validateBackupText('x'.repeat(BACKUP_MAX_BYTES + 10))
    expect(big.ok).toBe(false)
  })

  it('refuses a newer schemaVersion in plain English', async () => {
    const db = await h.create()
    const text = edit(await makeBackupText(db), (o) => { o.schemaVersion = SCHEMA_VERSION + 1 })
    const r = validateBackupText(text)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/newer version of Loop Lab/)
      expect(r.message).toContain(String(SCHEMA_VERSION + 1))
      expect(r.message).toContain(NOTHING_CHANGED)
    }
  })

  it('refuses missing schemaVersion, exportedAt and stores', async () => {
    const db = await h.create()
    const text = await makeBackupText(db)
    expect(validateBackupText(edit(text, (o) => { delete o.schemaVersion })).ok).toBe(false)
    expect(validateBackupText(edit(text, (o) => { o.schemaVersion = 'one' })).ok).toBe(false)
    expect(validateBackupText(edit(text, (o) => { o.exportedAt = 'yesterday' })).ok).toBe(false)
    const r = validateBackupText(edit(text, (o) => { delete o.matchLogs }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/matchLogs/)
  })

  it('refuses the whole file on one bad record and names what is wrong', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    const cases: Array<[string, (o: Record<string, any>) => void, RegExp]> = [ // eslint-disable-line @typescript-eslint/no-explicit-any
      ['bad enum (metricType)', (o) => { o.drills[2].metricType = 'speed' }, /Drills, record 3.*"metricType" must be one of/],
      ['bad enum (competition)', (o) => { o.matchLogs[0].competition = 'tournament' }, /Matches, record 1.*"competition"/],
      ['bad enum (result)', (o) => { o.matchLogs[0].result = 'D' }, /"result"/],
      ['bad enum (opponentStyle)', (o) => { o.matchLogs[0].opponentStyle = 'penhold' }, /"opponentStyle"/],
      ['bad enum (run status)', (o) => { o.programRuns[0].status = 'done' }, /Program runs.*"status"/],
      ['bad enum (kind)', (o) => { o.sessionLogs[0].kind = 'gym' }, /Sessions.*"kind"/],
      ['bad enum (source)', (o) => { o.drills[0].source = 'purchased' }, /"source"/],
      ['bad enum (theme)', (o) => { o.settings[0].theme = 'blue' }, /"theme"/],
      ['non-string id', (o) => { o.sessionLogs[1].id = 12345 }, /Sessions, record 2.*"id" must be text/],
      ['missing required field', (o) => { delete o.sessionLogs[0].totalMinutes }, /missing the required field "totalMinutes"/],
      ['invalid date', (o) => { o.sessionLogs[0].date = '2026-02-30' }, /"date" must be a real date/],
      ['invalid timestamp', (o) => { o.drillLogs[0].createdAt = 'soon' }, /"createdAt" must be a date and time/],
      ['out of range rating', (o) => { o.matchLogs[0].confidence = 9 }, /"confidence" must be a whole number from 1 to 5/],
      ['duplicate id', (o) => { o.matchLogs[1].id = o.matchLogs[0].id }, /same id as an earlier record/],
      ['record not an object', (o) => { o.drillLogs[0] = 'oops' }, /must be an object/],
      ['store not a list', (o) => { o.weekFlags = {} }, /"weekFlags" part of the file must be a list/],
      ['nested problem', (o) => { o.programs[0].weeks[0].sessions[0].templateId = 7 }, /templateId/],
      ['bad nested benchmark', (o) => { o.drills.find((d: any) => d.benchmark).benchmark.metricType = 'x' }, /benchmark/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ]
    for (const [label, fn, pattern] of cases) {
      const r = validateBackupText(edit(text, fn))
      expect(r.ok, label).toBe(false)
      if (!r.ok) {
        expect(r.message, label).toMatch(pattern)
        expect(r.message, label).toContain(NOTHING_CHANGED)
      }
    }
  })

  it('ignores unknown extra fields (they are left out, not rejected)', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = edit(await makeBackupText(db), (o) => {
      o.sessionLogs[0].futureField = { anything: true }
      o.extraStore = [1, 2, 3]
      o.drills[0].benchmark = { ...(o.drills[0].benchmark ?? { metricType: 'hits_attempts', threshold: 0.5, consecutiveSessions: 1, description: 'x' }), shiny: 1 }
    })
    const r = validateBackupText(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect('futureField' in r.backup.stores.sessionLogs[0]).toBe(false)
      expect('extraStore' in r.backup.stores).toBe(false)
    }
  })

  it('runs an older backup through the migration framework before checking it', () => {
    const v2: Migration = {
      version: 2, stores: V1_STORES, description: 'rename matchLogs.opponentType to opponentStyle (test migration)',
      transformBackup: (b) => ({ ...b, matchLogs: (b.matchLogs as Array<Record<string, unknown>>).map(({ opponentType, ...m }) => ({ ...m, opponentStyle: opponentType })) }),
    }
    const list = [...MIGRATIONS, v2]
    const old: Record<string, unknown> = {
      schemaVersion: 1, appVersion: '0.0.1', exportedAt: '2026-01-01T00:00:00.000Z',
      ...Object.fromEntries(STORE_NAMES.map((n) => [n, []])),
      matchLogs: [{
        id: 'm1', date: '2026-01-01', competition: 'club', opponentType: 'blocker', result: 'W', gamesScore: '3-0', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '',
        createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z',
      }],
    }
    // Against the real (v1) app list it is simply accepted as it is: opponentStyle is missing, so the file is refused.
    expect(validateBackupText(JSON.stringify(old)).ok).toBe(false)
    // Against a v2 app the transform runs first.
    const r = validateBackupText(JSON.stringify(old), { migrations: list })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.backup.stores.matchLogs[0].opponentStyle).toBe('blocker')
      expect(r.backup.schemaVersion).toBe(2)
      expect(r.preview.migratedFrom).toBe(1)
    }
    // And a v3 file is refused by the v2 app.
    const refused = validateBackupText(JSON.stringify({ ...old, schemaVersion: 3 }), { migrations: list })
    expect(refused.ok).toBe(false)
  })
})

describe('restore: round trip', () => {
  it('backup, wipe, restore (Merge) gives identical records in every store, except the unfinished-session draft', async () => {
    const db = await h.create()
    await addRichData(db)
    const before = await readAllStores(db)
    const beforeCounts = await counts(db)
    const text = await makeBackupText(db)
    await wipe(db)
    expect(Object.values(await counts(db)).every((n) => n === 0)).toBe(true)

    const result = await commitRestore(db, mustValidate(text), 'merge')
    const after = await readAllStores(db)
    const afterCounts = await counts(db)
    for (const n of STORE_NAMES) {
      if (n === 'activeSession') continue
      expect(afterCounts[n], n).toBe(beforeCounts[n])
    }
    expect(afterCounts.activeSession).toBe(0)
    for (const n of STORE_NAMES) {
      if (n === 'activeSession' || n === 'settings') continue
      expect(after[n].slice().sort(byKey), n).toEqual(before[n].slice().sort(byKey))
    }
    expect(result.added).toBe(Object.values(beforeCounts).reduce((a, b) => a + b, 0) - 1)
    expect(result.updated).toBe(0)
    expect(result.seeded).not.toBeNull()
  })

  it('backup, wipe, restore (Replace) gives the same counts and sets lastBackupAt to the file date', async () => {
    const db = await h.create()
    await addRichData(db)
    const beforeCounts = await counts(db)
    const text = await makeBackupText(db)
    await wipe(db)
    const safety = vi.fn(async () => {})
    const result = await commitRestore(db, mustValidate(text), 'replace', { safetyBackup: safety })
    expect(safety).toHaveBeenCalledTimes(1)
    const after = await counts(db)
    for (const n of STORE_NAMES) expect(after[n], n).toBe(n === 'activeSession' ? 0 : beforeCounts[n])
    expect((await db.settings.get('settings'))?.lastBackupAt).toBe('2026-10-07T12:00:00.000Z')
    expect(result.removed).toBe(0)
  })

  it('restoring into a freshly installed app (different built-in ids) creates no duplicate built-ins and keeps every reference valid', async () => {
    const source = await h.create()
    await addRichData(source)
    const text = await makeBackupText(source)
    const sourceCounts = await counts(source)
    source.close()

    const fresh = await h.create() // a different database, seeded with different random ids
    const freshDrillIds = new Set((await fresh.drills.toArray()).map((d) => d.id))
    const result = await commitRestore(fresh, mustValidate(text), 'merge')
    const c = await counts(fresh)
    expect(c.drills).toBe(sourceCounts.drills)
    expect(c.sessionTemplates).toBe(sourceCounts.sessionTemplates)
    expect(c.programs).toBe(sourceCounts.programs)
    expect(c.sessionLogs).toBe(sourceCounts.sessionLogs)
    expect(c.drillLogs).toBe(sourceCounts.drillLogs)
    expect(result.updated).toBeGreaterThanOrEqual(0)

    const keys = (await fresh.drills.toArray()).map((d) => d.builtInKey).filter(Boolean)
    expect(new Set(keys).size).toBe(keys.length)
    const drillIds = new Set((await fresh.drills.toArray()).map((d) => d.id))
    for (const l of await fresh.drillLogs.toArray()) expect(drillIds.has(l.drillId), 'drill log points at a real drill').toBe(true)
    const templateIds = new Set((await fresh.sessionTemplates.toArray()).map((t) => t.id))
    for (const t of await fresh.sessionTemplates.toArray()) for (const it of t.items) expect(drillIds.has(it.drillId)).toBe(true)
    for (const p of await fresh.programs.toArray()) for (const w of p.weeks) for (const s of w.sessions) expect(templateIds.has(s.templateId)).toBe(true)
    const programIds = new Set((await fresh.programs.toArray()).map((p) => p.id))
    for (const r of await fresh.programRuns.toArray()) expect(programIds.has(r.programId)).toBe(true)
    // The built-in ids are the fresh phone's own.
    const builtIns = (await fresh.drills.toArray()).filter((d) => d.isBuiltIn)
    for (const d of builtIns) expect(freshDrillIds.has(d.id)).toBe(true)
    // The edit made on the source phone to a built-in survived (a user-modified built-in beats an unmodified one).
    const edited = (await fresh.drills.toArray()).find((d) => d.builtInKey === 'orig-A')!
    expect(edited.description).toBe('My edited description')
    expect(edited.modifiedByUser).toBe(true)
  })

  it('Merge-restoring the same backup twice creates no duplicates and changes nothing the second time', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    await wipe(db)
    await commitRestore(db, mustValidate(text), 'merge')
    const afterFirst = await snapshot(db)
    const c1 = await counts(db)
    const second = await commitRestore(db, mustValidate(text), 'merge')
    expect(await counts(db)).toEqual(c1)
    expect(await snapshot(db)).toBe(afterFirst)
    expect(second.added).toBe(0)
    expect(second.updated).toBe(0)
    expect(second.unchanged).toBeGreaterThan(0)
    // Also when restoring into the same phone that made the backup.
    const third = await commitRestore(db, mustValidate(text), 'merge')
    expect(third.added + third.updated).toBe(0)
  })

  describe('after a session was edited (Finding 1)', () => {
    async function editFirstSession(db: LoopLabDb, sessionId: string, mode: 'metric' | 'add-remove') {
      let e = await loadStateForEdit(db, sessionId)
      if (mode === 'metric') {
        e = runnerReducer(e, { type: 'hitMiss', index: 0, result: 'miss' })
      } else {
        // remove the last drill and keep the rest
        e = { ...e, drills: e.drills.slice(0, -1) }
      }
      await updateSession(db, sessionId, draftFromState(e, { now: Date.now() }), { now: Date.now() })
    }

    for (const mode of ['metric', 'add-remove'] as const) {
      it(`Merging the OLDER backup after an edit (${mode}) adds no drill logs and the report says nothing was added`, async () => {
        const db = await h.create()
        const ids = await addRichData(db)
        const text = await makeBackupText(db)
        await editFirstSession(db, ids.sessionIds[0], mode)
        const before = await db.drillLogs.count()
        const result = await commitRestore(db, mustValidate(text), 'merge')
        expect(await db.drillLogs.count()).toBe(before)
        expect(result.perStore.drillLogs.added).toBe(0)
        expect(result.perStore.sessionLogs.added).toBe(0)
        expect(result.added).toBe(0)
        // and again, plus the edited session keeps its edited values
        const again = await commitRestore(db, mustValidate(text), 'merge')
        expect(again.added + again.updated).toBe(0)
        expect(await db.drillLogs.count()).toBe(before)
      })
    }

    it('merging a backup made AFTER the edit twice adds nothing', async () => {
      const db = await h.create()
      const ids = await addRichData(db)
      await editFirstSession(db, ids.sessionIds[0], 'metric')
      const text = await makeBackupText(db)
      const c = await counts(db)
      const a = await commitRestore(db, mustValidate(text), 'merge')
      const b = await commitRestore(db, mustValidate(text), 'merge')
      expect(a.added + b.added).toBe(0)
      expect(await counts(db)).toEqual(c)
    })

    it('hardening: even if local drill-log ids differ, an older backup does not re-add logs for a session that is newer or equal locally', async () => {
      const db = await h.create()
      const ids = await addRichData(db)
      const text = await makeBackupText(db)
      const sid = ids.sessionIds[0]
      // Simulate pre-fix data: same session, brand new log ids, newer updatedAt.
      const logs = await db.drillLogs.where('sessionId').equals(sid).toArray()
      await db.drillLogs.bulkDelete(logs.map((l) => l.id))
      await db.drillLogs.bulkAdd(logs.map((l, i) => ({ ...l, id: `new-${i}` })))
      await db.sessionLogs.update(sid, { updatedAt: '2030-01-01T00:00:00.000Z' })
      const before = await db.drillLogs.count()
      const r = await commitRestore(db, mustValidate(text), 'merge')
      expect(await db.drillLogs.count()).toBe(before)
      expect(r.perStore.drillLogs.added).toBe(0)
    })
  })

  it('never restores the unfinished-session draft, in either mode', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    await wipe(db)
    await commitRestore(db, mustValidate(text), 'merge')
    expect(await db.activeSession.count()).toBe(0)
    await db.activeSession.put({ key: 'active', state: { mine: true }, createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' })
    await commitRestore(db, mustValidate(text), 'merge')
    expect((await db.activeSession.get('active'))?.state).toEqual({ mine: true }) // Merge leaves the current draft alone
    await commitRestore(db, mustValidate(text), 'replace', { safetyBackup: async () => {} })
    expect(await db.activeSession.count()).toBe(0) // Replace wipes current data, including the draft; the file's draft is not restored
  })
})

/** Makes one method of one store throw, whichever table object (plain or transaction-scoped) Dexie uses for the call. */
function failWrites(db: LoopLabDb, store: StoreName, method: 'bulkAdd' | 'bulkPut', message: string) {
  const proto = Object.getPrototypeOf(db.table(store)) as Record<string, (...a: unknown[]) => unknown>
  const original = proto[method]
  const spy = vi.spyOn(proto, method).mockImplementation(function (this: { name: string }, ...args: unknown[]) {
    if (this.name === store) return Promise.reject(new Error(message))
    return original.apply(this, args)
  })
  return spy
}

const byKey = (a: any, b: any) => String(a.id ?? a.weekStart ?? a.key).localeCompare(String(b.id ?? b.weekStart ?? b.key)) // eslint-disable-line @typescript-eslint/no-explicit-any

describe('restore: merge rules', () => {
  it('the newer updatedAt wins, an older one is left alone, and nothing is deleted', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    const match = (await db.matchLogs.toArray())[0]
    const other = (await db.matchLogs.toArray())[1]
    await db.matchLogs.put({ ...match, notes: 'local newer', updatedAt: '2030-01-01T00:00:00.000Z' })
    await db.matchLogs.put({ ...other, notes: 'local older', updatedAt: '2000-01-01T00:00:00.000Z' })
    const extra = { ...match, id: 'local-only', updatedAt: '2026-10-07T00:00:00.000Z' }
    await db.matchLogs.add(extra)

    const result = await commitRestore(db, mustValidate(text), 'merge')
    expect((await db.matchLogs.get(match.id))?.notes).toBe('local newer')
    expect((await db.matchLogs.get(other.id))?.notes).toBe(other.notes) // backup copy was newer
    expect(await db.matchLogs.get('local-only')).toBeTruthy() // not deleted
    expect(result.perStore.matchLogs).toEqual({ added: 0, updated: 1, unchanged: 1 })
  })

  it('a built-in the user edited beats an unedited built-in even when the unedited one has a newer date', async () => {
    const source = await h.create()
    await addRichData(source)
    const text = await makeBackupText(source)
    source.close()
    const fresh = await h.create()
    await commitRestore(fresh, mustValidate(text), 'merge')
    expect((await fresh.drills.toArray()).find((d) => d.builtInKey === 'orig-A')?.description).toBe('My edited description')
    // And a local edit is not overwritten by an unedited built-in from the file.
    const a = (await fresh.drills.toArray()).find((d) => d.builtInKey === 'orig-B')!
    await fresh.drills.put({ ...a, description: 'local edit', modifiedByUser: true, updatedAt: '2001-01-01T00:00:00.000Z' })
    await commitRestore(fresh, mustValidate(text), 'merge')
    expect((await fresh.drills.get(a.id))?.description).toBe('local edit')
  })

  it('settings merge keeps the later lastBackupAt', async () => {
    const db = await h.create()
    const s = await db.settings.get('settings')
    await db.settings.put({ ...s!, lastBackupAt: '2026-10-01T00:00:00.000Z', weeklyTarget: 5, updatedAt: '2030-01-01T00:00:00.000Z' })
    const text = edit(await makeBackupText(db), (o) => { o.settings[0].lastBackupAt = '2026-10-06T00:00:00.000Z'; o.settings[0].weeklyTarget = 2; o.settings[0].updatedAt = '2020-01-01T00:00:00.000Z' })
    await commitRestore(db, mustValidate(text), 'merge')
    const after = await db.settings.get('settings')
    expect(after?.weeklyTarget).toBe(5) // local settings were newer
    expect(after?.lastBackupAt).toBe('2026-10-06T00:00:00.000Z')
  })
})

describe('restore: Replace safety and atomicity', () => {
  it('Replace without a safety backup is refused and changes nothing', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    const before = await snapshot(db)
    await expect(commitRestore(db, mustValidate(text), 'replace')).rejects.toThrow(/safety backup/)
    expect(await snapshot(db)).toBe(before)
  })

  it('runs the safety backup BEFORE any data is removed, and stops if it fails', async () => {
    const db = await h.create()
    await addRichData(db)
    const small = await h.create()
    const smallText = await makeBackupText(small)
    const before = await counts(db)
    let seenDuringSafety: Record<StoreName, number> | null = null
    await commitRestore(db, mustValidate(smallText), 'replace', { safetyBackup: async () => { seenDuringSafety = await counts(db) } })
    expect(seenDuringSafety).toEqual(before) // the old data was still all there
    expect((await counts(db)).sessionLogs).toBe(0)

    const db2 = await h.create()
    await addRichData(db2)
    const snap = await snapshot(db2)
    await expect(commitRestore(db2, mustValidate(smallText), 'replace', { safetyBackup: async () => { throw new Error('download blocked') } })).rejects.toThrow(/safety backup.*could not be saved.*Nothing was changed/)
    expect(await snapshot(db2)).toBe(snap)
  })

  it('Replace result reports how many records were removed', async () => {
    const db = await h.create()
    await addRichData(db)
    const empty = await h.create()
    const text = await makeBackupText(empty)
    const total = Object.values(await counts(db)).reduce((a, b) => a + b, 0)
    const result = await commitRestore(db, mustValidate(text), 'replace', { safetyBackup: async () => {} })
    expect(result.removed).toBe(total)
    expect((await counts(db)).sessionLogs).toBe(0)
  })

  it('rolls everything back when a write fails midway (Replace)', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    const before = await snapshot(db)
    const spy = failWrites(db, 'matchLogs', 'bulkAdd', 'disk full')
    await expect(commitRestore(db, mustValidate(text), 'replace', { safetyBackup: async () => {} })).rejects.toThrow(/rolled back.*disk full.*Nothing was changed/)
    spy.mockRestore()
    expect(await snapshot(db)).toBe(before)
  })

  it('rolls everything back when a write fails midway (Merge)', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await makeBackupText(db)
    await wipe(db)
    await db.matchLogs.add({ id: 'keep', date: '2026-10-01', competition: 'club', opponentStyle: 'other', result: 'W', gamesScore: '', serveFaced: '', confidence: 3, cueUsed: '', breakdownNote: '', notes: '', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })
    const before = await snapshot(db)
    const spy = failWrites(db, 'blockReviews', 'bulkPut', 'quota exceeded')
    await expect(commitRestore(db, mustValidate(text), 'merge')).rejects.toThrow(RestoreError)
    spy.mockRestore()
    expect(await snapshot(db)).toBe(before) // drills, sessions etc. written before the failure were rolled back
  })
})

describe('restore: built-in content is refreshed afterwards', () => {
  it('adds missing built-ins, updates unmodified ones, and leaves modified ones alone', async () => {
    const db = await h.create()
    const text = edit(await makeBackupText(db), (o) => {
      const drills = o.drills as any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      o.drills = drills.filter((d) => d.builtInKey !== 'orig-C') // one built-in missing from the file
      drills.find((d) => d.builtInKey === 'orig-A').description = 'STALE TEXT' // unmodified, out of date
      const b = drills.find((d) => d.builtInKey === 'orig-B')
      b.description = 'MY EDIT'
      b.modifiedByUser = true
    })
    await wipe(db)
    const result = await commitRestore(db, mustValidate(text), 'replace', { safetyBackup: async () => {} })
    expect(result.seeded?.drills.added).toBe(1)
    expect(result.seeded?.drills.updated).toBe(1)
    const drills = await db.drills.toArray()
    expect(drills.find((d) => d.builtInKey === 'orig-C')).toBeTruthy()
    expect(drills.find((d) => d.builtInKey === 'orig-A')?.description).not.toBe('STALE TEXT')
    expect(drills.find((d) => d.builtInKey === 'orig-B')?.description).toBe('MY EDIT')
    expect(drills).toHaveLength(25)
    // seeding on its own is a no-op afterwards
    const again = await seedBuiltInContent(db)
    expect(again.drills.added + again.drills.updated).toBe(0)
  })
})
