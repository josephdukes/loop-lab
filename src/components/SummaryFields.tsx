// The end-of-session form fields: effort, loop confidence, total minutes, notes. Used by the runner and the quick log.
import type { Dispatch } from 'react'
import { effectiveTotalMinutes, recordedCount, type RunnerAction, type RunnerState } from '../lib/runnerState'
import { ScaleButtons } from './ScaleButtons'

export function SummaryFields({ state, dispatch, now }: { state: RunnerState; dispatch: Dispatch<RunnerAction>; now: number }) {
  const s = state.summary
  const recorded = recordedCount(state, now)
  return (
    <>
      <p role="status">
        {recorded} of {state.drills.length} drills have a result{recorded < state.drills.length ? ' (drills without a result are not saved)' : ''}.
      </p>
      <ScaleButtons label="Effort" value={s.effort} onChange={(n) => dispatch({ type: 'setSummary', patch: { effort: n } })} />
      <ScaleButtons label="Loop confidence" value={s.loopConfidence} onChange={(n) => dispatch({ type: 'setSummary', patch: { loopConfidence: n } })} />
      <label className="field">
        <span>Total minutes</span>
        <input
          type="number" inputMode="numeric" min={0} step={1}
          value={effectiveTotalMinutes(state, now)}
          onChange={(e) => dispatch({ type: 'setSummary', patch: { totalMinutes: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) } })}
        />
      </label>
      <label className="field">
        <span>Session notes</span>
        <textarea rows={3} value={s.notes} onChange={(e) => dispatch({ type: 'setSummary', patch: { notes: e.target.value } })} />
      </label>
    </>
  )
}
