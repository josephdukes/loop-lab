// Progress tab (spec 5): weekly bars with target and rest weeks, minutes, streaks, per-drill trend,
// benchmark board, category mix, loop-confidence trend, range filter.
import { useMemo, useState } from 'react'
import { useApp } from '../appState'
import { BenchmarkBadge } from '../components/BenchmarkBadge'
import { CategoryMixChart } from '../components/charts/CategoryMixChart'
import { TrendChart } from '../components/charts/TrendChart'
import { WeekBarsChart } from '../components/charts/WeekBarsChart'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import { categorySummary, confidenceSummary, formatChartValue, minutesSummary, sessionsSummary, trendSummary } from '../lib/chartText'
import { dayMonth, formatValue, oneDecimal, shortDate } from '../lib/format'
import { toDayNumber, todayLocal, weekStartOf } from '../lib/dates'
import {
  buildBoard, buildWeekBars, confidenceByWeek, drillSeries, groupRowsByDrill, RANGES, sortRows, timeByCategory, weeksForRange, yDomain, type RangeId,
} from '../lib/progressData'
import { loadProgressRaw, type ProgressRaw } from '../lib/progressService'
import { bucketByWeek } from '../lib/sessionCounting'
import { computeStreaks } from '../lib/streak'
import { setRestWeek } from '../lib/weekFlags'
import { useNav } from '../nav'

export function Progress() {
  const { db } = useApp()
  const state = useAsync(() => loadProgressRaw(db), [db])
  return (
    <section aria-labelledby="progress-h">
      <h1 id="progress-h">Progress</h1>
      <AsyncView state={state}>{(raw) => <ProgressBody raw={raw} />}</AsyncView>
    </section>
  )
}

function ProgressBody({ raw }: { raw: ProgressRaw }) {
  const { settings } = useApp()
  const { openOverlay } = useNav()
  const [range, setRange] = useState<RangeId>('12')
  const today = todayLocal()
  const target = settings.weeklyTarget

  const model = useMemo(() => {
    const firstDate = raw.sessions.map((s) => s.date).sort()[0]
    const weeks = weeksForRange(range, firstDate, today)
    const bars = buildWeekBars(raw.sessions, raw.restWeeks, target, weeks)
    const weekly = bucketByWeek(raw.sessions.map((s) => ({ id: s.id, date: s.date, kind: s.kind, drillLogCount: s.drillCount })))
    const streak = computeStreaks({ robotByWeek: new Map([...weekly].map(([k, v]) => [k, v.robot])), restWeeks: raw.restWeeks, target, today })
    return { weeks, bars, streak, from: weeks[0] }
  }, [raw, range, today, target])

  if (raw.sessions.length === 0) {
    return (
      <EmptyState title="No sessions logged yet">
        Weekly bars, streaks, benchmark progress and trends appear here once you have logged a session.
        <span className="stack">
          <button type="button" className="btn btn-primary" onClick={() => openOverlay({ kind: 'quicklog' })}>Quick log a session</button>
        </span>
      </EmptyState>
    )
  }

  return (
    <>
      <div className="range-row" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.id} type="button" className="btn" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>

      <div className="card" aria-live="polite">
        <h2>Streak</h2>
        <p className="big-num">{model.streak.current} <span className="muted">{model.streak.current === 1 ? 'week' : 'weeks'}</span></p>
        <p className="muted">Current streak of weeks with {target} or more robot sessions. Longest ever: {model.streak.longest} {model.streak.longest === 1 ? 'week' : 'weeks'}. Rest weeks neither break nor add to it.</p>
      </div>

      <WeeklySection model={model} target={target} today={today} />

      <TrendSection raw={raw} from={model.from} />
      <BoardSection raw={raw} />
      <MixSection raw={raw} from={model.from} />
      <ConfidenceSection raw={raw} weeks={model.weeks} />
    </>
  )
}

// --- weekly bars, minutes, rest-week menu -----------------------------------------------------------

