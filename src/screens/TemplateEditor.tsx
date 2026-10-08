// Session builder (spec 5, Builders): pick drills from the library, reorder with up and down buttons,
// per-item minutes and notes, kind robot or club.
import { useEffect, useState } from 'react'
import { useApp } from '../appState'
import { DrillBrowser } from '../components/DrillBrowser'
import { EditorShell, FormErrors, parseNumber } from '../components/EditorShell'
import { EmptyState } from '../components/EmptyState'
import { ErrorBox, Loading } from '../components/ScreenState'
import type { Benchmark, Drill, SessionKind, SessionTemplate } from '../db/types'
import { newId, nowIso } from '../lib/id'
import { blankTemplate } from '../lib/libraryRules'
import { saveItem } from '../lib/libraryService'
import { ValidationError } from '../lib/validation'
import { useBackInterceptor, useNav, useUnsavedGuard } from '../nav'

interface ItemForm {
  key: string
  drillId: string
  name: string
  minutes: string
  note: string
  benchmarkOverride?: Benchmark
}

/** Moves item `index` by `delta` places (clamped); returns a new array. */
export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta
  if (to < 0 || to >= list.length || index < 0 || index >= list.length) return list
  const next = list.slice()
  const [it] = next.splice(index, 1)
  next.splice(to, 0, it)
  return next
}

export function TemplateEditorScreen({ templateId }: { templateId?: string }) {
  const { db } = useApp()
  const [data, setData] = useState<{ base: SessionTemplate; drills: Map<string, Drill> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([templateId ? db.sessionTemplates.get(templateId) : Promise.resolve(undefined), db.drills.toArray()]).then(
      ([t, drills]) => {
        if (templateId && !t) { setError('This session no longer exists.'); return }
        setData({ base: t ?? blankTemplate(nowIso(), newId()), drills: new Map(drills.map((d) => [d.id, d])) })
      },
      (e) => setError(String(e)),
    )
  }, [db, templateId])

  return (
    <EditorShell title={templateId ? 'Edit session' : 'New session'}>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading />}
      {data && <TemplateForm base={data.base} drills={data.drills} />}
    </EditorShell>
  )
}

function TemplateForm({ base, drills }: { base: SessionTemplate; drills: Map<string, Drill> }) {
  const { db, notifyDataChanged } = useApp()
  const { closeOverlay, requestClose } = useNav()
  const [name, setName] = useState(base.name)
  const [kind, setKind] = useState<SessionKind>(base.kind)
  const [items, setItems] = useState<ItemForm[]>(() =>
    base.items.slice().sort((a, b) => a.order - b.order).map((i) => ({
      key: newId(), drillId: i.drillId, name: drills.get(i.drillId)?.name ?? 'Missing drill',
      minutes: i.durationMin?.toString() ?? '', note: i.note ?? '', benchmarkOverride: i.benchmarkOverride,
    })),
  )
  const [picking, setPicking] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [initialJson] = useState(() => JSON.stringify({ name, kind, items }))
  useUnsavedGuard(!picking && JSON.stringify({ name, kind, items }) !== initialJson)
  useBackInterceptor(picking, () => setPicking(false))
  const patch = (key: string, p: Partial<ItemForm>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)))

  async function save() {
    setSaving(true)
    setErrors([])
    try {
      const built: SessionTemplate = {
        ...base,
        name, kind,
        items: items.map((i, idx) => ({
          drillId: i.drillId, order: idx + 1,
          ...(parseNumber(i.minutes) !== undefined ? { durationMin: parseNumber(i.minutes) } : {}),
          ...(i.note.trim() ? { note: i.note.trim() } : {}),
          ...(i.benchmarkOverride ? { benchmarkOverride: i.benchmarkOverride } : {}),
        })),
      }
      await saveItem(db, 'template', built)
      notifyDataChanged()
      closeOverlay()
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.errors : [e instanceof Error ? e.message : String(e)])
      setSaving(false)
    }
  }

  if (picking) {
    return (
      <div>
        <h2>Pick a drill to add</h2>
        <DrillBrowser
          actionLabel="Add"
          onSelect={(d) => {
            setItems((list) => [...list, { key: newId(), drillId: d.id, name: d.name, minutes: d.defaultDurationMin?.toString() ?? '', note: '' }])
            setPicking(false)
          }}
        />
        <button type="button" className="btn" onClick={() => setPicking(false)}>Cancel</button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
      {base.isBuiltIn && <p className="muted">This is a built-in session. Your changes are kept, and app updates will not overwrite them. You can reset it to the original later.</p>}
      <label className="field"><span>Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
      <div className="field" role="group" aria-label="Session kind">
        <span>Kind</span>
        <div className="row two">
          <button type="button" className="btn" aria-pressed={kind === 'robot'} onClick={() => setKind('robot')}>Robot session</button>
          <button type="button" className="btn" aria-pressed={kind === 'club'} onClick={() => setKind('club')}>Club session</button>
        </div>
      </div>

      <h2 className="section-h">Drills in order</h2>
      {items.length === 0 && <EmptyState title="No drills yet">Add the drills for this session, then put them in order.</EmptyState>}
      <ol className="builder-list">
        {items.map((it, i) => (
          <li key={it.key} className="card">
            <h3>{i + 1}. {it.name}</h3>
            <div className="row">
              <button type="button" className="btn" aria-label={`Move ${it.name} up`} disabled={i === 0} onClick={() => setItems((l) => moveItem(l, i, -1))}>Up</button>
              <button type="button" className="btn" aria-label={`Move ${it.name} down`} disabled={i === items.length - 1} onClick={() => setItems((l) => moveItem(l, i, 1))}>Down</button>
              <button type="button" className="btn btn-danger" aria-label={`Remove ${it.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>Remove</button>
            </div>
            <label className="field"><span>Minutes</span><input type="number" inputMode="numeric" min={1} step={1} value={it.minutes} onChange={(e) => patch(it.key, { minutes: e.target.value })} /></label>
            <label className="field"><span>Note (optional)</span><input type="text" value={it.note} onChange={(e) => patch(it.key, { note: e.target.value })} /></label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-big" onClick={() => setPicking(true)}>Add a drill</button>

      <FormErrors errors={errors} />
      <div className="row">
        <button type="submit" className="btn btn-big btn-primary" disabled={saving}>{saving ? 'Saving' : 'Save session'}</button>
        <button type="button" className="btn btn-big" onClick={requestClose}>Cancel</button>
      </div>
    </form>
  )
}
