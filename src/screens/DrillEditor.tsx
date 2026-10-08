// Drill editor (spec 5, Builders): name, category, description, metric, defaults, settings, cues, optional benchmark.
import { useEffect, useState } from 'react'
import { useApp } from '../appState'
import { EditorShell, FormErrors, parseNumber } from '../components/EditorShell'
import { ErrorBox, Loading } from '../components/ScreenState'
import { CATEGORIES } from '../content/builtinContent'
import type { Benchmark, Drill, MetricType } from '../db/types'
import { METRIC_LABEL } from '../lib/format'
import { autoBenchmarkDescription, blankDrill, METRIC_TYPES } from '../lib/libraryRules'
import { saveItem } from '../lib/libraryService'
import { newId, nowIso } from '../lib/id'
import { ValidationError } from '../lib/validation'
import { useNav, useUnsavedGuard } from '../nav'


interface Form {
  name: string
  category: string
  description: string
  metricType: MetricType
  attempts: string
  minutes: string
  settings: string
  cues: string
  hasBenchmark: boolean
  threshold: string
  minAttempts: string
  consecutive: string
  benchDescription: string
}

const THRESHOLD_LABEL: Record<MetricType, string> = {
  hits_attempts: 'Benchmark: success rate to reach (percent, for example 80)',
  streak: 'Benchmark: streak to reach',
  score_vs_robot: 'Benchmark: winning margin to reach (your points minus the robot\'s)',
  duration: 'Benchmark: minutes to reach',
  rating: 'Benchmark: rating to reach (1 to 5)',
}

function toForm(d: Drill): Form {
  const b = d.benchmark
  return {
    name: d.name, category: d.category, description: d.description, metricType: d.metricType,
    attempts: d.defaultAttempts?.toString() ?? '', minutes: d.defaultDurationMin?.toString() ?? '',
    settings: d.suggestedSettings, cues: d.cues,
    hasBenchmark: !!b,
    threshold: b ? String(b.metricType === 'hits_attempts' ? Math.round(b.threshold * 1000) / 10 : b.threshold) : '',
    minAttempts: b?.minAttempts?.toString() ?? '', consecutive: String(b?.consecutiveSessions ?? 1), benchDescription: b?.description ?? '',
  }
}

export function formToDrill(base: Drill, f: Form): Drill {
  let benchmark: Benchmark | undefined
  if (f.hasBenchmark) {
    const raw = parseNumber(f.threshold)
    const b: Benchmark = {
      metricType: f.metricType,
      threshold: raw === undefined ? NaN : f.metricType === 'hits_attempts' ? raw / 100 : raw,
      ...(f.metricType === 'hits_attempts' && parseNumber(f.minAttempts) !== undefined ? { minAttempts: parseNumber(f.minAttempts) } : {}),
      consecutiveSessions: parseNumber(f.consecutive) ?? NaN,
      description: f.benchDescription.trim(),
    }
    if (!b.description && Number.isFinite(b.threshold)) b.description = autoBenchmarkDescription(b)
    benchmark = b
  }
  const { benchmark: _old, defaultAttempts: _a, defaultDurationMin: _m, ...rest } = base
  void _old; void _a; void _m
  return {
    ...rest,
    name: f.name.trim(), category: f.category, description: f.description.trim(), metricType: f.metricType,
    suggestedSettings: f.settings.trim(), cues: f.cues.trim(),
    ...(f.metricType === 'hits_attempts' && parseNumber(f.attempts) !== undefined ? { defaultAttempts: parseNumber(f.attempts) } : {}),
    ...(parseNumber(f.minutes) !== undefined ? { defaultDurationMin: parseNumber(f.minutes) } : {}),
    ...(benchmark ? { benchmark } : {}),
  }
}

