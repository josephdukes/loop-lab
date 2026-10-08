import { useState } from 'react'
import { useApp } from '../../appState'
import { EmptyState } from '../../components/EmptyState'
import { Status, type StatusMessage } from '../../components/Status'
import { AsyncView } from '../../components/ScreenState'
import { useAsync } from '../../hooks/useAsync'
import { todayLocal, isValidDate } from '../../lib/dates'
import { downloadCsv, loadExportData, shareAllCsv } from '../../lib/export/exportActions'
import { buildAllCsvFiles, inRange, type CsvKind, type DateRange } from '../../lib/export/exportCsv'
import type { ExportData } from '../../lib/export/exportCsv'

const LABEL: Record<CsvKind, string> = { 'drill-logs': 'Drill logs CSV', sessions: 'Sessions CSV', matches: 'Matches CSV' }

function rangeProblem(from: string, to: string): string | null {
  if (from && !isValidDate(from)) return 'The "from" date is not a real date.'
  if (to && !isValidDate(to)) return 'The "to" date is not a real date.'
  if (from && to && from > to) return 'The "from" date is after the "to" date.'
  return null
}

function rowCounts(data: ExportData, range: DateRange) {
  const ids = new Set(data.sessions.filter((s) => inRange(s.date, range)).map((s) => s.id))
  return { logs: data.drillLogs.filter((l) => ids.has(l.sessionId)).length, sessions: ids.size, matches: data.matches.filter((m) => inRange(m.date, range)).length }
}

export function ExportCard() {
  const { db } = useApp()
  const state = useAsync(() => loadExportData(db), [db])
  return (
    <div className="card" role="region" aria-label="Export spreadsheets">
      <h2>Export spreadsheets (CSV)</h2>
      <p className="muted">Three files you can open in Google Sheets or upload to Claude. Leave the dates empty to export everything.</p>
      <AsyncView state={state}>{(data) => <ExportBody data={data} />}</AsyncView>
    </div>
  )
}

function ExportBody({ data }: { data: ExportData }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState<StatusMessage>(null)
  const [busy, setBusy] = useState(false)
  const problem = rangeProblem(from, to)
  const range: DateRange = { from: from || undefined, to: to || undefined }
  const n = rowCounts(data, range)
  const empty = data.sessions.length === 0 && data.matches.length === 0

  const files = () => buildAllCsvFiles(data, range, todayLocal())

  function one(kind: CsvKind) {
    try {
      const f = files().find((x) => x.kind === kind)!
      downloadCsv(f)
      const rows = kind === 'drill-logs' ? n.logs : kind === 'sessions' ? n.sessions : n.matches
      setMessage({ kind: 'ok', text: `Saved ${f.filename} to this phone's downloads (${rows} ${rows === 1 ? 'row' : 'rows'}).` })
    } catch (e) {
      setMessage({ kind: 'error', text: `The file could not be saved (${e instanceof Error ? e.message : String(e)}).` })
    }
  }

  async function all() {
    setBusy(true)
    setMessage(null)
    try {
      const outcome = await shareAllCsv(files())
      setMessage(
        outcome === 'shared' ? { kind: 'ok', text: 'Shared all three files.' }
          : outcome === 'cancelled' ? { kind: 'info', text: 'Sharing was cancelled. Nothing was sent.' }
            : { kind: 'ok', text: 'This browser cannot share files, so the three files were saved to this phone\'s downloads one by one. If only some appear, Chrome may have asked to allow multiple downloads.' },
      )
    } catch (e) {
      setMessage({ kind: 'error', text: `The files could not be shared (${e instanceof Error ? e.message : String(e)}).` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {empty && <EmptyState title="Nothing logged yet">The files will contain only their header rows until you log a session or a match.</EmptyState>}
      <div className="row two">
        <label className="field"><span>From date (optional)</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>To date (optional)</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {problem && <p className="error" role="alert">{problem}</p>}
      <p className="muted" aria-live="polite">{problem ? '' : `In this range: ${n.sessions} sessions, ${n.logs} drill logs, ${n.matches} matches.`}</p>
      <div className="stack">
        {(Object.keys(LABEL) as CsvKind[]).map((k) => (
          <button key={k} type="button" className="btn" disabled={!!problem || busy} onClick={() => one(k)}>{LABEL[k]}</button>
        ))}
        <button type="button" className="btn btn-primary" disabled={!!problem || busy} onClick={all}>Share all three</button>
      </div>
      <Status message={message} />
    </>
  )
}
