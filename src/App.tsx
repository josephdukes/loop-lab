import { useEffect, useMemo, useState } from 'react'
import { AppProvider } from './appState'
import { BottomNav } from './components/BottomNav'
import { AppErrorBoundary, lazyScreen, LazyBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ScreenState'
import { UpdateToast } from './components/UpdateToast'
import { Home } from './screens/Home'
import { Train } from './screens/Train'
import { RunnerScreen } from './screens/Runner'
import { QuickLogScreen } from './screens/QuickLog'
import { AllSessionsScreen, SessionDetailScreen } from './screens/Sessions'
import { NavProvider, useNav } from './nav'
import { UndoProvider } from './undo'
import { startServiceWorker } from './pwa/registerSW'
import { EditorShell } from './components/EditorShell'

// Heavy screens load on demand so the first load is small. Every one of these files is still in the service
// worker's precache (vite.config.ts globs all built .js files), so they also open with no signal.
const Progress = lazyScreen(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const Matches = lazyScreen(() => import('./screens/Matches').then((m) => ({ default: m.Matches })))
const Data = lazyScreen(() => import('./screens/Data').then((m) => ({ default: m.Data })))
const SettingsScreen = lazyScreen(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })))
const DrillEditorScreen = lazyScreen(() => import('./screens/DrillEditor').then((m) => ({ default: m.DrillEditorScreen })))
const TemplateEditorScreen = lazyScreen(() => import('./screens/TemplateEditor').then((m) => ({ default: m.TemplateEditorScreen })))
const ProgramEditorScreen = lazyScreen(() => import('./screens/ProgramEditor').then((m) => ({ default: m.ProgramEditorScreen })))
const MatchFormScreen = lazyScreen(() => import('./screens/MatchForm').then((m) => ({ default: m.MatchFormScreen })))
const BlockReviewScreen = lazyScreen(() => import('./screens/BlockReview').then((m) => ({ default: m.BlockReviewScreen })))

const OVERLAY_TITLE: Record<string, string> = {
  settings: 'Settings and help', drillEditor: 'Drill', templateEditor: 'Session', programEditor: 'Program', matchForm: 'Match', blockReview: 'Block Review',
}

/** Shown while a lazy full-screen screen arrives: the same frame, so nothing jumps. */
function OverlayLoading({ kind }: { kind: string }) {
  return <EditorShell title={OVERLAY_TITLE[kind] ?? 'Loading'}><Loading label="Loading" /></EditorShell>
}

function Shell() {
  const { nav, setTab } = useNav()
  const tab = nav.tab
  const overlay = nav.overlay
  const [updateReady, setUpdateReady] = useState(false)
  const pwa = useMemo(() => ({ current: null as null | ReturnType<typeof startServiceWorker> }), [])

  useEffect(() => {
    pwa.current = startServiceWorker(() => setUpdateReady(true))
  }, [pwa])

  const overlayKey = overlay ? `${nav.overlays.length}:${overlay.kind}` : 'none'
  const lazyOverlay = (name: string, retry: () => void, node: React.ReactNode) => (
    <LazyBoundary name={name} resetKey={overlayKey} retry={retry} loading={overlay ? <OverlayLoading kind={overlay.kind} /> : undefined}>{node}</LazyBoundary>
  )

  return (
    <>
      {/* While a full-screen screen is open, everything behind it is inert: no Tab stops, hidden from screen readers. */}
      <main className="screen" inert={!!overlay}>
        {tab === 'home' && <Home />}
        {tab === 'train' && <Train />}
        {tab === 'progress' && <LazyBoundary name="Progress" resetKey={tab} retry={Progress.retry}><Progress /></LazyBoundary>}
        {tab === 'matches' && <LazyBoundary name="Matches" resetKey={tab} retry={Matches.retry}><Matches /></LazyBoundary>}
        {tab === 'data' && <LazyBoundary name="Data" resetKey={tab} retry={Data.retry}><Data /></LazyBoundary>}
      </main>
      {updateReady && <UpdateToast onReload={() => pwa.current?.applyUpdate()} onDismiss={() => setUpdateReady(false)} />}
      {overlay?.kind === 'runner' && <RunnerScreen init={overlay.init} />}
      {overlay?.kind === 'quicklog' && <QuickLogScreen key={`${overlay.sessionId ?? ''}${overlay.templateId ?? ''}`} sessionId={overlay.sessionId} templateId={overlay.templateId} />}
      {overlay?.kind === 'allSessions' && <AllSessionsScreen />}
      {overlay?.kind === 'sessionDetail' && <SessionDetailScreen sessionId={overlay.sessionId} />}
      {overlay?.kind === 'drillEditor' && lazyOverlay('Drill editor', DrillEditorScreen.retry, <DrillEditorScreen key={overlay.drillId ?? 'new'} drillId={overlay.drillId} />)}
      {overlay?.kind === 'templateEditor' && lazyOverlay('Session builder', TemplateEditorScreen.retry, <TemplateEditorScreen key={overlay.templateId ?? 'new'} templateId={overlay.templateId} />)}
      {overlay?.kind === 'programEditor' && lazyOverlay('Program builder', ProgramEditorScreen.retry, <ProgramEditorScreen key={overlay.programId ?? 'new'} programId={overlay.programId} />)}
      {overlay?.kind === 'matchForm' && lazyOverlay('Match form', MatchFormScreen.retry, <MatchFormScreen key={overlay.matchId ?? 'new'} matchId={overlay.matchId} />)}
      {overlay?.kind === 'blockReview' && lazyOverlay('Block Review', BlockReviewScreen.retry, <BlockReviewScreen runId={overlay.runId} />)}
      {overlay?.kind === 'settings' && lazyOverlay('Settings', SettingsScreen.retry, <SettingsScreen />)}
      <BottomNav active={tab} onChange={setTab} inert={!!overlay} />
    </>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider
        renderLoading={() => <main className="screen center" role="status">Loading Loop Lab</main>}
        renderError={(message, retry) => (
          <main className="screen center" role="alert">
            <h1>Loop Lab could not open its data</h1>
            <p>{message}</p>
            <p className="muted">Your data has not been changed. If this keeps happening, restart Chrome and try again.</p>
            <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
          </main>
        )}
      >
        <NavProvider>
          <UndoProvider>
            <Shell />
          </UndoProvider>
        </NavProvider>
      </AppProvider>
    </AppErrorBoundary>
  )
}
