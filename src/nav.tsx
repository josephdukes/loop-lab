// Navigation: which tab, which Train sub-tab / detail, and the screens stacked above the tab.
// State lives in a NavController that mirrors the browser history, so the Back button works (see lib/navModel.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog'
import { NavController } from './lib/navController'
import { createModel, topOverlay, type NavState, type Overlay, type RunnerInit, type TabId, type TrainSub } from './lib/navModel'
import { ControllerCtx, useBackInterceptor } from './navContext'

export type { NavState, Overlay, RunnerInit, TabId, TrainSub }
export { useBackInterceptor }

interface Nav {
  /** `overlay` is the screen on top of the stack (the one on screen). */
  nav: NavState & { overlay?: Overlay }
  setTab: (tab: TabId) => void
  openTrain: (sub: TrainSub, detail?: { programId?: string; drillId?: string }) => void
  /** Go to the Data tab and bring the given action into view. */
  openData: (focus?: 'backup') => void
  openOverlay: (o: Overlay) => void
  /** Closes the top screen (like the Back button). Pass a count to close several at once. Never asks about unsaved changes. */
  closeOverlay: (count?: number) => void
  closeAllOverlays: () => void
  /** What the Close / Back buttons call: lets a dialog, picker or unsaved-changes guard act first, then closes. */
  requestClose: () => void
  /** Goes from a detail screen (a program, a drill) back to its list. */
  closeDetail: () => void
}

const Ctx = createContext<Nav | null>(null)

export function useNav(): Nav {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNav must be used inside <NavProvider>')
  return v
}

const GuardCtx = createContext<{ ask: () => void } | null>(null)

/**
 * Call with `dirty = true` while a form holds input that has not been saved. Close, Cancel and the Back button
 * then ask "Discard your changes?" first, instead of silently throwing the input away.
 */
export function useUnsavedGuard(dirty: boolean): void {
  const guard = useContext(GuardCtx)
  useBackInterceptor(dirty && !!guard, () => guard?.ask())
}

export function NavProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new NavController(window), [])
  const [state, setState] = useState<NavState>(() => createModel().entries[0])
  const [askDiscard, setAskDiscard] = useState(false)

  useEffect(() => controller.attach(setState), [controller])

  const setTab = useCallback((tab: TabId) => {
    const cur = controller.state
    if (tab === cur.tab && cur.overlays.length === 0) {
      if (cur.programId || cur.drillId) controller.up({ ...cur, programId: undefined, drillId: undefined, dataFocus: undefined })
      return
    }
    controller.tab({ ...cur, tab, overlays: [], dataFocus: undefined })
  }, [controller])

  const openData = useCallback((dataFocus?: 'backup') => {
    controller.tab({ ...controller.state, tab: 'data', overlays: [], dataFocus })
  }, [controller])

  const openTrain = useCallback((trainSub: TrainSub, detail?: { programId?: string; drillId?: string }) => {
    const cur = controller.state
    const target: NavState = { tab: 'train', trainSub, programId: detail?.programId, drillId: detail?.drillId, overlays: [] }
    if (cur.tab !== 'train' || cur.overlays.length > 0) controller.tab(target)
    else if (detail?.programId || detail?.drillId) controller.push(target)
    else if (cur.programId || cur.drillId) controller.up(target)
    else controller.replace(target)
  }, [controller])

  const openOverlay = useCallback((o: Overlay) => {
    const cur = controller.state
    controller.push({ ...cur, overlays: [...cur.overlays, o] })
  }, [controller])

  const closeOverlay = useCallback((count = 1) => {
    const n = Math.min(count, controller.state.overlays.length)
    if (n > 0) controller.back(n)
  }, [controller])

  const closeAllOverlays = useCallback(() => controller.closeAll(), [controller])

  const requestClose = useCallback(() => {
    if (!controller.runInterceptor()) closeOverlay()
  }, [controller, closeOverlay])

  const closeDetail = useCallback(() => {
    const cur = controller.state
    controller.up({ ...cur, programId: undefined, drillId: undefined, overlays: [] })
  }, [controller])

  const nav = useMemo(() => ({ ...state, overlay: topOverlay(state) }), [state])
  const value = useMemo<Nav>(
    () => ({ nav, setTab, openTrain, openData, openOverlay, closeOverlay, closeAllOverlays, requestClose, closeDetail }),
    [nav, setTab, openTrain, openData, openOverlay, closeOverlay, closeAllOverlays, requestClose, closeDetail],
  )
  const guard = useMemo(() => ({ ask: () => setAskDiscard(true) }), [])
  const closeRef = useRef(closeOverlay)
  useEffect(() => { closeRef.current = closeOverlay })

  return (
    <ControllerCtx.Provider value={controller}>
      <Ctx.Provider value={value}>
        <GuardCtx.Provider value={guard}>
          {children}
          {askDiscard && (
            <ConfirmDialog
              title="Discard your changes?"
              message="You have typed something that has not been saved. If you leave now it will be lost."
              confirmLabel="Discard changes"
              cancelLabel="Keep editing"
              danger
              onCancel={() => setAskDiscard(false)}
              onConfirm={() => { setAskDiscard(false); closeRef.current() }}
            />
          )}
        </GuardCtx.Provider>
      </Ctx.Provider>
    </ControllerCtx.Provider>
  )
}
