// Session runner: full screen above the tabs (spec 5). State lives in a pure reducer and is autosaved on every change.
import { useEffect, useId, useReducer, useRef, useState } from 'react'
import { useApp } from '../appState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrillFields, TargetLine } from '../components/DrillFields'
import { DrillTimer } from '../components/DrillTimer'
import { ErrorBox, Loading } from '../components/ScreenState'
import { SummaryFields } from '../components/SummaryFields'
import { useWakeLock } from '../hooks/useWakeLock'
import { Autosaver, clearActiveState, loadActiveState } from '../lib/activeSessionStore'
import { recordedCount, runnerReducer, type RunnerState } from '../lib/runnerState'
import { draftFromState, saveSession } from '../lib/sessionService'
import { buildStateFromRun, buildStateFromTemplate } from '../lib/startSession'
import { requestPersistentStorage } from '../lib/storage'
import { nowIso } from '../lib/id'
import { useFocusOnOpen } from '../hooks/useFocusOnOpen'
import { useNav, type RunnerInit } from '../nav'

type Loaded =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; state: RunnerState; restoredAtMs?: number }
  | { kind: 'conflict'; init: RunnerInit }

/** Opens the runner: builds a new session, or restores the saved one. */
export function RunnerScreen({ init }: { init: RunnerInit }) {
  const { db } = useApp()
  const { closeOverlay } = useNav()
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const set = (l: Loaded) => { if (!cancelled) setLoaded(l) }
    ;(async () => {
      const active = await loadActiveState(db)
      if (init.mode === 'resume') {
        if (active.kind === 'ok') return set({ kind: 'ready', state: active.state, restoredAtMs: active.savedAtMs })
        return set({ kind: 'error', message: active.kind === 'corrupt' ? 'The unfinished session could not be read. You can discard it from Home.' : 'There is no unfinished session to resume.' })
      }
      if (active.kind !== 'none' && attempt === 0) return set({ kind: 'conflict', init })
      const state = init.mode === 'run' ? await buildStateFromRun(db, init.runId) : await buildStateFromTemplate(db, init.templateId)
      set({ kind: 'ready', state })
    })().catch((e) => set({ kind: 'error', message: e instanceof Error ? e.message : String(e) }))
    return () => { cancelled = true }
  }, [db, init, attempt])

  if (loaded.kind === 'loading') return <RunnerFrame title="Opening session"><Loading label="Opening session" /></RunnerFrame>
  if (loaded.kind === 'error') {
    return (
      <RunnerFrame title="Session could not be opened">
        <ErrorBox message={loaded.message} />
        <button type="button" className="btn" onClick={() => closeOverlay()}>Back</button>
      </RunnerFrame>
    )
  }
  if (loaded.kind === 'conflict') {
    return (
      <RunnerFrame title="Unfinished session">
        <p>You already have a session in progress. Starting a new one would replace it.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => closeOverlay()}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={async () => { await clearActiveState(db); setAttempt((n) => n + 1) }}>Discard it and start new</button>
        </div>
      </RunnerFrame>
    )
  }
  return <RunnerView initial={loaded.state} restoredAtMs={loaded.restoredAtMs} />
}

