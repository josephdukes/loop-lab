// Block Review (spec 3.8): compare this block with the previous one, show the static prompts,
// save "Emphasis for next block" as a blockReviews record, list past reviews.
import { useState } from 'react'
import { useApp } from '../appState'
import { EditorShell } from '../components/EditorShell'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { BLOCK_REVIEW_PROMPTS } from '../content/builtinContent'
import { useAsync } from '../hooks/useAsync'
import { describeChange, loadBlockReviewData, loadBlockReviews, saveBlockReview, windowDays, type BlockComparison, type Change, type WindowStats } from '../lib/blockReview'
import { todayLocal } from '../lib/dates'
import { dayMonth, oneDecimal } from '../lib/format'
import { useUnsavedGuard } from '../nav'

const ARROW: Record<Change['direction'], string> = { up: '▲', down: '▼', same: '=', none: '-' }

export function BlockReviewScreen({ runId }: { runId?: string }) {
  const { db } = useApp()
  const today = todayLocal()
  const data = useAsync(() => loadBlockReviewData(db, runId, today), [db, runId, today])
  const past = useAsync(() => loadBlockReviews(db), [db])

  return (
    <EditorShell title="Block Review">
      <AsyncView state={data}>
        {(d) => (
          <>
            <WindowCard comparison={d.comparison} programName={d.program?.name} cycleNumber={d.cycleNumber} />
            <Comparison c={d.comparison} />
            <h2 className="section-h">Prompts</h2>
            {BLOCK_REVIEW_PROMPTS.map((p) => <div key={p} className="card note-card"><p>{p}</p></div>)}
            <NotesForm comparison={d.comparison} runId={d.run?.id} cycleNumber={d.cycleNumber} />
          </>
        )}
      </AsyncView>
      <h2 className="section-h">Past block reviews</h2>
      <AsyncView state={past}>
        {(list) => list.length === 0 ? (
          <EmptyState title="No block reviews yet">Your saved reviews will be listed here, newest first.</EmptyState>
        ) : (
          <ul className="list" aria-label="Past block reviews">
            {list.map((r) => (
              <li key={r.id} className="card">
                <h3>{dayMonth(r.date)}{r.cycleNumber ? `, cycle ${r.cycleNumber}` : ''}</h3>
                <p className="muted">Window {dayMonth(r.windowStart)} to {dayMonth(r.windowEnd)}{r.programRunId ? '' : ' (not linked to a program)'}</p>
                <p>{r.emphasisNotes || 'No notes.'}</p>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </EditorShell>
  )
}

function WindowCard({ comparison, programName, cycleNumber }: { comparison: BlockComparison; programName?: string; cycleNumber?: number }) {
  const { window, previousWindow: prev } = comparison
  return (
    <div className="card">
      <h2>{programName ? `${programName}${cycleNumber ? `, cycle ${cycleNumber}` : ''}` : 'Latest block'}</h2>
      <p>This block: {dayMonth(window.start)} to {dayMonth(window.end)} ({windowDays(window)} days)</p>
      <p className="muted">Compared with: {dayMonth(prev.start)} to {dayMonth(prev.end)}</p>
      {comparison.fallback && <p className="muted" role="status">No sessions found for a program cycle, so this uses the last 28 days.</p>}
    </div>
  )
}

function Metric({ label, current, previous, change }: { label: string; current: string; previous: string; change: Change }) {
  return (
    <div className="card" role="group" aria-label={label}>
      <h3>{label}</h3>
      <div className="compare">
        <div><div className="label">This block</div><div className="num">{current}</div></div>
        <div><div className="label">Previous block</div><div className="num">{previous}</div></div>
      </div>
      <p><span aria-hidden="true">{ARROW[change.direction]} </span>{change.text}</p>
    </div>
  )
}

const pct = (s: WindowStats) => (s.loopPercent === null ? 'n/a' : `${s.loopPercent.toFixed(1)}%`)

function Comparison({ c }: { c: BlockComparison }) {
  const { current: a, previous: b } = c
  return (
    <>
      <Metric
        label="Loops landed in matches" current={pct(a)} previous={pct(b)}
        change={describeChange(a.loopPercent, b.loopPercent, ' points')}
      />
      <p className="muted">Loops: {a.loopsLanded} landed of {a.loopsAttempted} attempted this block; {b.loopsLanded} of {b.loopsAttempted} before.</p>
      <Metric
        label="Average match confidence (1 to 5)"
        current={a.averageConfidence === null ? 'n/a' : oneDecimal(a.averageConfidence)} previous={b.averageConfidence === null ? 'n/a' : oneDecimal(b.averageConfidence)}
        change={describeChange(a.averageConfidence, b.averageConfidence, '')}
      />
      <Metric
        label="Best Pressure Streak Game streak"
        current={a.bestStreak === null ? 'n/a' : String(a.bestStreak)} previous={b.bestStreak === null ? 'n/a' : String(b.bestStreak)}
        change={describeChange(a.bestStreak, b.bestStreak, '', 0)}
      />
      {a.matches === 0 && b.matches === 0 && <EmptyState title="No matches in either block">Log your matches in the Matches tab and the loop and confidence comparison fills in.</EmptyState>}
    </>
  )
}

function NotesForm({ comparison, runId, cycleNumber }: { comparison: BlockComparison; runId?: string; cycleNumber?: number }) {
  const { db, notifyDataChanged } = useApp()
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useUnsavedGuard(notes.trim() !== '')

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveBlockReview(db, { runId, cycleNumber, window: comparison.window, emphasisNotes: notes, today: todayLocal() })
      setStatus('Saved. It is listed under Past block reviews.')
      setNotes('')
      notifyDataChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setSaving(false)
  }

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <label className="field">
        <span>Emphasis for next block</span>
        <textarea rows={4} value={notes} onChange={(e) => { setNotes(e.target.value); setStatus(null) }} />
      </label>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert" className="error">Could not save: {error}</p>}
      <button type="submit" className="btn btn-big btn-primary" disabled={saving}>{saving ? 'Saving' : 'Save block review'}</button>
    </form>
  )
}
