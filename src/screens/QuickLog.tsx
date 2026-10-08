// Quick log and edit log: the same drill-by-drill form as the runner, without timers (spec 5).
import { useEffect, useReducer, useState } from 'react'
import { useApp } from '../appState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditorShell } from '../components/EditorShell'
import { DrillBrowser } from '../components/DrillBrowser'
import { DrillFields, TargetLine } from '../components/DrillFields'
import { EmptyState } from '../components/EmptyState'
import { ErrorBox, Loading } from '../components/ScreenState'
import { SummaryFields } from '../components/SummaryFields'
import type { SessionTemplate } from '../db/types'
import { isValidDate, todayLocal } from '../lib/dates'
import { runnerReducer, type RunnerState } from '../lib/runnerState'
import { draftFromState, deleteSession, restoreSession, saveSession, updateSession } from '../lib/sessionService'
import { buildQuickLogState, drillToRunnerDrill } from '../lib/startSession'
import { loadStateForEdit } from '../lib/sessionDraft'
import { requestPersistentStorage } from '../lib/storage'
import { useBackInterceptor, useNav, useUnsavedGuard } from '../nav'
import { useUndo } from '../undo'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'choose' }
  | { kind: 'form'; state: RunnerState }

export function QuickLogScreen({ sessionId, templateId }: { sessionId?: string; templateId?: string }) {
  const { db } = useApp()
  const [phase, setPhase] = useState<Phase>(sessionId || templateId ? { kind: 'loading' } : { kind: 'choose' })

  useEffect(() => {
    if (!sessionId && !templateId) return
    let cancelled = false
    const p = sessionId ? loadStateForEdit(db, sessionId) : buildQuickLogState(db, { templateId })
    p.then(
      (state) => { if (!cancelled) setPhase({ kind: 'form', state }) },
      (e) => { if (!cancelled) setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) }) },
    )
    return () => { cancelled = true }
  }, [db, sessionId, templateId])

  return (
    <EditorShell title={sessionId ? 'Edit session' : 'Quick log'}>
      {phase.kind === 'loading' && <Loading />}
      {phase.kind === 'error' && <ErrorBox message={phase.message} />}
      {phase.kind === 'choose' && <Chooser onForm={(state) => setPhase({ kind: 'form', state })} />}
      {phase.kind === 'form' && <LogForm initial={phase.state} sessionId={sessionId} />}
    </EditorShell>
  )
}