/** The runner's full-screen frame for its loading, error and conflict states. */
function RunnerFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useFocusOnOpen(heading)
  return (
    <div className="runner" role="dialog" aria-modal="true" aria-label="Session runner">
      <div className="runner-body">
        <h1 id={titleId} ref={heading} tabIndex={-1}>{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function RunnerView({ initial, restoredAtMs }: { initial: RunnerState; restoredAtMs?: number }) {
  const { db, settings, notifyDataChanged } = useApp()
  const { closeOverlay, setTab } = useNav()
  const [state, dispatch] = useReducer(runnerReducer, initial, (s) => (restoredAtMs ? runnerReducer(s, { type: 'restore', savedAtMs: restoredAtMs }) : s))
  const autosaver = useRef(new Autosaver(db))
  const wake = useWakeLock(true)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useFocusOnOpen(heading)

  // Leaving (the Leave button, the Back button or saving) lets Home reload, so it offers Resume straight away.
  useEffect(() => {
    const saver = autosaver
    return () => { void saver.current.flush().then(notifyDataChanged, notifyDataChanged) }
  }, [notifyDataChanged])

  // Written on EVERY change so a killed app can resume exactly.
  useEffect(() => { void autosaver.current.save(state) }, [state])

  const now = Date.now()
  const total = state.drills.length
  const drill = state.drills[state.currentIndex]
  const title = state.programRunId && state.programWeek
    ? `Week ${state.programWeek}, ${state.sessionLabel ?? 'Session'}`
    : state.templateName ?? 'Session'

  async function discard() {
    await autosaver.current.close()
    await clearActiveState(db)
    notifyDataChanged()
    closeOverlay()
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      await autosaver.current.close()
      const endedAt = nowIso()
      const draft = draftFromState(state, { now: Date.now(), startedAt: state.startedAt, endedAt })
      await saveSession(db, draft, { onFirstSave: requestPersistentStorage })
      notifyDataChanged()
      setTab('home')
    } catch (e) {
      autosaver.current = new Autosaver(db)
      void autosaver.current.save(state)
      setSaveError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const wakeNotice =
    wake === 'unsupported' ? 'Keep-awake is not supported here: the screen may turn off. Change your phone screen timeout if needed.'
    : wake === 'denied' ? 'The phone refused to keep the screen awake: it may turn off between drills.'
    : null

  return (
    <div
      className="runner" role="dialog" aria-modal="true" aria-label="Session runner"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); closeOverlay() } }}
    >
      <header className="runner-head">
        <div className="runner-heading">
          <h1 className="runner-title" id={titleId} ref={heading} tabIndex={-1}>{title}</h1>
          <p className="muted">{state.phase === 'summary' ? 'Summary' : `Drill ${state.currentIndex + 1} of ${total}`}</p>
        </div>
        <ol className="dots" aria-label="Drills">
          {state.drills.map((d, i) => (
            <li key={d.key} className={`dot ${i === state.currentIndex && state.phase === 'drills' ? 'dot-current' : ''} ${d.skipped ? 'dot-skipped' : ''}`} aria-current={i === state.currentIndex && state.phase === 'drills' ? 'step' : undefined}>
              <span className="sr-only">{`Drill ${i + 1}: ${d.name}${d.skipped ? ' (skipped)' : ''}`}</span>
            </li>
          ))}
        </ol>
        <div className="row runner-actions">
          <button type="button" className="btn" onClick={() => closeOverlay()}>Leave</button>
          <button type="button" className="btn" onClick={() => setConfirmDiscard(true)}>Discard</button>
        </div>
      </header>
      {wakeNotice && <p className="notice" role="status">{wakeNotice}</p>}

      <div className="runner-body">
        {state.phase === 'drills' && drill && (
          <section className="card" key={drill.key} aria-label={`Drill ${state.currentIndex + 1}: ${drill.name}`}>
            <div className="runner-cols">
              <div className="runner-info">
                <h2>{drill.name}</h2>
                <p className="muted">{drill.category}</p>
                {drill.description && <p>{drill.description}</p>}
                {drill.suggestedSettings && <p><strong>Suggested settings:</strong> {drill.suggestedSettings}</p>}
                {drill.cues && <p><strong>Cues:</strong> {drill.cues}</p>}
                <TargetLine drill={drill} />
                <DrillTimer timer={drill.timer} index={state.currentIndex} dispatch={dispatch} sound={settings.timerSound} vibrate={settings.timerVibrate} />
              </div>
              <div className="runner-inputs">
                <DrillFields drill={drill} index={state.currentIndex} dispatch={dispatch} />
              </div>
            </div>
            {drill.skipped && <p className="muted" role="status">Skipped. Entering a result un-skips it.</p>}
          </section>
        )}

        {state.phase === 'summary' && (
          <section className="card" aria-label="Session summary">
            <h2>Finish session</h2>
            <SummaryFields state={state} dispatch={dispatch} now={now} />
            {recordedCount(state, now) === 0 && <p className="warning" role="alert">No drill has a result yet, so there is nothing to save. Go back and enter a result, or discard the session.</p>}
            {saveError && <p className="error" role="alert">Could not save: {saveError}</p>}
          </section>
        )}
      </div>

      <footer className="runner-foot">
        {state.phase === 'drills' ? (
          <>
            <button type="button" className="btn btn-big" disabled={state.currentIndex === 0} onClick={() => dispatch({ type: 'previous', now: Date.now() })}>Previous</button>
            <button type="button" className="btn btn-big" onClick={() => dispatch({ type: 'skip', now: Date.now() })}>Skip</button>
            <button type="button" className="btn btn-big btn-primary" onClick={() => dispatch({ type: 'next', now: Date.now() })}>{state.currentIndex === total - 1 ? 'Finish' : 'Next'}</button>
            <button type="button" className="btn link-btn" onClick={() => dispatch({ type: 'goTo', index: total, now: Date.now() })}>Finish early</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-big" style={{ gridColumn: 'span 1' }} onClick={() => dispatch({ type: 'backToDrills' })}>Back to drills</button>
            <button type="button" className="btn btn-big btn-primary" style={{ gridColumn: 'span 2' }} disabled={saving || recordedCount(state, now) === 0} onClick={save}>{saving ? 'Saving' : 'Save session'}</button>
          </>
        )}
      </footer>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this session?"
          message="Everything entered in this session will be lost. This cannot be undone."
          confirmLabel="Discard session"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setConfirmDiscard(false); void discard() }}
        />
      )}
    </div>
  )
}
