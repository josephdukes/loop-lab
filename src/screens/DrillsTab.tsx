import { useApp } from '../appState'
import { BenchmarkBadge } from '../components/BenchmarkBadge'
import { DrillBrowser } from '../components/DrillBrowser'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import { evaluateBoard } from '../lib/benchmarks'
import { benchmarkDetail, formatResult, formatValue, METRIC_LABEL, shortDate } from '../lib/format'
import { ItemActions } from '../components/ItemActions'
import { useNav } from '../nav'

export function DrillsTab() {
  const { nav, openTrain, openOverlay } = useNav()
  if (nav.drillId) return <DrillDetail drillId={nav.drillId} onBack={() => openTrain('drills')} />
  return (
    <div>
      <button type="button" className="btn btn-primary" onClick={() => openOverlay({ kind: 'drillEditor' })}>New drill</button>
      <DrillBrowser allowArchived onSelect={(d) => openTrain('drills', { drillId: d.id })} />
    </div>
  )
}

function DrillDetail({ drillId, onBack }: { drillId: string; onBack: () => void }) {
  const { db } = useApp()
  const { openOverlay, openTrain } = useNav()
  const state = useAsync(async () => {
    const drill = await db.drills.get(drillId)
    if (!drill) return null
    const logs = await db.drillLogs.where('drillId').equals(drillId).toArray()
    const sessions = await db.sessionLogs.bulkGet([...new Set(logs.map((l) => l.sessionId))])
    const dateOf = new Map(sessions.filter(Boolean).map((s) => [s!.id, s!.date]))
    const rows = logs
      .map((log) => ({ log, date: dateOf.get(log.sessionId) ?? '' }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.log.order - b.log.order)
    return { drill, rows }
  }, [db, drillId])

  return (
    <div>
      <button type="button" className="btn" onClick={onBack}>Back to drills</button>
      <AsyncView state={state}>
        {(data) => {
          if (!data) return <EmptyState title="Drill not found">It may have been removed.</EmptyState>
          const { drill, rows } = data
          const board = drill.benchmark ? evaluateBoard(rows.map((r) => r.log), drill.benchmark) : null
          return (
            <>
              <h2 className="section-h">{drill.name}{drill.archived ? ' (archived)' : ''}</h2>
              <ItemActions kind="drill" item={drill} onEdit={() => openOverlay({ kind: 'drillEditor', drillId: drill.id })} onDuplicated={(id) => openTrain('drills', { drillId: id })} onDeleted={onBack} />
              <p className="muted">{drill.isBuiltIn ? (drill.modifiedByUser ? 'Built-in, edited by you' : 'Built-in') : 'Custom'} / {drill.category} / {METRIC_LABEL[drill.metricType]}{drill.defaultDurationMin ? ` / ${drill.defaultDurationMin} min` : ''}{drill.defaultAttempts ? ` / ${drill.defaultAttempts} attempts` : ''}</p>
              <div className="card">
                <h3>What it is</h3>
                <p>{drill.description || 'No description.'}</p>
              </div>
              <div className="card">
                <h3>Suggested robot settings</h3>
                <p>{drill.suggestedSettings || 'None suggested.'}</p>
              </div>
              <div className="card">
                <h3>Cues</h3>
                <p>{drill.cues || 'None.'}</p>
              </div>
              <div className="card">
                <h3>Benchmark</h3>
                {drill.benchmark ? (
                  <>
                    <p>{benchmarkDetail(drill.benchmark)}</p>
                    {board && <p><BenchmarkBadge status={board.status} />{board.latest !== undefined && <span className="muted"> latest {formatValue(drill.metricType, board.latest)}, best {formatValue(drill.metricType, board.best as number)}</span>}</p>}
                  </>
                ) : <p className="muted">No benchmark for this drill.</p>}
              </div>
              <div className="card">
                <h3>Recent results</h3>
                {rows.length === 0 ? <p className="muted">No results logged for this drill yet.</p> : (
                  <ul className="plain">
                    {rows.slice(-8).reverse().map(({ log, date }) => (
                      <li key={log.id}>{date ? shortDate(date) : 'Unknown date'}: {formatResult(log)} <BenchmarkBadge status={log.benchmarkMet} /></li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )
        }}
      </AsyncView>
    </div>
  )
}
