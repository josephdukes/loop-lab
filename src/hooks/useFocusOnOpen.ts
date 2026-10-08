import { useEffect, type RefObject } from 'react'

/** Moves focus to `target` (a heading with tabIndex -1) when a full-screen screen opens, and puts it back where it was on close. */
export function useFocusOnOpen(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    target.current?.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [target])
}
