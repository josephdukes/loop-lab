// "Recent sessions" list helpers, the All sessions screen and the session detail (Edit / Delete with Undo).
import { useState } from 'react'
import { useApp } from '../appState'
import { BenchmarkBadge } from '../components/BenchmarkBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditorShell } from '../components/EditorShell'
import { EmptyState } from '../components/EmptyState'
import { AsyncView, ErrorBox } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import { formatResult, shortDate } from '../lib/format'
import { loadSessionRows, type SessionRow } from '../lib/homeData'
import { deleteSession, restoreSession } from '../lib/sessionService'
import { useNav } from '../nav'
import { useUndo } from '../undo'

export function sessionTitle(s: SessionRow['session']): string {
  if (s.programWeek && s.sessionLabel) return `Week ${s.programWeek}, ${s.sessionLabel}`
  return s.templateNameSnapshot ?? 'Custom session'
}

export function SessionList({ rows }: { rows: SessionRow[] }) {
  const { openOverlay } = useNav()
  return (
    <ul className="list" aria-label="Sessions">
      {rows.map(({ session, drillCount }) => (
        <li key={session.id}>
          <button type="button" className="list-item" onClick={() => openOverlay({ kind: 'sessionDetail', sessionId: session.id })}>
            <span className="list-title">{shortDate(session.date)}: {sessionTitle(session)}</span>
            <span className="muted">
              {session.kind === 'club' ? 'Club' : 'Robot'} / {drillCount} {drillCount === 1 ? 'drill' : 'drills'} / {session.totalMinutes} min
              {session.effort ? ` / effort ${session.effort}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function AllSessionsScreen() {
  const { db } = useApp()
  const { openOverlay } = useNav()
  const state = useAsync(() => loadSessionRows(db), [db])
  return (
    <EditorShell title="All sessions">
      <AsyncView state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No sessions yet">Run a session or use Quick log, and it will appear here.</EmptyState>
          ) : (
            <>
              <p className="muted">{rows.length} saved {rows.length === 1 ? 'session' : 'sessions'}, newest first. Tap one to edit or delete it.</p>
              <SessionList rows={rows} />
            </>
          )
        }
      </AsyncView>
      <button type="button" className="btn" onClick={() => openOverlay({ kind: 'quicklog' })}>Quick log a session</button>
    </EditorShell>
  )
}

export function SessionDetailScreen({ sessionId }: { sessionId: string }) {
  const { db, notifyDataChanged } = useApp()
  const { closeOverlay, openOverlay } = useNav()
  const { showUndo } = useUndo()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = useAsync(async () => {
    const session = await db.sessionLogs.get(sessionId)
    if (!session) return null
    const logs = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
    return { session, logs }
  }, [db, sessionId])

  async function remove() {
    setConfirming(false)
    try {
      const snapshot = await deleteSession(db, sessionId)
      notifyDataChanged()
      closeOverlay()
      if (snapshot) showUndo({ message: 'Session deleted.', onUndo: async () => { await restoreSession(db, snapshot); notifyDataChanged() } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <EditorShell title="Session" closeLabel="Back">
      <AsyncView state={state}>
        {(data) =>
          data === null ? (
            <EmptyState title="Session not found">It may have been deleted.</EmptyState>
          ) : (
            <>
              <div className="card">
                <h2>{sessionTitle(data.session)}</h2>
                <p>{shortDate(data.session.date)} / {data.session.kind === 'club' ? 'Club session' : 'Robot session'} / {data.session.totalMinutes} min</p>
                <p className="muted">Effort {data.session.effort ?? '-'} / Loop confidence {data.session.loopConfidence ?? '-'}</p>
                {data.session.notes && <p>{data.session.notes}</p>}
              </div>
              {data.logs.length === 0 && <EmptyState title="No drill results" >This session has no drill logs, so it does not count toward the weekly target.</EmptyState>}
              {data.logs.map((l) => (
                <div className="card" key={l.id}>
                  <h3>{l.drillNameSnapshot}</h3>
                  <p className="muted">{l.categorySnapshot}</p>
                  <p><strong>{formatResult(l)}</strong></p>
                  {l.targetSnapshot && <p>Target: {l.targetSnapshot.description} <BenchmarkBadge status={l.benchmarkMet} /></p>}
                  {l.durationMin !== undefined && l.metricType !== 'duration' && <p className="muted">{l.durationMin} min</p>}
                  {l.robotSettingsUsed && <p className="muted">Settings: {l.robotSettingsUsed}</p>}
                  {l.note && <p>{l.note}</p>}
                </div>
              ))}
              {error && <ErrorBox message={error} />}
              <div className="row">
                <button type="button" className="btn btn-big btn-primary" onClick={() => openOverlay({ kind: 'quicklog', sessionId })}>Edit</button>
                <button type="button" className="btn btn-big btn-danger" onClick={() => setConfirming(true)}>Delete</button>
              </div>
            </>
          )
        }
      </AsyncView>
      {confirming && (
        <ConfirmDialog
          title="Delete this session?"
          message="The session and all its drill results will be deleted. You will have 8 seconds to undo."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </EditorShell>
  )
}
