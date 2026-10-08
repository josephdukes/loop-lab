// Program builder (spec 5, Builders): weeks, each week picks sessions from templates, sessionsPerWeek,
// repeat toggle and cycle length, guidance notes.
import { useEffect, useState } from 'react'
import { useApp } from '../appState'
import { EditorShell, FormErrors, parseNumber } from '../components/EditorShell'
import { ErrorBox, Loading } from '../components/ScreenState'
import { CATEGORIES } from '../content/builtinContent'
import type { Program, ProgramWeek, SessionTemplate } from '../db/types'
import { newId, nowIso } from '../lib/id'
import { blankProgram } from '../lib/libraryRules'
import { saveItem } from '../lib/libraryService'
import { ValidationError } from '../lib/validation'
import { useNav, useUnsavedGuard } from '../nav'

/** Makes every week hold exactly `count` sessions: extra slots are dropped, missing ones copy the week's first template. */
export function resizeSessions(weeks: ProgramWeek[], count: number): ProgramWeek[] {
  return weeks.map((w) => {
    const sessions = w.sessions.slice(0, count)
    while (sessions.length < count) sessions.push({ label: `Session ${sessions.length + 1}`, templateId: w.sessions[0]?.templateId ?? '' })
    return { ...w, sessions }
  })
}

/** A new last week that copies the previous one (labels, templates and any per-drill overrides). */
export function appendWeek(weeks: ProgramWeek[]): ProgramWeek[] {
  const last = weeks[weeks.length - 1]
  const n = weeks.length + 1
  return [...weeks, { weekNumber: n, title: `Week ${n}`, sessions: structuredClone(last?.sessions ?? []) }]
}

export function removeWeek(weeks: ProgramWeek[], index: number): ProgramWeek[] {
  return weeks.filter((_, i) => i !== index).map((w, i) => ({ ...w, weekNumber: i + 1 }))
}

export function ProgramEditorScreen({ programId }: { programId?: string }) {
  const { db } = useApp()
  const [data, setData] = useState<{ base: Program; templates: SessionTemplate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([programId ? db.programs.get(programId) : Promise.resolve(undefined), db.sessionTemplates.toArray()]).then(
      ([p, templates]) => {
        if (programId && !p) { setError('This program no longer exists.'); return }
        const usable = templates.filter((t) => !t.archived)
        if (!p && usable.length === 0) { setError('Create a session first: a program is made of sessions.'); return }
        setData({ base: p ?? blankProgram(nowIso(), newId(), usable[0].id), templates })
      },
      (e) => setError(String(e)),
    )
  }, [db, programId])

  return (
    <EditorShell title={programId ? 'Edit program' : 'New program'}>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading />}
      {data && <ProgramForm base={data.base} templates={data.templates} />}
    </EditorShell>
  )
}

