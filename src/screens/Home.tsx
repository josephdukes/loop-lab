import { useState } from 'react'
import { useApp } from '../appState'
import { BenchmarkBadge } from '../components/BenchmarkBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import { clearActiveState } from '../lib/activeSessionStore'
import { todayLocal } from '../lib/dates'
import { benchmarkDetail } from '../lib/format'
import { loadHome, type HomeData } from '../lib/homeData'
import type { RunView } from '../lib/runView'
import { useNav } from '../nav'
import { SessionList } from './Sessions'
import { P2CheckCard } from './P2CheckCard'
import { hasBlockReview } from '../lib/blockReview'
import { BackupBanner } from '../components/BackupBanner'

export function badgeText(b: RunView['badge']): string {
  if (b.state === 'on_track') return 'On track'
  return `${b.state === 'ahead' ? 'Ahead' : 'Behind'} by ${b.by} ${b.by === 1 ? 'session' : 'sessions'}`
}

export function Home() {
  const { db, settings } = useApp()
  const state = useAsync(() => loadHome(db, todayLocal(), settings.weeklyTarget), [db, settings.weeklyTarget])
  const { openOverlay } = useNav()
  return (
    <section aria-labelledby="home-h">
      <div className="screen-head">
        <h1 id="home-h">Home</h1>
        <button type="button" className="btn" onClick={() => openOverlay({ kind: 'settings' })}>Settings</button>
      </div>
      <AsyncView state={state}>{(data) => <HomeBody data={data} />}</AsyncView>
      <BuiltInCounts />
    </section>
  )
}

