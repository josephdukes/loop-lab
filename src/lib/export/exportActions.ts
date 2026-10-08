// Loading the data for export and handing the CSV files to the person (download or share sheet).
import type { LoopLabDb } from '../../db/db'
import { loadRestWeeks } from '../weekFlags'
import { canShareFiles, downloadFile, shareFiles, textFile, type ShareOutcome } from '../deliver'
import type { CsvFileText, ExportData } from './exportCsv'
import { buildSummary } from './summary'

export async function loadExportData(db: LoopLabDb): Promise<ExportData> {
  const [sessions, drillLogs, matches, programs, programRuns] = await Promise.all([
    db.sessionLogs.toArray(), db.drillLogs.toArray(), db.matchLogs.toArray(), db.programs.toArray(), db.programRuns.toArray(),
  ])
  return { sessions, drillLogs, matches, programs, programRuns }
}

export async function buildSummaryText(db: LoopLabDb, weeks: number, weeklyTarget: number, today: string): Promise<string> {
  const [data, drills, restWeeks] = await Promise.all([loadExportData(db), db.drills.toArray(), loadRestWeeks(db)])
  return buildSummary({ today, weeks, weeklyTarget, sessions: data.sessions, drillLogs: data.drillLogs, matches: data.matches, drills, restWeeks })
}

const toFile = (f: CsvFileText) => textFile(f.text, f.filename, 'text/csv')

export function downloadCsv(f: CsvFileText): void {
  downloadFile(toFile(f), f.filename)
}

export type ShareAllOutcome = ShareOutcome | 'downloaded'

/** One share sheet with all three files where the browser supports it, otherwise three separate downloads. */
export async function shareAllCsv(files: CsvFileText[]): Promise<ShareAllOutcome> {
  const list = files.map(toFile)
  if (canShareFiles(list)) {
    const outcome = await shareFiles(list, 'Loop Lab data')
    if (outcome !== 'unsupported') return outcome
  }
  files.forEach(downloadCsv)
  return 'downloaded'
}
