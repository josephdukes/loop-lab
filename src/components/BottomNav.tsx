import type { TabId } from '../lib/navModel'

export type { TabId }

export const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'train', label: 'Train' },
  { id: 'progress', label: 'Progress' },
  { id: 'matches', label: 'Matches' },
  { id: 'data', label: 'Data' },
]

const ICONS: Record<TabId, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
  train: 'M4 9v6M8 6v12M16 6v12M20 9v6M8 12h8',
  progress: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  matches: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  data: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3',
}

export function BottomNav({ active, onChange, inert }: { active: TabId; onChange: (t: TabId) => void; inert?: boolean }) {
  return (
    <nav className="bottom-nav" aria-label="Main" inert={inert}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="nav-btn"
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path d={ICONS[t.id]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