function WeeklySection({ model, target, today }: { model: { bars: ReturnType<typeof buildWeekBars>; weeks: string[] }; target: number; today: string }) {
  const { db, notifyDataChanged } = useApp()
  const [picked, setPicked] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = weekStartOf(today)
  const selected = picked && model.weeks.includes(picked) ? picked : current
  const bar = model.bars.find((b) => b.weekStart === selected)

  async function toggle() {
    if (!bar) return
    setError(null)
    try {
      await setRestWeek(db, bar.weekStart, !bar.isRest, today)
      setMessage(bar.isRest ? `Week of ${dayMonth(bar.weekStart)} is a normal week again.` : `Week of ${dayMonth(bar.weekStart)} marked as a rest week.`)
      notifyDataChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="card">
      <h2>Weekly training</h2>
      <WeekBarsChart
        title="Robot sessions per week" unit="robot sessions" target={target} selected={selected} onSelect={(w) => { setPicked(w); setMessage(null) }}
        bars={model.bars.map((b) => ({ weekStart: b.weekStart, value: b.robot, isRest: b.isRest }))}
        summary={sessionsSummary(model.bars, target)}
      />
      <p className="chart-key">Hatched column: rest week. Tap a column, or use the week picker below, to choose a week.</p>
      <div className="card week-menu" role="group" aria-label="Rest week menu">
        <label className="field">
          <span>Selected week (Monday to Sunday)</span>
          <select value={selected} onChange={(e) => { setPicked(e.target.value); setMessage(null) }}>
            {model.weeks.map((w) => <option key={w} value={w}>Week of {shortDate(w)}{w === current ? ' (this week)' : ''}</option>)}
          </select>
        </label>
        {bar && (
          <>
            <p>
              {bar.robot} robot {bar.robot === 1 ? 'session' : 'sessions'}, {bar.minutes} minutes
              {bar.isRest ? ', marked as a rest week.' : bar.metTarget ? ', target reached.' : ', below target.'}
            </p>
            <button type="button" className="btn btn-big" aria-label={`${bar.isRest ? 'Remove rest week' : 'Mark as rest week'}: week of ${dayMonth(bar.weekStart)}`} onClick={toggle}>
              {bar.isRest ? 'Remove rest week' : 'Mark as rest week'}
            </button>
            <p className="muted">Illness, holiday, away: a rest week neither breaks nor extends your streak.</p>
          </>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </div>

      <WeekBarsChart
        title="Training minutes per week" unit="minutes"
        bars={model.bars.map((b) => ({ weekStart: b.weekStart, value: b.minutes, isRest: b.isRest }))}
        summary={minutesSummary(model.bars)}
      />
    </div>
  )
}

// --- per-drill trend --------------------------------------------------------------------------------

function TrendSection({ raw, from }: { raw: ProgressRaw; from: string }) {
  const byDrill = useMemo(() => groupRowsByDrill(raw.rows), [raw])
  const options = useMemo(() => {
    const withLogs = raw.drills.filter((d) => byDrill.has(d.id))
    const latest = (id: string) => sortRows(byDrill.get(id) ?? []).slice(-1)[0]
    return withLogs.sort((a, b) => (latest(b.id).date + latest(b.id).at).localeCompare(latest(a.id).date + latest(a.id).at))
  }, [raw, byDrill])
  const [picked, setPicked] = useState<string>('')
  const drill = options.find((d) => d.id === picked) ?? options[0]

  const view = useMemo(() => {
    if (!drill) return null
    const series = drillSeries(sortRows(byDrill.get(drill.id) ?? []), drill, from)
    const dom = yDomain(series.unit, series.points.map((p) => p.value), series.benchmarkLine)
    return { series, dom }
  }, [drill, byDrill, from])

  return (
    <div className="card">
      <h2>Drill trend</h2>
      {!drill || !view ? (
        <EmptyState title="No drill results yet">Log a session and pick a drill here to see how it is trending against its benchmark.</EmptyState>
      ) : (
        <>
          <label className="field">
            <span>Drill</span>
            <select value={drill.id} onChange={(e) => setPicked(e.target.value)}>
              {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {view.series.points.length === 0 ? (
            <EmptyState title="No results for this drill in this range">Choose a longer range, or another drill.</EmptyState>
          ) : (
            <TrendChart
              title={`${drill.name}: ${drill.metricType === 'hits_attempts' ? 'success rate' : drill.metricType === 'score_vs_robot' ? 'margin' : drill.metricType === 'streak' ? 'best streak' : drill.metricType === 'duration' ? 'minutes' : 'rating'}`}
              summary={trendSummary(drill.name, drill.metricType, view.series)}
              points={view.series.points.map((p) => ({ x: toDayNumber(p.date), label: dayMonth(p.date), y: p.value, met: p.met }))}
              domain={view.dom}
              line={view.series.benchmarkLine !== undefined ? { value: view.series.benchmarkLine, label: `Benchmark ${formatChartValue(drill.metricType, view.series.benchmarkLine)}` } : undefined}
              formatY={(n) => (drill.metricType === 'hits_attempts' ? `${n}%` : String(n))}
              formatEnd={(n) => formatChartValue(drill.metricType, n)}
            />
          )}
        </>
      )}
    </div>
  )
}

// --- benchmark board --------------------------------------------------------------------------------

function BoardSection({ raw }: { raw: ProgressRaw }) {
  const rows = useMemo(() => buildBoard(raw.drills, groupRowsByDrill(raw.rows)), [raw])
  return (
    <div className="card">
      <h2>Benchmark board</h2>
      {rows.length === 0 ? (
        <EmptyState title="No benchmarks yet">Add a benchmark to a drill in Train and it will appear here.</EmptyState>
      ) : (
        <>
          <p className="muted">Based on all your results, whatever range is chosen. A benchmark is a goal, never a lock.</p>
          <ul className="list" aria-label="Benchmark board">
            {rows.map((r) => (
              <li key={r.drill.id} className="card">
                <h3>{r.drill.name}</h3>
                <p className="muted">{r.benchmark.description || r.drill.category}{r.needed > 1 ? ` (${r.needed} sessions in a row)` : ''}</p>
                <p><BenchmarkBadge status={r.status} /></p>
                {r.latest === undefined
                  ? <p className="muted">No counting results yet.</p>
                  : <p>Latest <strong>{formatValue(r.drill.metricType, r.latest)}</strong>, best <strong>{formatValue(r.drill.metricType, r.best as number)}</strong>{r.needed > 1 ? `, ${r.judged} of ${r.needed} judged` : ''}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// --- category mix and confidence ----------------------------------------------------------------------

function MixSection({ raw, from }: { raw: ProgressRaw; from: string }) {
  const mix = useMemo(() => timeByCategory(raw.rows, from), [raw, from])
  return (
    <div className="card">
      <h2>Time by category</h2>
      {mix.items.length === 0 ? (
        <EmptyState title="No drill minutes in this range">Minutes come from the time you record on each drill.</EmptyState>
      ) : (
        <CategoryMixChart title="Drill minutes by category" items={mix.items} summary={categorySummary(mix)} />
      )}
    </div>
  )
}

function ConfidenceSection({ raw, weeks }: { raw: ProgressRaw; weeks: string[] }) {
  const conf = useMemo(() => confidenceByWeek(raw.sessions, weeks), [raw, weeks])
  const pts = conf.map((c, i) => ({ c, i })).filter((x) => x.c.average !== null)
  return (
    <div className="card">
      <h2>Loop confidence</h2>
      {pts.length === 0 ? (
        <EmptyState title="No loop confidence ratings in this range">Rate your loop confidence 1 to 5 when you save a session.</EmptyState>
      ) : (
        <TrendChart
          title="Average loop confidence per week"
          summary={confidenceSummary(conf)}
          points={pts.map(({ c, i }) => ({ x: i, label: dayMonth(c.weekStart), y: Math.round((c.average as number) * 10) / 10 }))}
          domain={yDomain('rating', [])}
          formatY={(n) => String(n)}
          formatEnd={(n) => oneDecimal(n)}
        />
      )}
      <p className="chart-summary">Weeks with no rating are skipped. Latest week: {pts.length ? oneDecimal(pts[pts.length - 1].c.average as number) : 'none'}.</p>
    </div>
  )
}