function ProgramForm({ base, templates }: { base: Program; templates: SessionTemplate[] }) {
  const { db, notifyDataChanged } = useApp()
  const { closeOverlay, requestClose } = useNav()
  const [name, setName] = useState(base.name)
  const [category, setCategory] = useState(base.category)
  const [description, setDescription] = useState(base.description)
  const [repeating, setRepeating] = useState(base.repeating)
  const [cycle, setCycle] = useState(base.cycleLengthWeeks?.toString() ?? String(base.weeks.length))
  const [perWeek, setPerWeek] = useState(String(base.sessionsPerWeek))
  const [notes, setNotes] = useState(base.notes)
  const [weeks, setWeeks] = useState<ProgramWeek[]>(base.weeks)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const snapshot = JSON.stringify({ name, category, description, repeating, cycle, perWeek, notes, weeks })
  const [initialJson] = useState(snapshot)
  useUnsavedGuard(snapshot !== initialJson)

  const templateOptions = (currentId: string) => templates.filter((t) => !t.archived || t.id === currentId).sort((a, b) => a.name.localeCompare(b.name))
  const patchWeek = (i: number, p: Partial<ProgramWeek>) => setWeeks((l) => l.map((w, wi) => (wi === i ? { ...w, ...p } : w)))
  const patchSlot = (wi: number, si: number, p: { label?: string; templateId?: string }) =>
    setWeeks((l) => l.map((w, i) => (i !== wi ? w : {
      ...w,
      sessions: w.sessions.map((s, j) => {
        if (j !== si) return s
        // Per-drill overrides belong to one template, so changing the template drops them.
        const changed = p.templateId !== undefined && p.templateId !== s.templateId
        const { itemOverrides: _o, ...rest } = s
        void _o
        return { ...rest, ...p, ...(!changed && s.itemOverrides ? { itemOverrides: s.itemOverrides } : {}) }
      }),
    })))

  const changePerWeek = (text: string) => {
    setPerWeek(text)
    const n = Number(text)
    if (Number.isInteger(n) && n >= 1 && n <= 14) setWeeks((l) => resizeSessions(l, n))
  }

  async function save() {
    setSaving(true)
    setErrors([])
    try {
      const { cycleLengthWeeks: _c, ...rest } = base
      void _c
      const built: Program = {
        ...rest, name, category, description: description.trim(), repeating, notes: notes.trim(),
        sessionsPerWeek: parseNumber(perWeek) ?? NaN,
        ...(repeating ? { cycleLengthWeeks: parseNumber(cycle) ?? NaN } : {}),
        weeks: weeks.map((w, i) => ({ ...w, weekNumber: i + 1 })),
      }
      await saveItem(db, 'program', built)
      notifyDataChanged()
      closeOverlay()
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.errors : [e instanceof Error ? e.message : String(e)])
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
      {base.isBuiltIn && <p className="muted">This is a built-in program. Your changes are kept, and app updates will not overwrite them. You can reset it to the original later.</p>}
      <label className="field"><span>Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </label>
      <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="field"><span>Sessions per week</span><input type="number" inputMode="numeric" min={1} max={14} step={1} value={perWeek} onChange={(e) => changePerWeek(e.target.value)} /></label>
      <div className="field" role="group" aria-label="Repeat">
        <span>Repeat</span>
        <button type="button" className="btn" aria-pressed={repeating} onClick={() => setRepeating((r) => !r)}>{repeating ? 'Repeats after the last week (tap to turn off)' : 'Runs once (tap to repeat)'}</button>
      </div>
      {repeating && (
        <label className="field"><span>Cycle length in weeks</span><input type="number" inputMode="numeric" min={1} step={1} value={cycle} onChange={(e) => setCycle(e.target.value)} /></label>
      )}

      <h2 className="section-h">Weeks</h2>
      {weeks.map((w, wi) => (
        <section key={wi} className="card" aria-label={`Week ${wi + 1}`}>
          <h3>Week {wi + 1}</h3>
          <label className="field"><span>Title</span><input type="text" value={w.title} onChange={(e) => patchWeek(wi, { title: e.target.value })} /></label>
          <label className="field"><span>Goal (optional)</span><input type="text" value={w.goal ?? ''} onChange={(e) => patchWeek(wi, { goal: e.target.value || undefined })} /></label>
          {w.sessions.map((s, si) => (
            <div key={si} className="slot">
              <label className="field"><span>Session {si + 1} name</span><input type="text" value={s.label} onChange={(e) => patchSlot(wi, si, { label: e.target.value })} /></label>
              <label className="field">
                <span>Session {si + 1} template</span>
                <select value={s.templateId} onChange={(e) => patchSlot(wi, si, { templateId: e.target.value })}>
                  {!templates.some((t) => t.id === s.templateId) && <option value={s.templateId}>Missing session (choose another)</option>}
                  {templateOptions(s.templateId).map((t) => <option key={t.id} value={t.id}>{t.name}{t.archived ? ' (archived)' : ''}</option>)}
                </select>
              </label>
            </div>
          ))}
          {weeks.length > 1 && <button type="button" className="btn btn-danger" aria-label={`Remove week ${wi + 1}`} onClick={() => setWeeks((l) => removeWeek(l, wi))}>Remove week {wi + 1}</button>}
        </section>
      ))}
      <button type="button" className="btn btn-big" onClick={() => setWeeks((l) => appendWeek(l))}>Add a week</button>

      <label className="field"><span>Guidance notes (separate cards with a blank line)</span><textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

      <FormErrors errors={errors} />
      <div className="row">
        <button type="submit" className="btn btn-big btn-primary" disabled={saving}>{saving ? 'Saving' : 'Save program'}</button>
        <button type="button" className="btn btn-big" onClick={requestClose}>Cancel</button>
      </div>
    </form>
  )
}