export function DrillEditorScreen({ drillId }: { drillId?: string }) {
  const { db } = useApp()
  const [base, setBase] = useState<Drill | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!drillId) { setBase(blankDrill(nowIso(), newId())); return }
    db.drills.get(drillId).then((d) => (d ? setBase(d) : setError('This drill no longer exists.')), (e) => setError(String(e)))
  }, [db, drillId])

  return (
    <EditorShell title={drillId ? 'Edit drill' : 'New drill'}>
      {error && <ErrorBox message={error} />}
      {!base && !error && <Loading />}
      {base && <DrillForm base={base} isNew={!drillId} />}
    </EditorShell>
  )
}

function DrillForm({ base, isNew }: { base: Drill; isNew: boolean }) {
  const { db, notifyDataChanged } = useApp()
  const { closeOverlay, requestClose } = useNav()
  const [f, setF] = useState<Form>(() => toForm(base))
  const [initialJson] = useState(() => JSON.stringify(toForm(base)))
  useUnsavedGuard(JSON.stringify(f) !== initialJson)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  async function save() {
    setSaving(true)
    setErrors([])
    try {
      await saveItem(db, 'drill', formToDrill(base, f))
      notifyDataChanged()
      closeOverlay()
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.errors : [e instanceof Error ? e.message : String(e)])
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
      {base.isBuiltIn && <p className="muted">This is a built-in drill. Your changes are kept, and app updates will not overwrite them. You can reset it to the original later.</p>}
      <label className="field"><span>Name</span><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></label>
      <label className="field">
        <span>Category</span>
        <select value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </label>
      <label className="field"><span>Description</span><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <label className="field">
        <span>Metric type</span>
        <select value={f.metricType} onChange={(e) => set('metricType', e.target.value as MetricType)}>{METRIC_TYPES.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select>
      </label>
      {!isNew && <p className="muted">Changing the metric type does not change results you have already logged.</p>}
      {f.metricType === 'hits_attempts' && (
        <label className="field"><span>Default attempts</span><input type="number" inputMode="numeric" min={1} step={1} value={f.attempts} onChange={(e) => set('attempts', e.target.value)} /></label>
      )}
      <label className="field"><span>Default minutes</span><input type="number" inputMode="numeric" min={1} step={1} value={f.minutes} onChange={(e) => set('minutes', e.target.value)} /></label>
      <label className="field"><span>Suggested robot settings</span><textarea rows={2} value={f.settings} onChange={(e) => set('settings', e.target.value)} /></label>
      <label className="field"><span>Cues</span><textarea rows={2} value={f.cues} onChange={(e) => set('cues', e.target.value)} /></label>

      <div className="card">
        <h2>Benchmark</h2>
        <button type="button" className="btn" aria-pressed={f.hasBenchmark} onClick={() => set('hasBenchmark', !f.hasBenchmark)}>
          {f.hasBenchmark ? 'Benchmark on (tap to remove)' : 'Add a benchmark'}
        </button>
        {f.hasBenchmark && (
          <>
            <p className="muted">Metric: {METRIC_LABEL[f.metricType]} (the same as the drill). A benchmark is a goal and a prompt, never a lock.</p>
            <label className="field"><span>{THRESHOLD_LABEL[f.metricType]}</span><input type="number" inputMode="decimal" step="any" value={f.threshold} onChange={(e) => set('threshold', e.target.value)} /></label>
            {f.metricType === 'hits_attempts' && (
              <label className="field"><span>Minimum attempts for a result to count</span><input type="number" inputMode="numeric" min={1} step={1} value={f.minAttempts} onChange={(e) => set('minAttempts', e.target.value)} /></label>
            )}
            <label className="field"><span>Sessions in a row</span><input type="number" inputMode="numeric" min={1} step={1} value={f.consecutive} onChange={(e) => set('consecutive', e.target.value)} /></label>
            <label className="field"><span>Description (optional, filled in for you if empty)</span><input type="text" value={f.benchDescription} onChange={(e) => set('benchDescription', e.target.value)} /></label>
          </>
        )}
      </div>

      <FormErrors errors={errors} />
      <div className="row">
        <button type="submit" className="btn btn-big btn-primary" disabled={saving}>{saving ? 'Saving' : 'Save drill'}</button>
        <button type="button" className="btn btn-big" onClick={requestClose}>Cancel</button>
      </div>
    </form>
  )
}
