import { useMemo, useState } from 'react'
import { useApp } from '../appState'
import { CategoryChips } from '../components/Chips'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { AsyncView, ErrorBox } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import type { Program } from '../db/types'
import { todayLocal } from '../lib/dates'
import { benchmarkText, splitNotes } from '../lib/format'
import { loadProgramDetail, loadProgramList, type ProgramDetailData, type ProgramSummary } from '../lib/programList'
import { pauseRun, resumeRun, setRunPosition, startProgramRun } from '../lib/programRuns'
import { resolveSlot } from '../lib/slots'
import { ItemActions } from '../components/ItemActions'
import { ShowArchived } from '../components/ShowArchived'
import { hasBlockReview } from '../lib/blockReview'
import { useNav } from '../nav'
import { P2CheckCard } from './P2CheckCard'
import { badgeText } from './Home'

export function progressText(s: ProgramSummary): string {
  const total = s.program.weeks.length * s.program.sessionsPerWeek
  if (!s.run || !s.position) return 'Not started'
  const where = s.position.finished ? 'Finished' : `Week ${s.position.week} of ${s.program.weeks.length}${s.program.repeating ? `, cycle ${s.position.cycleNumber}` : ''}`
  const status = s.run.status === 'paused' ? 'Paused' : s.run.status === 'completed' ? 'Completed' : 'Active'
  return `${status}: ${where} (${s.completed}${s.program.repeating ? '' : ` of ${total}`} sessions done)`
}

export function ProgramsTab() {
  const { nav, openTrain } = useNav()
  if (nav.programId) return <ProgramDetail programId={nav.programId} onBack={() => openTrain('programs')} />
  return <ProgramList />
}