function HomeBody({ data }: { data: HomeData }) {
  const { db, settings, notifyDataChanged } = useApp()
  const { openOverlay, openTrain } = useNav()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const run = data.runView

  return (
    <>
      {data.hasActiveSession && (
        <div className="card banner" role="region" aria-label="Unfinished session">
          <h2>You have an unfinished session</h2>
          <p className="muted">It was saved as you went, so you can pick up exactly where you stopped.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => openOverlay({ kind: 'runner', init: { mode: 'resume' } })}>Resume</button>
            <button type="button" className="btn" onClick={() => setConfirmDiscard(true)}>Discard</button>
          </div>
        </div>
      )}

      <BackupBanner />

      <div className="card" aria-live="polite">
        <h2>This week</h2>
        <p className="big-num">{data.robotThisWeek} <span className="muted">of {settings.weeklyTarget}</span></p>
        <p>{data.robotThisWeek} of {settings.weeklyTarget} robot sessions this week</p>
        <p>Current streak: <strong>{data.streak.current}</strong> {data.streak.current === 1 ? 'week' : 'weeks'} <span className="muted">(longest {data.streak.longest})</span></p>
        <p className="muted">Club sessions this week: {data.clubThisWeek}</p>
      </div>

      {data.behindText && (
        <div className="card banner" role="region" aria-label="Behind on weekly target">
          <p><strong>{data.behindText}</strong></p>
        </div>
      )}

      {run ? <NextUp run={run} /> : (
        <div className="card">
          <h2>No program running</h2>
          <p className="muted">Start a program to get a suggested next session, or pick anything you like.</p>
          <div className="stack">
            <button type="button" className="btn btn-big btn-primary" onClick={() => openTrain('programs')}>Start a program</button>
            <button type="button" className="btn btn-big" onClick={() => openTrain('sessions')}>Start a session</button>
            <button type="button" className="btn btn-big" onClick={() => openOverlay({ kind: 'quicklog' })}>Quick log</button>
          </div>
        </div>
      )}

      {run?.ready && (
        <div className="card banner-ok" role="region" aria-label="Ready to move on">
          <h2>Benchmarks hit: ready to move on?</h2>
          <p className="muted">This is a suggestion only. You can stay on this week as long as you like.</p>
          <ul className="plain">
            {run.weekEntries.map((e) => (
              <li key={e.drill.id + e.benchmark.threshold}>{e.drill.name}: {benchmarkDetail(e.benchmark)} <BenchmarkBadge status={e.board.status} /></li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={() => openTrain('programs', { programId: run.program.id })}>Open program</button>
        </div>
      )}
      {run?.repeatPhase && (
        <div className="card banner" role="region" aria-label="Consider repeating this phase">
          <h2>Consider repeating this phase before moving on</h2>
          <p>
            {run.repeatPhase.phase.title} (weeks {run.repeatPhase.phase.startWeek} to {run.repeatPhase.phase.endWeek}) has run its full {run.repeatPhase.phase.endWeek - run.repeatPhase.phase.startWeek + 1} weeks
            without every benchmark met. Later phases assume this one is solid. This is a suggestion only.
          </p>
          <ul className="plain">
            {run.repeatPhase.entries.map((e) => (
              <li key={e.drill.id + e.benchmark.threshold}>{e.drill.name}: {benchmarkDetail(e.benchmark)} <BenchmarkBadge status={e.board.status} /></li>
            ))}
          </ul>
          <p className="muted">To repeat it, open the program and use Set position.</p>
          <button type="button" className="btn" onClick={() => openTrain('programs', { programId: run.program.id })}>Open program</button>
        </div>
      )}

      {run && hasBlockReview(run.program) && !run.position.finished && run.position.week === (run.program.cycleLengthWeeks ?? run.program.weeks.length) && (
        <div className="card banner-ok" role="region" aria-label="Block Review">
          <h2>Last week of this block</h2>
          <p className="muted">When this week's sessions are done, open Block Review to compare this block with the last one.</p>
          <button type="button" className="btn" onClick={() => openOverlay({ kind: 'blockReview', runId: run.run.id })}>Open Block Review</button>
        </div>
      )}
      <P2CheckCard variant="home" />

      <div className="row two">
        <button type="button" className="btn btn-big" onClick={() => openOverlay({ kind: 'quicklog' })}>Quick log</button>
        <button type="button" className="btn btn-big" onClick={() => openOverlay({ kind: 'matchForm' })}>Log a match</button>
      </div>

      <h2 className="section-h">Recent sessions</h2>
      {data.recent.length === 0 ? (
        <EmptyState title="No sessions logged yet">Run a session or use Quick log. Your last five sessions will show here.</EmptyState>
      ) : (
        <>
          <SessionList rows={data.recent} />
          <button type="button" className="btn" onClick={() => openOverlay({ kind: 'allSessions' })}>All sessions</button>
        </>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard the unfinished session?"
          message="Everything entered in it will be lost. This cannot be undone."
          confirmLabel="Discard session"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={async () => { setConfirmDiscard(false); await clearActiveState(db); notifyDataChanged() }}
        />
      )}
    </>
  )
}

function NextUp({ run }: { run: RunView }) {
  const { openOverlay, openTrain } = useNav()
  const week = run.program.weeks.find((w) => w.weekNumber === run.position.week)
  const phase = week && !/^Week \d+$/.test(week.title) ? ` (${week.title})` : ''
  return (
    <div className="card next-up" role="region" aria-label="Next up">
      <p className="muted">Next up / {run.program.name}{run.program.repeating ? `, cycle ${run.position.cycleNumber}` : ''}</p>
      {run.position.finished || !run.nextUp ? (
        <>
          <h2>{run.position.finished ? 'Program finished' : 'Next session unavailable'}</h2>
          <p className="muted">{run.position.finished ? 'You have done every session. Use Set position in the program to go back, or start another program.' : 'The session template for this slot is missing.'}</p>
          <button type="button" className="btn btn-big" onClick={() => openTrain('programs', { programId: run.program.id })}>Open program</button>
        </>
      ) : (
        <>
          <h2>Week {run.position.week}, {run.nextUp.label}{phase}</h2>
          <p className="muted">{badgeText(run.badge)} / {run.completed} sessions done</p>
          <p>{run.nextUp.templateName}: {run.nextUp.totalMinutes} min</p>
          <ul className="plain">
            {run.nextUp.items.map((it) => (
              <li key={it.drill.id}>{it.drill.name}{it.durationMin ? ` (${it.durationMin} min)` : ''}{it.benchmark ? `: ${benchmarkDetail(it.benchmark)}` : ''}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-big btn-primary" onClick={() => openOverlay({ kind: 'runner', init: { mode: 'run', runId: run.run.id } })}>Start session</button>
        </>
      )}
    </div>
  )
}

function BuiltInCounts() {
  const { counts } = useApp()
  return (
    <details className="card">
      <summary>Built-in content loaded</summary>
      <dl className="counts">
        <div><dt>Categories</dt><dd data-testid="count-categories">{counts.categories}</dd></div>
        <div><dt>Drills</dt><dd data-testid="count-drills">{counts.drills}</dd></div>
        <div><dt>Session templates</dt><dd data-testid="count-templates">{counts.templates}</dd></div>
        <div><dt>Programs</dt><dd data-testid="count-programs">{counts.programs}</dd></div>
      </dl>
    </details>
  )
}
