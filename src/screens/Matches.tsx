// Matches tab (spec 5): list newest first, stats card, add or edit, Block Review entry point.
import { useMemo } from 'react'
import { useApp } from '../appState'
import { TrendChart } from '../components/charts/TrendChart'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import { matchConfidenceSummary } from '../lib/chartText'
import { dayMonth, oneDecimal, shortDate } from '../lib/format'
import { findReviewableRun } from '../lib/blockReview'
import { chronologicalMatches, matchStats, type MatchStats } from '../lib/matchStats'
import type { MatchLog } from '../db/types'
import { useNav } from '../nav'

export function Matches() {
  const { db } = useApp()
  const { openOverlay } = useNav()
  const state = useAsync(async () => ({ matches: await db.matchLogs.toArray(), reviewRunId: (await findReviewableRun(db))?.id }), [db])
  return (
    <section aria-labelledby="matches-h">
      <h1 id="matches-h">Matches</h1>
      <div className="row mb">
        <button type="button" className="btn btn-big btn-primary" onClick={() => openOverlay({ kind: 'matchForm' })}>Log a match</button>
      </div>
      <AsyncView state={state}>
        {({ matches, reviewRunId }) => (
          <>
            {matches.length === 0 ? (
              <EmptyState title="No matches logged yet">After a match, log the result, your loops and where the push-to-attack decision broke down. Stats appear here.</EmptyState>
            ) : (
              <>
                <StatsCard matches={matches} />
                <MatchList matches={matches} />
              </>
            )}
            <div className="card">
              <h2>Block Review</h2>
              <p className="muted">Compare your latest block of training with the one before, then note what to emphasise next.</p>
              <button type="button" className="btn" onClick={() => openOverlay({ kind: 'blockReview', runId: reviewRunId })}>Open Block Review</button>
            </div>
          </>
        )}
      </AsyncView>
    </section>
  )
}

function StatsCard({ matches }: { matches: MatchLog[] }) {
  const stats: MatchStats = useMemo(() => matchStats(matches), [matches])
  const loopsText = stats.loops.percent === null
    ? 'No loop numbers recorded yet'
    : `${stats.loops.landed} landed of ${stats.loops.attempted} attempted in ${stats.loops.matchesWithLoops} ${stats.loops.matchesWithLoops === 1 ? 'match' : 'matches'}`
  return (
    <div className="card" aria-label="Match stats">
      <h2>Stats</h2>
      <dl className="counts">
        <div><dt>Loops landed</dt><dd>{stats.loops.percent === null ? 'n/a' : `${stats.loops.percent.toFixed(1)}%`}</dd></div>
        <div><dt>Record</dt><dd>{stats.wins} W, {stats.losses} L</dd></div>
      </dl>
      <p className="muted">{loopsText}. Average confidence {stats.averageConfidence === null ? 'n/a' : `${oneDecimal(stats.averageConfidence)} of 5`}.</p>

      {stats.confidenceTrend.length === 0 ? null : (
        <TrendChart
          title="Match confidence"
          summary={matchConfidenceSummary(stats.confidenceTrend)}
          points={stats.confidenceTrend.map((c, i) => ({ x: i, label: dayMonth(c.date), y: c.confidence }))}
          domain={{ min: 1, max: 5, ticks: [1, 2, 3, 4, 5] }}
          formatY={(n) => String(n)}
        />
      )}

      <h3>Results by opponent style</h3>
      <table className="stat-table">
        <thead><tr><th scope="col">Style</th><th scope="col" className="n">Won</th><th scope="col" className="n">Lost</th></tr></thead>
        <tbody>
          {stats.byStyle.map((s) => (
            <tr key={s.style}><th scope="row">{s.style[0].toUpperCase() + s.style.slice(1)}</th><td className="n">{s.wins}</td><td className="n">{s.losses}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchList({ matches }: { matches: MatchLog[] }) {
  const { openOverlay } = useNav()
  const newestFirst = useMemo(() => chronologicalMatches(matches).reverse(), [matches])
  return (
    <>
      <h2 className="section-h">All matches</h2>
      <ul className="list" aria-label="Matches, newest first">
        {newestFirst.map((m) => (
          <li key={m.id}>
            <button type="button" className="list-item" onClick={() => openOverlay({ kind: 'matchForm', matchId: m.id })}>
              <span className="list-title">
                {shortDate(m.date)}: {m.result === 'W' ? 'Won' : 'Lost'}{m.gamesScore ? ` ${m.gamesScore}` : ''}{m.opponent ? ` vs ${m.opponent}` : ''}
              </span>
              <span className="muted">
                {m.competition[0].toUpperCase() + m.competition.slice(1)} / {m.opponentStyle} / confidence {m.confidence}
                {m.loopsAttempted !== undefined ? ` / ${m.loopsLanded ?? 0} of ${m.loopsAttempted} loops landed` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
