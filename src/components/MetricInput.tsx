// The metric input for each of the five metric types (spec 5). Thin: it only dispatches reducer actions.
import { useId, type Dispatch } from 'react'
import { percent } from '../lib/format'
import { timerElapsedSec, type RunnerAction, type RunnerDrill } from '../lib/runnerState'
import { RadioScale } from './ScaleButtons'
import { Stepper } from './Stepper'

export function MetricInput({ drill, index, dispatch }: { drill: RunnerDrill; index: number; dispatch: Dispatch<RunnerAction> }) {
  const hitHelp = useId()
  const adjust = (field: 'hits' | 'attempts' | 'streakCurrent' | 'scoreYou' | 'scoreRobot') => (delta: number) =>
    dispatch({ type: 'adjust', index, field, delta })

  switch (drill.metricType) {
    case 'hits_attempts':
      return (
        <div className="metric">
          <div className="row two">
            <button type="button" className="btn btn-big btn-hit" aria-describedby={hitHelp} onClick={() => dispatch({ type: 'hitMiss', index, result: 'hit' })}>Hit</button>
            <button type="button" className="btn btn-big" aria-describedby={hitHelp} onClick={() => dispatch({ type: 'hitMiss', index, result: 'miss' })}>Miss</button>
          </div>
          <p id={hitHelp} className="sr-only">Hit adds one hit and one attempt. Miss adds one attempt.</p>
          <div className="stack">
            <Stepper label="Hits" value={drill.hits} onChange={adjust('hits')} disablePlus={drill.hits >= drill.attempts} max={drill.attempts} />
            <Stepper label="Attempts" value={drill.attempts} onChange={adjust('attempts')} />
          </div>
          <p className="muted" aria-live="polite">
            {drill.attempts > 0 ? `Success rate ${percent(drill.hits, drill.attempts)}` : 'Success rate: no attempts yet'}
            {drill.plannedAttempts ? ` (planned: ${drill.plannedAttempts} attempts)` : ''}
          </p>
        </div>
      )
    case 'streak':
      return (
        <div className="metric">
          <Stepper label="Current run" value={drill.streakCurrent} onChange={adjust('streakCurrent')} />
          <div className="row">
            <button type="button" className="btn btn-big" onClick={() => dispatch({ type: 'newBest', index })}>New best</button>
          </div>
          <p>Best streak so far: <strong>{drill.streak}</strong></p>
        </div>
      )
    case 'score_vs_robot':
      return (
        <div className="metric">
          <div className="stack">
            <Stepper label="Me" value={drill.scoreYou} onChange={adjust('scoreYou')} />
            <Stepper label="Robot" value={drill.scoreRobot} onChange={adjust('scoreRobot')} />
          </div>
          <p className="muted">Margin {drill.scoreYou - drill.scoreRobot > 0 ? '+' : ''}{drill.scoreYou - drill.scoreRobot}</p>
        </div>
      )
    case 'duration': {
      const fromTimer = Math.round(timerElapsedSec(drill.timer, Date.now()) / 60)
      return (
        <div className="metric">
          <label className="field">
            <span>Minutes (type it, or use the timer above)</span>
            <input
              type="number" inputMode="numeric" min={0} step={1}
              value={drill.manualMinutes ?? ''}
              placeholder={fromTimer > 0 ? String(fromTimer) : '0'}
              onChange={(e) => dispatch({ type: 'setManualMinutes', index, minutes: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
        </div>
      )
    }
    case 'rating':
      return (
        <div className="metric">
          <RadioScale label="Rating 1 to 5" value={drill.rating} onChange={(n) => dispatch({ type: 'setRating', index, rating: n })} />
        </div>
      )
  }
}
