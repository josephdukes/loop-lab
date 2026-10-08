// Searchable drill list with category chips. Read-only; the caller decides what selecting a drill does.
import { useMemo, useState } from 'react'
import { useApp } from '../appState'
import { CATEGORIES } from '../content/builtinContent'
import { useAsync } from '../hooks/useAsync'
import type { Drill } from '../db/types'
import { METRIC_LABEL } from '../lib/format'
import { CategoryChips } from './Chips'
import { ShowArchived } from './ShowArchived'
import { EmptyState } from './EmptyState'
import { AsyncView } from './ScreenState'

const order = (c: string) => {
  const i = (CATEGORIES as readonly string[]).indexOf(c)
  return i < 0 ? 99 : i
}

export function DrillBrowser({ onSelect, actionLabel, allowArchived }: { onSelect: (d: Drill) => void; actionLabel?: string; allowArchived?: boolean }) {
  const { db } = useApp()
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const state = useAsync(async () => (await db.drills.toArray()).filter((d) => showArchived || !d.archived), [db, showArchived])

  return (
    <div>
      <CategoryChips value={category} onChange={setCategory} />
      <label className="field">
        <span>Search drills</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or description" />
      </label>
      {allowArchived && <ShowArchived value={showArchived} onChange={setShowArchived} />}
      <AsyncView state={state}>{(drills) => <List drills={drills} category={category} query={query} onSelect={onSelect} actionLabel={actionLabel} />}</AsyncView>
    </div>
  )
}

function List({ drills, category, query, onSelect, actionLabel }: { drills: Drill[]; category: string | null; query: string; onSelect: (d: Drill) => void; actionLabel?: string }) {
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return drills
      .filter((d) => (!category || d.category === category) && (!q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)))
      .sort((a, b) => order(a.category) - order(b.category) || a.name.localeCompare(b.name))
  }, [drills, category, query])

  if (drills.length === 0) return <EmptyState title="No drills yet">Built-in drills are added when the app first opens.</EmptyState>
  if (shown.length === 0) return <EmptyState title="No drills match">Try a different search or category.</EmptyState>
  return (
    <ul className="list" aria-label="Drills">
      {shown.map((d) => (
        <li key={d.id}>
          <button type="button" className="list-item" onClick={() => onSelect(d)}>
            <span className="list-title">{d.name}{d.archived ? ' (archived)' : ''}</span>
            <span className="muted">{d.category} / {METRIC_LABEL[d.metricType]}{d.defaultDurationMin ? ` / ${d.defaultDurationMin} min` : ''}{!d.isBuiltIn ? ' / Custom' : d.modifiedByUser ? ' / Edited' : ''}</span>
            {actionLabel && <span className="list-action">{actionLabel}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
