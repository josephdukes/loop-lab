// Train tab: Programs, Sessions, Drills and Guides sub-tabs.
import { useNav, type TrainSub } from '../nav'
import { DrillsTab } from './DrillsTab'
import { GuidesTab } from './GuidesTab'
import { ProgramsTab } from './ProgramsTab'
import { SessionsTab } from './SessionsTab'

const SUBS: Array<{ id: TrainSub; label: string }> = [
  { id: 'programs', label: 'Programs' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'drills', label: 'Drills' },
  { id: 'guides', label: 'Guides' },
]

export function Train() {
  const { nav, openTrain } = useNav()
  return (
    <section aria-labelledby="train-h">
      <h1 id="train-h">Train</h1>
      <div className="subtabs" role="tablist" aria-label="Train sections">
        {SUBS.map((s, i) => (
          <button
            key={s.id} type="button" role="tab" id={`tab-${s.id}`} className="subtab"
            aria-selected={nav.trainSub === s.id} aria-controls="train-panel" tabIndex={nav.trainSub === s.id ? 0 : -1}
            onClick={() => openTrain(s.id)}
            onKeyDown={(e) => {
              // Arrow keys move between the tabs, as tab lists do everywhere else.
              const to = e.key === 'ArrowRight' ? (i + 1) % SUBS.length : e.key === 'ArrowLeft' ? (i + SUBS.length - 1) % SUBS.length : e.key === 'Home' ? 0 : e.key === 'End' ? SUBS.length - 1 : -1
              if (to < 0) return
              e.preventDefault()
              openTrain(SUBS[to].id)
              document.getElementById(`tab-${SUBS[to].id}`)?.focus()
            }}
          >{s.label}</button>
        ))}
      </div>
      <div role="tabpanel" id="train-panel" aria-labelledby={`tab-${nav.trainSub}`} tabIndex={-1}>
        {nav.trainSub === 'programs' && <ProgramsTab />}
        {nav.trainSub === 'sessions' && <SessionsTab />}
        {nav.trainSub === 'drills' && <DrillsTab />}
        {nav.trainSub === 'guides' && <GuidesTab />}
      </div>
    </section>
  )
}
