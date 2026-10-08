import Dexie, { type Table } from 'dexie'
import type {
  ActiveSession,
  BlockReview,
  Drill,
  DrillLog,
  MatchLog,
  Program,
  ProgramRun,
  SessionLog,
  SessionTemplate,
  Settings,
  WeekFlag,
} from './types'
import { MIGRATIONS, assertValidMigrationList, type Migration } from './migrations'

export class LoopLabDb extends Dexie {
  drills!: Table<Drill, string>
  sessionTemplates!: Table<SessionTemplate, string>
  programs!: Table<Program, string>
  programRuns!: Table<ProgramRun, string>
  sessionLogs!: Table<SessionLog, string>
  drillLogs!: Table<DrillLog, string>
  matchLogs!: Table<MatchLog, string>
  blockReviews!: Table<BlockReview, string>
  weekFlags!: Table<WeekFlag, string>
  settings!: Table<Settings, string>
  activeSession!: Table<ActiveSession, string>

  constructor(name = 'loop-lab', migrations: Migration[] = MIGRATIONS) {
    super(name)
    assertValidMigrationList(migrations)
    // Register every migration in ascending order. Dexie runs the `upgrade` of each version
    // newer than the one already on the phone, in order.
    for (const m of migrations) {
      const v = this.version(m.version).stores(m.stores)
      if (m.upgrade) v.upgrade(m.upgrade)
    }
  }
}

let shared: LoopLabDb | null = null

/** The app-wide database instance. */
export function getDb(): LoopLabDb {
  if (!shared) shared = new LoopLabDb()
  return shared
}
