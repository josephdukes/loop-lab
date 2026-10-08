// Committing a validated backup (spec 6): Merge or Replace, in ONE database transaction (all or nothing).
// Replace needs a safety backup first. After the commit the built-in content is seeded again.
import type { Table } from 'dexie'
import type { LoopLabDb } from '../../db/db'
import { defaultSettings } from '../../db/settings'
import type { Settings } from '../../db/types'
import { seedBuiltInContent, type SeedResult } from '../../content/seed'
import { STORE_NAMES, keyOf, type StoreData, type StoreName } from './stores'
import { remapBuiltInIds } from './restoreRemap'
import type { ValidBackup } from './restoreValidate'

export type RestoreMode = 'merge' | 'replace'

export interface StoreCounts { added: number; updated: number; unchanged: number }

export interface RestoreResult {
  mode: RestoreMode
  perStore: Record<StoreName, StoreCounts>
  added: number
  updated: number
  unchanged: number
  /** Replace only: how many records were deleted to make room. */
  removed: number
  seeded: SeedResult | null
  /** Set if the built-in content could not be refreshed after the restore. The restore itself still succeeded. */
  seedWarning?: string
}

/** Thrown when a restore is refused or fails. The database has not been changed. */
export class RestoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RestoreError'
  }
}

export interface RestoreOptions {
  /** Required for Replace: must save a backup of the current data (a download) and resolve. If it throws, nothing is replaced. */
  safetyBackup?: () => Promise<void>
}

const emptyCounts = (): StoreCounts => ({ added: 0, updated: 0, unchanged: 0 })
const time = (iso: string | undefined) => (iso ? Date.parse(iso) : 0)

interface UserFlagged { isBuiltIn?: boolean; modifiedByUser?: boolean; updatedAt: string }

/** Merge rule: the newer updatedAt wins. A built-in the user edited beats a built-in that is still as shipped, whatever the dates. */
function incomingWins(incoming: UserFlagged, current: UserFlagged): boolean {
  if (incoming.isBuiltIn && current.isBuiltIn && incoming.modifiedByUser !== current.modifiedByUser) return !!incoming.modifiedByUser
  return time(incoming.updatedAt) > time(current.updatedAt)
}

async function mergeStore(table: Table<unknown, string>, store: StoreName, incoming: unknown[], skip?: (rec: unknown) => boolean): Promise<StoreCounts> {
  const counts = emptyCounts()
  if (incoming.length === 0) return counts
  const keys = incoming.map((r) => keyOf(store, r))
  const current = await table.bulkGet(keys)
  const toPut: unknown[] = []
  incoming.forEach((rec, i) => {
    const cur = current[i]
    if (!cur && skip?.(rec)) counts.unchanged++
    else if (!cur) { toPut.push(rec); counts.added++ }
    else if (incomingWins(rec as UserFlagged, cur as UserFlagged)) { toPut.push(rec); counts.updated++ }
    else counts.unchanged++
  })
  if (toPut.length) await table.bulkPut(toPut)
  return counts
}

/**
 * Drill logs that are not in the local DB (by id) but whose parent session IS, with an updatedAt newer than or equal to
 * the backup's copy of that session, belong to an older version of an edited session. Adding them would duplicate the session's logs.
 */
async function staleDrillLogFilter(db: LoopLabDb, stores: StoreData): Promise<(rec: unknown) => boolean> {
  const incomingSession = new Map(stores.sessionLogs.map((s) => [s.id, s]))
  const localSession = new Map<string, number>()
  const ids = [...new Set(stores.drillLogs.map((l) => l.sessionId))]
  const locals = await db.sessionLogs.bulkGet(ids)
  locals.forEach((s) => { if (s) localSession.set(s.id, time(s.updatedAt)) })
  return (rec) => {
    const sid = (rec as { sessionId: string }).sessionId
    const local = localSession.get(sid)
    const inc = incomingSession.get(sid)
    return local !== undefined && inc !== undefined && local >= time(inc.updatedAt)
  }
}

