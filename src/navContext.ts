// Shared context for the history controller, kept apart from nav.tsx so small components (dialogs) can use it without import loops.
import { createContext, useContext, useEffect, useRef } from 'react'
import type { NavController } from './lib/navController'

export const ControllerCtx = createContext<NavController | null>(null)

/**
 * While `active`, the browser Back button (and any Close button routed through requestClose) calls `run`
 * instead of leaving the screen. Used by dialogs, the drill picker and the unsaved-changes guard.
 * Does nothing outside a NavProvider (for example in a bare component test).
 */
export function useBackInterceptor(active: boolean, run: () => void): void {
  const controller = useContext(ControllerCtx)
  const latest = useRef(run)
  useEffect(() => { latest.current = run })
  useEffect(() => {
    if (!active || !controller) return
    return controller.intercept({ run: () => latest.current() })
  }, [active, controller])
}
