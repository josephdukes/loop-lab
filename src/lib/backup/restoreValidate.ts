// Validation of a backup file BEFORE anything is changed (spec 6). Reads text only; never touches the database.
// Any structural problem refuses the whole file with a plain-English message that says nothing was changed.
import { MIGRATIONS, migrateBackupData, schemaVersionOf, type Migration } from '../../db/migrations'
import { BACKUP_MAX_BYTES } from '../appInfo'
import { checkStore } from './restoreSchema'
import { STORE_LABEL, STORE_NAMES, type StoreData, type StoreName } from './stores'

export const NOTHING_CHANGED = 'Nothing was changed.'

export interface ValidBackup {
  schemaVersion: number
  appVersion: string
  exportedAt: string
  stores: StoreData
}

export interface RestorePreview {
  counts: Record<StoreName, number>
  totalRecords: number
  /** Earliest and latest session or match date in the file, if any. */
  dateFrom?: string
  dateTo?: string
  exportedAt: string
  appVersion: string
  schemaVersion: number
  migratedFrom?: number
}

export type ValidateResult =
  | { ok: true; backup: ValidBackup; preview: RestorePreview }
  | { ok: false; message: string; problems: string[] }

const refuse = (reason: string, problems: string[] = []): ValidateResult => ({ ok: false, message: `${reason} ${NOTHING_CHANGED}`, problems })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Size in bytes of a text as UTF-8 (a File reports its own size; this is for text-only callers). */
export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length
}

export function validateBackupText(
  text: string,
  options: { sizeBytes?: number; migrations?: Migration[] } = {},
): ValidateResult {
  const migrations = options.migrations ?? MIGRATIONS
  const appSchema = schemaVersionOf(migrations)
  const size = options.sizeBytes ?? utf8Size(text)
  if (size >= BACKUP_MAX_BYTES) {
    return refuse(`This file is ${(size / (1024 * 1024)).toFixed(1)} MB, which is larger than the 20 MB limit for a Loop Lab backup, so it was not opened.`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return refuse('This file is not a readable Loop Lab backup. It is damaged or is not a JSON file.')
  }
  if (!isObject(raw)) return refuse('This file is not a Loop Lab backup: it does not hold the expected backup structure.')

  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return refuse('This file is not a Loop Lab backup: it has no valid schemaVersion.')
  }
  if (version > appSchema) {
    return refuse(
      `This backup was made by a newer version of Loop Lab (its data format is ${version}; this copy of the app understands up to ${appSchema}). Update the app, then try again.`,
    )
  }
  if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt))) {
    return refuse('This backup is missing a valid "exportedAt" date, so it cannot be trusted.')
  }
  if (typeof raw.appVersion !== 'string' || raw.appVersion === '') {
    return refuse('This backup is missing its "appVersion", so it cannot be trusted.')
  }

  // Older files go through the migration framework before they are checked.
  let data: Record<string, unknown> = raw
  let migratedFrom: number | undefined
  if (version < appSchema) {
    try {
      data = migrateBackupData(raw, version, migrations)
      migratedFrom = version
    } catch (e) {
      return refuse(`This backup was made by an older version (format ${version}) and could not be brought up to date: ${e instanceof Error ? e.message : String(e)}.`)
    }
  }

  const stores = {} as Record<StoreName, Record<string, unknown>[]>
  const problems: string[] = []
  for (const name of STORE_NAMES) {
    if (!(name in data)) {
      problems.push(`The "${name}" part (${STORE_LABEL[name]}) is missing from the file.`)
      continue
    }
    const keyField = name === 'weekFlags' ? 'weekStart' : name === 'settings' || name === 'activeSession' ? 'key' : 'id'
    const result = checkStore(name, data[name], keyField)
    stores[name] = result.records
    problems.push(...result.problems)
  }
  if (problems.length > 0) {
    const shown = problems.slice(0, 3).join(' ')
    const more = problems.length > 3 ? ` There ${problems.length - 3 === 1 ? 'is' : 'are'} ${problems.length - 3} more ${problems.length - 3 === 1 ? 'problem' : 'problems'}.` : ''
    return refuse(`This backup file is damaged or incomplete, so it was refused. ${shown}${more}`, problems)
  }

  const typed = stores as unknown as StoreData
  const backup: ValidBackup = { schemaVersion: appSchema, appVersion: raw.appVersion, exportedAt: raw.exportedAt, stores: typed }
  return { ok: true, backup, preview: buildPreview(backup, migratedFrom) }
}

export function buildPreview(backup: ValidBackup, migratedFrom?: number): RestorePreview {
  const counts = {} as Record<StoreName, number>
  let total = 0
  for (const name of STORE_NAMES) {
    counts[name] = backup.stores[name].length
    total += counts[name]
  }
  const dates = [...backup.stores.sessionLogs.map((s) => s.date), ...backup.stores.matchLogs.map((m) => m.date)].sort()
  return {
    counts,
    totalRecords: total,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    schemaVersion: backup.schemaVersion,
    ...(migratedFrom !== undefined ? { migratedFrom } : {}),
  }
}
