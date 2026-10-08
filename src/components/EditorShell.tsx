// Full-screen frame for editors, forms and detail screens: a title, a Close button (which asks about unsaved
// changes first when needed), keyboard Escape, focus moved in on open and put back on close.
import { useId, useRef, type ReactNode } from 'react'
import { useFocusOnOpen } from '../hooks/useFocusOnOpen'
import { useNav } from '../nav'

export function EditorShell({ title, children, closeLabel = 'Close' }: { title: string; children: ReactNode; closeLabel?: string }) {
  const { requestClose } = useNav()
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useFocusOnOpen(heading)

  return (
    <div
      className="overlay-screen" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); requestClose() } }}
    >
      <header className="overlay-head">
        <h1 id={titleId} ref={heading} tabIndex={-1}>{title}</h1>
        <button type="button" className="btn" onClick={requestClose}>{closeLabel}</button>
      </header>
      {children}
    </div>
  )
}

export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div className="card form-errors" role="alert">
      <h2>Please fix this before saving</h2>
      <ul className="plain">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  )
}

/** Parses a number box: empty gives undefined, text that is not a number gives NaN (so validation catches it). */
export function parseNumber(text: string): number | undefined {
  const t = text.trim()
  return t === '' ? undefined : Number(t)
}
