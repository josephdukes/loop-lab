import type { Transaction } from 'dexie'

/**
 * Ordered migration framework.
 *
 * Each migration has an integer `version` (1, 2, 3 ...), the full set of store definitions as of
 * that version, and an optional `upgrade` function that transforms existing data when a phone
 * moves from the previous version to this one. Migrations run in ascending order, one at a time.
 *
 * To change the database later: append a new Migration (never edit an old one), bump nothing else.
 * `SCHEMA_VERSION` is derived from the last migration. Each new migration MUST get a unit test.
 */
export interface Migration {
  version: number
  /** Dexie store definitions: store name -> index string. Primary key is the first entry. */
  stores: Record<string, string>
  upgrade?: (tx: Transaction) => void | Promise<void>
  /**
   * Stage 4: the same change as `upgrade`, for a backup FILE written by the previous version.
   * Restore runs these in order on the raw backup object before it is validated. Omit it when a
   * migration does not change the shape of the backed-up data.
   */
  transformBackup?: (backup: Record<string, unknown>) => Record<string, unknown>
  description: string
}

/** v1: every store from spec section 4. Booleans are not indexed (IndexedDB cannot index booleans). */
export const V1_STORES: Record<string, string> = {
  drills: 'id, builtInKey, category, source',
  sessionTemplates: 'id, builtInKey, kind',
  programs: 'id, builtInKey, category',
  programRuns: 'id, programId, status',
  sessionLogs: 'id, date, kind, programRunId',
  drillLogs: 'id, sessionId, drillId, [drillId+order]',
  matchLogs: 'id, date',
  blockReviews: 'id, programRunId',
  weekFlags: 'weekStart',
  settings: 'key', // single record, key "settings"
  activeSession: 'key', // single record, key "active"
}

export const MIGRATIONS: Migration[] = [
  { version: 1, stores: V1_STORES, description: 'Initial schema: all stores from spec section 4' },
]

/** Throws if the list is empty, not strictly ascending from 1, or has gaps. */
export function assertValidMigrationList(list: Migration[]): void {
  if (list.length === 0) throw new Error('No migrations defined')
  list.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version !== i + 1) {
      throw new Error(`Migrations must be numbered 1,2,3... in order; found ${m.version} at position ${i + 1}`)
    }
  })
}

export function schemaVersionOf(list: Migration[]): number {
  return list[list.length - 1].version
}

export const SCHEMA_VERSION = schemaVersionOf(MIGRATIONS)

/** Runs the `transformBackup` step of every migration newer than `fromVersion`, in order, and stamps the new schemaVersion. */
export function migrateBackupData(backup: Record<string, unknown>, fromVersion: number, list: Migration[] = MIGRATIONS): Record<string, unknown> {
  let current = backup
  for (const m of list) {
    if (m.version <= fromVersion) continue
    if (m.transformBackup) current = m.transformBackup(current)
  }
  return { ...current, schemaVersion: schemaVersionOf(list) }
}
