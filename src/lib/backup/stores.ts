// The eleven IndexedDB stores (spec 4), in the order they are written, and how each record is keyed.
import type { LoopLabDb } from '../../db/db'
import type {
  ActiveSession, BlockReview, Drill, DrillLog, MatchLog, Program, ProgramRun, SessionLog, SessionTemplate, Settings, WeekFlag,
} from '../../db/types'

export const STORE_NAMES = [
  'drills', 'sessionTemplates', 'programs', 'programRuns', 'sessionLogs', 'drillLogs', 'matchLogs', 'blockReviews', 'weekFlags', 'settings', 'activeSession',
] as const
export type StoreName = (typeof STORE_NAMES)[number]

export interface StoreData {
  drills: Drill[]
  sessionTemplates: SessionTemplate[]
  programs: Program[]
  programRuns: ProgramRun[]
  sessionLogs: SessionLog[]
  drillLogs: DrillLog[]
  matchLogs: MatchLog[]
  blockReviews: BlockReview[]
  weekFlags: WeekFlag[]
  settings: Settings[]
  activeSession: ActiveSession[]
}

/** Plain names for messages shown to Joe. */
export const STORE_LABEL: Record<StoreName, string> = {
  drills: 'Drills',
  sessionTemplates: 'Session templates',
  programs: 'Programs',
  programRuns: 'Program runs',
  sessionLogs: 'Sessions',
  drillLogs: 'Drill logs',
  matchLogs: 'Matches',
  blockReviews: 'Block reviews',
  weekFlags: 'Rest-week flags',
  settings: 'Settings',
  activeSession: 'Unfinished session',
}

/** The primary key value of a record in a store. */
export function keyOf(store: StoreName, record: unknown): string {
  const r = record as Record<string, unknown>
  const k = store === 'weekFlags' ? r.weekStart : store === 'settings' || store === 'activeSession' ? r.key : r.id
  return String(k)
}

/** Every record in every store, read in one read-only transaction so the snapshot is consistent. */
export async function readAllStores(db: LoopLabDb): Promise<StoreData> {
  return db.transaction('r', STORE_NAMES.map((n) => db.table(n)), async () => {
    const out: Record<string, unknown[]> = {}
    for (const name of STORE_NAMES) out[name] = await db.table(name).toArray()
    return out as unknown as StoreData
  })
}
