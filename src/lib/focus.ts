// Small focus helpers for dialogs and screens.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** Tabbable elements inside `root`, in DOM order, skipping hidden ones. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
}

/** Keeps Tab and Shift+Tab inside `root`. Call from a keydown handler. */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault: () => void }, root: HTMLElement): void {
  if (e.key !== 'Tab') return
  const items = focusableIn(root)
  if (items.length === 0) { e.preventDefault(); root.focus(); return }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus() }
}

/**
 * Makes everything on the page except `keep` unreachable (the `inert` attribute) and returns a function that undoes
 * exactly what it changed. Used while a dialog is open so Tab and screen readers stay inside it.
 */
export function inertExcept(keep: HTMLElement): () => void {
  const changed: Element[] = []
  for (const el of Array.from(document.body.children)) {
    if (el === keep || el.contains(keep) || el.hasAttribute('inert') || el.tagName === 'SCRIPT') continue
    el.setAttribute('inert', '')
    changed.push(el)
  }
  return () => changed.forEach((el) => el.removeAttribute('inert'))
}