function Chooser({ onForm }: { onForm: (s: RunnerState) => void }) {
  const { db } = useApp()
  const [templates, setTemplates] = useState<SessionTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.sessionTemplates.toArray().then((t) => setTemplates(t.filter((x) => !x.archived).sort((a, b) => a.name.localeCompare(b.name))), (e) => setError(String(e)))
  }, [db])

  const fromTemplate = (id: string) => buildQuickLogState(db, { templateId: id }).then(onForm, (e) => setError(e instanceof Error ? e.message : String(e)))

  return (
    <div>
      <p>Log a session after the fact. Choose a session template to start from, or build the list by picking drills.</p>
      <button type="button" className="btn btn-big btn-primary" onClick={() => buildQuickLogState(db, { kind: 'robot' }).then(onForm)}>Pick drills myself</button>
      <h2 className="section-h">Or start from a template</h2>
      {error && <ErrorBox message={error} />}
      {!templates && !error && <Loading />}
      {templates && templates.length === 0 && <EmptyState title="No session templates" />}
      {templates && (
        <ul className="list" aria-label="Session templates">
          {templates.map((t) => (
            <li key={t.id}>
              <button type="button" className="list-item" onClick={() => fromTemplate(t.id)}>
                <span className="list-title">{t.name}</span>
                <span className="muted">{t.kind === 'club' ? 'Club session' : 'Robot session'} / {t.items.length} drills</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LogForm({ initial, sessionId }: { initial: RunnerState; sessionId?: string }) {
  const { db, notifyDataChanged } = useApp()
  const { nav, closeOverlay, setTab } = useNav()
  const { showUndo } = useUndo()
  const [state, dispatch] = useReducer(runnerReducer, initial)
  const [picking, setPicking] = useState(false)
  const [initialJson] = useState(() => JSON.stringify(initial))
  // Close, Cancel and the Back button ask before throwing away anything typed. The picker closes first.
  useUnsavedGuard(!picking && JSON.stringify(state) !== initialJson)
  useBackInterceptor(picking, () => setPicking(false))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayLocal()
  const now = Date.now()
  const draft = draftFromState(state, { now })
  const dateOk = isValidDate(state.date) && state.date <= today

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (sessionId) await updateSession(db, sessionId, draft)
      else await saveSession(db, draft, { onFirstSave: requestPersistentStorage })
      notifyDataChanged()
      if (sessionId) closeOverlay()
      else setTab('home')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  async function remove() {
    if (!sessionId) return
    setConfirmDelete(false)
    try {
      const snapshot = await deleteSession(db, sessionId)
      notifyDataChanged()
      // Back to where the person came from: past the session detail screen too, since that session no longer exists.
      closeOverlay(nav.overlays[nav.overlays.length - 2]?.kind === 'sessionDetail' ? 2 : 1)
      if (snapshot) showUndo({ message: 'Session deleted.', onUndo: async () => { await restoreSession(db, snapshot); notifyDataChanged() } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (picking) {
    return (
      <div>
        <h2>Pick a drill to add</h2>
        <DrillBrowser actionLabel="Add" onSelect={(d) => { dispatch({ type: 'addDrill', drill: drillToRunnerDrill(d) }); setPicking(false) }} />
        <button type="button" className="btn" onClick={() => setPicking(false)}>Cancel</button>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <label className="field">
          <span>Date</span>
          <input type="date" value={state.date} max={today} onChange={(e) => dispatch({ type: 'setMeta', patch: { date: e.target.value } })} />
        </label>
        {!dateOk && <p className="error" role="alert">Choose a real date that is not in the future.</p>}
        <div className="field" role="group" aria-label="Session kind">
          <span>Kind</span>
          <div className="row two">
            <button type="button" className="btn" aria-pressed={state.kind === 'robot'} onClick={() => dispatch({ type: 'setMeta', patch: { kind: 'robot' } })}>Robot session</button>
            <button type="button" className="btn" aria-pressed={state.kind === 'club'} onClick={() => dispatch({ type: 'setMeta', patch: { kind: 'club' } })}>Club session</button>
          </div>
        </div>
        {state.templateName && <p className="muted">From: {state.templateName}{state.sessionLabel ? ` (${state.sessionLabel})` : ''}</p>}
      </div>

      {state.drills.length === 0 && <EmptyState title="No drills yet">Add the drills you did.</EmptyState>}
      {state.drills.map((d, i) => (
        <section key={d.key} className="card" aria-label={`Drill ${i + 1}: ${d.name}`}>
          <h2>{d.name}</h2>
          <p className="muted">{d.category}</p>
          <TargetLine drill={d} />
          <DrillFields drill={d} index={i} dispatch={dispatch} showMinutes />
          <div className="row builder-actions">
            <button type="button" className="btn" aria-label={`Move ${d.name} up`} disabled={i === 0} onClick={() => dispatch({ type: 'moveDrill', index: i, delta: -1 })}>Up</button>
            <button type="button" className="btn" aria-label={`Move ${d.name} down`} disabled={i === state.drills.length - 1} onClick={() => dispatch({ type: 'moveDrill', index: i, delta: 1 })}>Down</button>
            <button type="button" className="btn btn-danger" aria-label={`Remove ${d.name}`} onClick={() => dispatch({ type: 'removeDrill', index: i })}>Remove</button>
          </div>
        </section>
      ))}
      <button type="button" className="btn btn-big" onClick={() => setPicking(true)}>Add a drill</button>

      <div className="card">
        <h2>Session</h2>
        <SummaryFields state={state} dispatch={dispatch} now={now} />
        {draft.drills.length === 0 && <p className="warning" role="status">Enter a result for at least one drill to save.</p>}
        {error && <p className="error" role="alert">Could not save: {error}</p>}
      </div>

      <div className="row">
        <button type="button" className="btn btn-big btn-primary" disabled={saving || draft.drills.length === 0 || !dateOk} onClick={save}>{saving ? 'Saving' : sessionId ? 'Save changes' : 'Save session'}</button>
        {sessionId && <button type="button" className="btn btn-big btn-danger" onClick={() => setConfirmDelete(true)}>Delete session</button>}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this session?"
          message="The session and all its drill results will be deleted. You will have 8 seconds to undo."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  )
}
