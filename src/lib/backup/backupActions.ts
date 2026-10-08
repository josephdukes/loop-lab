// Making a backup file and recording it (spec 6). lastBackupAt is set ONLY when a download was started or the share
// sheet reported success. If the person cancels the share sheet, nothing is recorded.
import type { LoopLabDb } from '../../db/db'
import { updateSettings } from '../../db/settings'
import { todayLocal } from '../dates'
import { backupFilename } from '../export/exportCsv'
import { canShareFiles, downloadFile, shareFiles, textFile } from '../deliver'
import { backupToText, buildBackup } from './backupBuild'

export type BackupOutcome =
  | { kind: 'downloaded'; filename: string }
  | { kind: 'shared'; filename: string }
  | { kind: 'cancelled'; filename: string }

export function shareSupportedForBackup(): boolean {
  return canShareFiles([new File(['{}'], 'loop-lab-backup.json', { type: 'application/json' })])
}

/** `prefer: 'share'` uses the share sheet when this browser supports it for files, otherwise downloads. */
export async function performBackup(db: LoopLabDb, prefer: 'share' | 'download', now: Date = new Date()): Promise<BackupOutcome> {
  const backup = await buildBackup(db, now)
  const filename = backupFilename(todayLocal(now))
  const file = textFile(backupToText(backup), filename, 'application/json')

  if (prefer === 'share') {
    const outcome = await shareFiles([file], 'Loop Lab backup')
    if (outcome === 'cancelled') return { kind: 'cancelled', filename }
    if (outcome === 'shared') {
      await updateSettings(db, { lastBackupAt: now.toISOString() })
      return { kind: 'shared', filename }
    }
    // 'unsupported' falls through to a download.
  }
  downloadFile(file, filename)
  await updateSettings(db, { lastBackupAt: now.toISOString() })
  return { kind: 'downloaded', filename }
}
