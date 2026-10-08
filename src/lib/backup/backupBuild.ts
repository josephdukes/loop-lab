// The JSON backup file (spec 6): schemaVersion, appVersion, exportedAt and every store.
import type { LoopLabDb } from '../../db/db'
import { SCHEMA_VERSION } from '../../db/migrations'
import { APP_VERSION } from '../appInfo'
import { readAllStores, type StoreData } from './stores'

export interface BackupFile extends StoreData {
  schemaVersion: number
  appVersion: string
  exportedAt: string
}

export async function buildBackup(db: LoopLabDb, now: Date = new Date()): Promise<BackupFile> {
  const stores = await readAllStores(db)
  return { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(), ...stores }
}

export function backupToText(backup: BackupFile): string {
  return JSON.stringify(backup)
}
