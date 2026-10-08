// Fields shared by the runner and the quick log form: target, settings used, metric input, minutes and note.
import type { Dispatch } from 'react'
import { benchmarkDetail } from '../lib/format'
import type { RunnerAction, RunnerDrill } from '../lib/runnerState'
import { MetricInput } from './MetricInput'

export function TargetLine({ drill }: { drill: RunnerDrill }) {
  if (!drill.target && !drill.templateNote) return null
  return (
    <div className="target">
      {drill.target && <p><strong>Target:</strong> {benchmarkDetail(drill.target)}</p>}
      {drill.templateNote && <p className="muted">Note: {drill.templateNote}</p>}
    </div>
  )
}

export function DrillFields({ drill, index, dispatch, showMinutes }: {
  drill: RunnerDrill
  index: number
  dispatch: Dispatch<RunnerAction>
  /** Quick log shows a minutes box for every drill; the runner takes minutes from the timer. */
  showMinutes?: boolean
}) {
  return (
    <>
      <label className="field">
        <span>Robot settings used</span>
        <input type="text" value={drill.settingsUsed} onChange={(e) => dispatch({ type: 'setSettings', index, text: e.target.value })} />
      </label>
      <MetricInput drill={drill} index={index} dispatch={dispatch} />
      {showMinutes && drill.metricType !== 'duration' && (
        <label className="field">
          <span>Minutes for this drill (optional)</span>
          <input
            type="number" inputMode="numeric" min={0} step={1} value={drill.manualMinutes ?? ''}
            onChange={(e) => dispatch({ type: 'setManualMinutes', index, minutes: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </label>
      )}
      <label className="field">
        <span>Note for this drill (optional)</span>
        <textarea rows={2} value={drill.note} onChange={(e) => dispatch({ type: 'setNote', index, note: e.target.value })} />
      </label>
    </>
  )
}
