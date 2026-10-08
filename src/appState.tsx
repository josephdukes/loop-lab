import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getDb, type LoopLabDb } from './db/db'
import { loadSettings, updateSettings } from './db/settings'
import type { Settings, Theme } from './db/types'
import { seedBuiltInContent } from './content/seed'
import { CATEGORIES } from './content/builtinContent'

export interface ContentCounts {
  categories: number
  drills: number
  templates: number
  programs: number
}

interface AppState {
  db: LoopLabDb
  settings: Settings
  counts: ContentCounts
  setTheme: (theme: Theme) => void
  /** Saves a settings change immediately and updates every screen that reads settings. */
  updateSetting: (patch: SettingsPatch) => Promise<void>
  /** Re-reads settings from the database (after a backup is recorded or a restore). */
  refreshSettings: () => Promise<void>
  /** Increases whenever screens should reload their data (after a save, edit, delete or run change). */
  dataVersion: number
  notifyDataChanged: () => void
}

export type SettingsPatch = Partial<Omit<Settings, 'key' | 'createdAt' | 'updatedAt'>>

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; settings: Settings; counts: ContentCounts }

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'light' ? '#f6f6f4' : '#0b0b0c')
}

async function initialise(db: LoopLabDb): Promise<{ settings: Settings; counts: ContentCounts }> {
  await db.open()
  await seedBuiltInContent(db)
  const settings = await loadSettings(db)
  const counts: ContentCounts = {
    categories: CATEGORIES.length,
    drills: await db.drills.count(),
    templates: await db.sessionTemplates.count(),
    programs: await db.programs.count(),
  }
  return { settings, counts }
}

export function AppProvider({ children, renderLoading, renderError }: {
  children: ReactNode
  renderLoading: () => ReactNode
  renderError: (message: string, retry: () => void) => ReactNode
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const db = useMemo(() => getDb(), [])
  const [dataVersion, setDataVersion] = useState(0)
  const notifyDataChanged = useCallback(() => setDataVersion((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setPhase({ kind: 'loading' })
    initialise(db).then(
      (r) => {
        if (cancelled) return
        applyTheme(r.settings.theme)
        setPhase({ kind: 'ready', ...r })
      },
      (e) => {
        if (!cancelled) setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      },
    )
    return () => { cancelled = true }
  }, [db, attempt])

  const setTheme = useCallback((theme: Theme) => {
    applyTheme(theme)
    updateSettings(db, { theme }).then((s) => {
      setPhase((p) => (p.kind === 'ready' ? { ...p, settings: s } : p))
    }).catch(() => { /* theme already applied for this visit */ })
  }, [db])

  // Settings changes are applied one after another, in the order they were made.
  const settingsQueue = useRef<Promise<unknown>>(Promise.resolve())
  const updateSetting = useCallback((patch: SettingsPatch) => {
    if (patch.theme) applyTheme(patch.theme)
    const run = settingsQueue.current.catch(() => {}).then(async () => {
      const s = await updateSettings(db, patch)
      setPhase((p) => (p.kind === 'ready' ? { ...p, settings: s } : p))
    })
    settingsQueue.current = run
    return run
  }, [db])

  const refreshSettings = useCallback(async () => {
    const s = await loadSettings(db)
    applyTheme(s.theme)
    const counts: ContentCounts = {
      categories: CATEGORIES.length,
      drills: await db.drills.count(),
      templates: await db.sessionTemplates.count(),
      programs: await db.programs.count(),
    }
    setPhase((p) => (p.kind === 'ready' ? { ...p, settings: s, counts } : p))
  }, [db])

  if (phase.kind === 'loading') return <>{renderLoading()}</>
  if (phase.kind === 'error') return <>{renderError(phase.message, () => setAttempt((n) => n + 1))}</>
  return <Ctx.Provider value={{ db, settings: phase.settings, counts: phase.counts, setTheme, updateSetting, refreshSettings, dataVersion, notifyDataChanged }}>{children}</Ctx.Provider>
}
