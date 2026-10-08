// The Pressure Loop end-of-week-2 check, assembled from data (spec A.4 P2).
import { useApp } from '../appState'
import { useAsync } from '../hooks/useAsync'
import { todayLocal } from '../lib/dates'
import { loadP2Check, showP2OnHome, type P2CheckData } from '../lib/p2Check'
import { useNav } from '../nav'

export function P2CheckCard({ variant }: { variant: 'home' | 'program' }) {
  const { db } = useApp()
  const state = useAsync(() => loadP2Check(db), [db])
  if (state.status !== 'ready') return null
  const data = state.data
  if (variant === 'home') return showP2OnHome(data, todayLocal()) ? <Card data={data as P2CheckData} home /> : null
  if (!data) return <div className="card"><h3>End-of-week-2 check</h3><p className="muted">Start this program and finish its second week. The check appears here, built from your sessions and matches.</p></div>
  if (!data.reached) return <div className="card"><h3>End-of-week-2 check</h3><p className="muted">Shown here once you have completed the second week of this run.</p></div>
  return <Card data={data} />
}

function Card({ data, home }: { data: P2CheckData; home?: boolean }) {
  const { openTrain, setTab, openOverlay } = useNav()
  const c = data.check
  return (
    <div className="card banner-ok" role="region" aria-label="Pressure Loop end-of-week-2 check">
      <h2>Pressure Loop: end-of-week-2 check</h2>
      <p className="muted">A few league matches is a small sample, so judge the work on loop attempts and confidence, not early results.</p>
      <dl className="counts">
        <div><dt>Best pressure streak</dt><dd>{c.bestStreak ?? 'None yet'}</dd></div>
        <div><dt>Loop attempts in matches</dt><dd>{c.loopAttempts}</dd></div>
        <div>
          <dt>Latest confidence</dt>
          <dd>{c.confidence ? `${c.confidence.value} of 5` : 'None yet'}</dd>
        </div>
        <div><dt>Matches since the run started</dt><dd>{c.matchesSinceStart}</dd></div>
      </dl>
      <p className="muted">
        {c.confidence ? (c.confidence.source === 'match' ? 'Confidence is from your latest match.' : 'No match logged since the run started, so confidence is from your latest session loop confidence.') : 'Log a match or a session loop confidence to fill in confidence.'}
      </p>
      <div className="row">
        {home && <button type="button" className="btn" onClick={() => openTrain('programs', { programId: data.run.programId })}>Open program</button>}
        <button type="button" className="btn" onClick={() => openOverlay({ kind: 'matchForm' })}>Log a match</button>
        {!home && <button type="button" className="btn" onClick={() => setTab('matches')}>Open Matches</button>}
      </div>
    </div>
  )
}