function ProgramList() {
  const { db } = useApp()
  const { openTrain, openOverlay } = useNav()
  const [category, setCategory] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const state = useAsync(() => loadProgramList(db, todayLocal(), showArchived), [db, showArchived])
  return (
    <div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => openOverlay({ kind: 'programEditor' })}>New program</button>
        <ShowArchived value={showArchived} onChange={setShowArchived} />
      </div>
      <CategoryChips value={category} onChange={setCategory} />
      <AsyncView state={state}>
        {(rows) => {
          const shown = rows.filter((r) => !category || r.program.category === category)
          if (rows.length === 0) return <EmptyState title="No programs yet">Built-in programs are added when the app first opens.</EmptyState>
          if (shown.length === 0) return <EmptyState title="No programs in this category">Pick another category, or choose All.</EmptyState>
          return (
            <ul className="list" aria-label="Programs">
              {shown.map((r) => (
                <li key={r.program.id}>
                  <button type="button" className="list-item" onClick={() => openTrain('programs', { programId: r.program.id })}>
                    <span className="list-title">{r.program.name}{r.program.archived ? ' (archived)' : ''}</span>
                    <span className="muted">{r.program.category} / {r.program.weeks.length} {r.program.weeks.length === 1 ? 'week' : 'weeks'}{r.program.repeating ? ', repeating' : ''}{!r.program.isBuiltIn ? ' / Custom' : r.program.modifiedByUser ? ' / Edited' : ''}</span>
                    <span>{progressText(r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }}
      </AsyncView>
    </div>
  )
}

function ProgramDetail({ programId, onBack }: { programId: string; onBack: () => void }) {
  const { db } = useApp()
  const state = useAsync(() => loadProgramDetail(db, programId, todayLocal()), [db, programId])
  return (
    <div>
      <button type="button" className="btn" onClick={onBack}>Back to programs</button>
      <AsyncView state={state}>
        {(data) => (data ? <DetailBody data={data} /> : <EmptyState title="Program not found">It may have been removed.</EmptyState>)}
      </AsyncView>
    </div>
  )
}

function DetailBody({ data }: { data: ProgramDetailData }) {
  const { db, notifyDataChanged } = useApp()
  const { openOverlay, openTrain } = useNav()
  const { summary } = data
  const { program, run, position } = summary
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmStart, setConfirmStart] = useState(false)
  const [setting, setSetting] = useState(false)

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null)
    try { await fn(); setMessage(done ?? null); notifyDataChanged() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const start = () => act(() => startProgramRun(db, program, todayLocal()), 'Started. The next session is on the Home tab.')
  const canStart = !run || run.status === 'completed'
  const notes = splitNotes(program.notes)

  return (
    <div>
      <h2 className="section-h">{program.name}{program.archived ? ' (archived)' : ''}</h2>
      <ItemActions kind="program" item={program} onEdit={() => openOverlay({ kind: 'programEditor', programId: program.id })} onDuplicated={(id) => openTrain('programs', { programId: id })} onDeleted={() => openTrain('programs')} />
      <p className="muted">{program.category} / {program.weeks.length} {program.weeks.length === 1 ? 'week' : 'weeks'} / {program.sessionsPerWeek} sessions a week{program.repeating ? ' / repeating' : ''}</p>
      <p>{program.description}</p>

      <div className="card" aria-label="Progress">
        <h3>Progress</h3>
        <p>{progressText(summary)}</p>
        {run && position && run.status !== 'completed' && summary.badge && run.status === 'active' && <p className="muted">{badgeText(summary.badge)} (started {run.startDate})</p>}
        {run && position && !position.finished && <p>Next: Week {position.week}, {program.weeks.find((w) => w.weekNumber === position.week)?.sessions[position.session - 1]?.label ?? `Session ${position.session}`}</p>}
        <div className="row">
          {canStart && <button type="button" className="btn btn-primary" onClick={() => (data.otherActive ? setConfirmStart(true) : void start())}>{run ? 'Start again' : 'Start'}</button>}
          {run?.status === 'active' && <button type="button" className="btn" onClick={() => act(() => pauseRun(db, run.id), 'Paused.')}>Pause</button>}
          {run?.status === 'paused' && <button type="button" className="btn btn-primary" onClick={() => act(() => resumeRun(db, run.id), 'Resumed.')}>Resume</button>}
          {run && <button type="button" className="btn" onClick={() => setSetting((s) => !s)} aria-expanded={setting}>Set position</button>}
        </div>
        {message && <p role="status">{message}</p>}
        {error && <ErrorBox message={error} />}
        {setting && run && (
          <SetPosition
            program={program}
            current={position}
            onApply={(w, s, c) => act(() => setRunPosition(db, run.id, w, s, c), `Position set to week ${w}, session ${s}.`).then(() => setSetting(false))}
            onCancel={() => setSetting(false)}
          />
        )}
      </div>

      {program.builtInKey === 'P2' && <P2CheckCard variant="program" />}
      {hasBlockReview(program) && (
        <div className="card">
          <h3>Block Review</h3>
          <p className="muted">Compare this block with the one before, then note what to emphasise next. Open it after week {program.cycleLengthWeeks ?? program.weeks.length}, or any time.</p>
          <button type="button" className="btn" onClick={() => openOverlay({ kind: 'blockReview', runId: run?.id })}>Open Block Review</button>
        </div>
      )}

      <h3 className="section-h">Weeks</h3>
      {program.weeks.map((w) => (
        <details key={w.weekNumber} className="card" open={run && position ? position.week === w.weekNumber : w.weekNumber === 1}>
          <summary>Week {w.weekNumber}: {w.title}</summary>
          {w.goal && <p className="muted">{w.goal}</p>}
          {w.sessions.map((slot, si) => {
            const r = resolveSlot(slot, data.templates, data.drills)
            const isNext = !!position && !position.finished && position.week === w.weekNumber && position.session === si + 1
            return (
              <div key={si} className={isNext ? 'slot slot-next' : 'slot'}>
                <h4>{slot.label}{isNext ? ' (next up)' : ''}</h4>
                {r ? (
                  <>
                    <p className="muted">{r.templateName} / {r.totalMinutes} min</p>
                    <ul className="plain">
                      {r.items.map((it) => (
                        <li key={it.drill.id}>
                          {it.drill.name}{it.durationMin ? `, ${it.durationMin} min` : ''}
                          {it.benchmark && <span className="muted"> / Benchmark: {benchmarkText(it.benchmark)}{it.benchmark.consecutiveSessions > 1 ? ` (${it.benchmark.consecutiveSessions} sessions in a row)` : ''}{it.overridden ? ' (set by this program)' : ''}</span>}
                          {it.note && <span className="muted"> / {it.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : <p className="error">Session template missing.</p>}
              </div>
            )
          })}
        </details>
      ))}

      {notes.length > 0 && (
        <>
          <h3 className="section-h">Guidance</h3>
          {notes.map((n, i) => <div key={i} className="card note-card"><p>{n}</p></div>)}
        </>
      )}

      {confirmStart && data.otherActive && (
        <ConfirmDialog
          title="Pause the other program?"
          message={`${data.otherActive.programName} is running. Starting this program will pause it. You can resume it later.`}
          confirmLabel="Pause it and start"
          onCancel={() => setConfirmStart(false)}
          onConfirm={() => { setConfirmStart(false); void start() }}
        />
      )}
    </div>
  )
}

function SetPosition({ program, current, onApply, onCancel }: {
  program: Program
  current?: { week: number; session: number; cycleNumber: number }
  onApply: (week: number, session: number, cycle: number) => void
  onCancel: () => void
}) {
  const [week, setWeek] = useState(current?.week ?? 1)
  const [session, setSession] = useState(current?.session ?? 1)
  const [cycle, setCycle] = useState(current?.cycleNumber ?? 1)
  const weeks = useMemo(() => program.weeks.map((w) => w.weekNumber), [program])
  return (
    <div className="card" role="group" aria-label="Set position">
      <label className="field">
        <span>Week</span>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>{weeks.map((n) => <option key={n} value={n}>Week {n}</option>)}</select>
      </label>
      <label className="field">
        <span>Session</span>
        <select value={session} onChange={(e) => setSession(Number(e.target.value))}>
          {Array.from({ length: program.sessionsPerWeek }, (_, i) => <option key={i} value={i + 1}>{program.weeks.find((w) => w.weekNumber === week)?.sessions[i]?.label ?? `Session ${i + 1}`}</option>)}
        </select>
      </label>
      {program.repeating && (
        <label className="field">
          <span>Cycle</span>
          <input type="number" min={1} step={1} inputMode="numeric" value={cycle} onChange={(e) => setCycle(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
        </label>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => onApply(week, session, cycle)}>Apply</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
