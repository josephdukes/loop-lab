import { useMemo, useState } from 'react'
import { useApp } from '../appState'
import { CategoryChips } from '../components/Chips'
import { EmptyState } from '../components/EmptyState'
import { AsyncView } from '../components/ScreenState'
import { useAsync } from '../hooks/useAsync'
import type { Drill, SessionTemplate } from '../db/types'
import { byId } from '../lib/slots'
import { ItemActions } from '../components/ItemActions'
import { ShowArchived } from '../components/ShowArchived'
import { useNav } from '../nav'

export function SessionsTab() {
  const { db } = useApp()
  const { openOverlay } = useNav()
  const [category, setCategory] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const state = useAsync(async () => {
    const [templates, drills] = await Promise.all([db.sessionTemplates.toArray(), db.drills.toArray()])
    return { templates: templates.filter((t) => showArchived || !t.archived), drills: byId(drills) }
  }, [db, showArchived])

  return (
    <div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => openOverlay({ kind: 'templateEditor' })}>New session</button>
        <ShowArchived value={showArchived} onChange={setShowArchived} />
      </div>
      <CategoryChips value={category} onChange={setCategory} />
      <AsyncView state={state}>
        {({ templates, drills }) => <TemplateList templates={templates} drills={drills} category={category} onStart={(id) => openOverlay({ kind: 'runner', init: { mode: 'template', templateId: id } })} />}
      </AsyncView>
    </div>
  )
}

function TemplateList({ templates, drills, category, onStart }: { templates: SessionTemplate[]; drills: Map<string, Drill>; category: string | null; onStart: (id: string) => void }) {
  const { openOverlay } = useNav()
  const shown = useMemo(
    () => templates
      .filter((t) => !category || t.items.some((i) => drills.get(i.drillId)?.category === category))
      .sort((a, b) => (a.builtInKey ?? 'zz').localeCompare(b.builtInKey ?? 'zz') || a.name.localeCompare(b.name)),
    [templates, drills, category],
  )
  if (templates.length === 0) return <EmptyState title="No session templates yet">Built-in sessions are added when the app first opens.</EmptyState>
  if (shown.length === 0) return <EmptyState title="No sessions in this category">Pick another category, or choose All.</EmptyState>
  return (
    <ul className="list" aria-label="Session templates">
      {shown.map((t) => {
        const minutes = t.items.reduce((s, i) => s + (i.durationMin ?? drills.get(i.drillId)?.defaultDurationMin ?? 0), 0)
        return (
          <li key={t.id} className="card">
            <h2 className="card-title">{t.name}{t.archived ? ' (archived)' : ''}</h2>
            <p className="muted">{t.kind === 'club' ? 'Club session' : 'Robot session'} / {minutes} min{!t.isBuiltIn ? ' / Custom' : t.modifiedByUser ? ' / Edited' : ''}</p>
            <p>{t.items.slice().sort((a, b) => a.order - b.order).map((i) => drills.get(i.drillId)?.name ?? 'Missing drill').join(', ')}</p>
            {!t.archived && <button type="button" className="btn btn-primary" aria-label={`Start now: ${t.name}`} onClick={() => onStart(t.id)}>Start now</button>}
            <ItemActions kind="template" item={t} onEdit={() => openOverlay({ kind: 'templateEditor', templateId: t.id })} />
          </li>
        )
      })}
    </ul>
  )
}