const laterIso = (a?: string, b?: string) => (time(a) >= time(b) ? a : b)

async function mergeSettings(db: LoopLabDb, incoming: Settings[]): Promise<StoreCounts> {
  const counts = emptyCounts()
  const inc = incoming[0]
  if (!inc) return counts
  const cur = await db.settings.get('settings')
  if (!cur) { await db.settings.put(inc); counts.added++; return counts }
  const winner = time(inc.updatedAt) > time(cur.updatedAt) ? inc : cur
  const lastBackupAt = laterIso(cur.lastBackupAt, inc.lastBackupAt)
  const merged: Settings = { ...winner, ...(lastBackupAt ? { lastBackupAt } : {}) }
  if (JSON.stringify(merged) === JSON.stringify(cur)) counts.unchanged++
  else { await db.settings.put(merged); counts.updated++ }
  return counts
}

function sum(perStore: Record<StoreName, StoreCounts>, field: keyof StoreCounts): number {
  return STORE_NAMES.reduce((a, n) => a + perStore[n][field], 0)
}

/**
 * Applies the backup. The unfinished-session draft (activeSession) in the file is never restored.
 * Everything that changes data happens inside one transaction, so any failure leaves the database as it was.
 */
export async function commitRestore(db: LoopLabDb, backup: ValidBackup, mode: RestoreMode, options: RestoreOptions = {}): Promise<RestoreResult> {
  if (mode === 'replace') {
    if (!options.safetyBackup) throw new RestoreError('Replace needs a safety backup of the current data first. Nothing was changed.')
    try {
      await options.safetyBackup()
    } catch (e) {
      throw new RestoreError(`The safety backup of your current data could not be saved (${e instanceof Error ? e.message : String(e)}), so nothing was replaced. Nothing was changed.`)
    }
  }

  const perStore = Object.fromEntries(STORE_NAMES.map((n) => [n, emptyCounts()])) as Record<StoreName, StoreCounts>
  let removed = 0
  const tables = STORE_NAMES.map((n) => db.table(n))

  try {
    await db.transaction('rw', tables, async () => {
      if (mode === 'replace') {
        for (const name of STORE_NAMES) {
          const table = db.table(name)
          removed += await table.count()
          await table.clear()
        }
        for (const name of STORE_NAMES) {
          if (name === 'activeSession') continue
          let rows = backup.stores[name] as unknown[]
          if (name === 'settings') {
            const s = (rows[0] as Settings | undefined) ?? defaultSettings()
            // The data on the phone now equals this file, so the file's own date is the last backup.
            const { backupSnoozedUntil: _snooze, ...rest } = s
            void _snooze
            rows = [{ ...rest, lastBackupAt: backup.exportedAt }]
          }
          if (rows.length) await db.table(name).bulkAdd(rows)
          perStore[name].added = rows.length
        }
        return
      }
      const stores: StoreData = await remapBuiltInIds(db, backup.stores)
      // Must be computed before sessionLogs are merged, so it sees the sessions that were local before this restore.
      const staleLogs = await staleDrillLogFilter(db, stores)
      for (const name of STORE_NAMES) {
        if (name === 'activeSession') continue
        perStore[name] = name === 'settings'
          ? await mergeSettings(db, stores.settings)
          : await mergeStore(db.table(name) as Table<unknown, string>, name, stores[name] as unknown[], name === 'drillLogs' ? staleLogs : undefined)
      }
    })
  } catch (e) {
    throw new RestoreError(`The restore could not be completed and was rolled back (${e instanceof Error ? e.message : String(e)}). Nothing was changed.`)
  }

  const result: RestoreResult = {
    mode, perStore, removed, seeded: null,
    added: sum(perStore, 'added'), updated: sum(perStore, 'updated'), unchanged: sum(perStore, 'unchanged'),
  }
  try {
    result.seeded = await seedBuiltInContent(db)
  } catch (e) {
    result.seedWarning = `Your data was restored, but the built-in content could not be refreshed (${e instanceof Error ? e.message : String(e)}). It will be refreshed the next time the app starts.`
  }
  return result
}
