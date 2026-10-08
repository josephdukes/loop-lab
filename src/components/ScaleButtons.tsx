// Five large 1-5 buttons as a labelled radio group (effort, loop confidence, confidence, drill rating).
// Arrow keys move and choose, Tab enters and leaves the group, as native radio buttons do.
import { useId, useRef } from 'react'

export function RadioScale({ label, value, onChange, visibleLabel = true }: { label: string; value: number | null; onChange: (n: number) => void; visibleLabel?: boolean }) {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const tabStop = value ?? 1

  const move = (n: number) => {
    const next = Math.min(5, Math.max(1, n))
    onChange(next)
    refs.current[next - 1]?.focus()
  }
  const key = (e: React.KeyboardEvent, n: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(n === 5 ? 1 : n + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(n === 1 ? 5 : n - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(1) }
    else if (e.key === 'End') { e.preventDefault(); move(5) }
  }

  return (
    <div className="field" role="radiogroup" aria-labelledby={id}>
      <span id={id} className={visibleLabel ? undefined : 'sr-only'}>{label}</span>
      <div className="row five">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" className="btn btn-big" ref={(el) => { refs.current[n - 1] = el }}
            aria-checked={value === n} aria-label={`${n} of 5`} tabIndex={n === tabStop ? 0 : -1}
            onClick={() => onChange(n)} onKeyDown={(e) => key(e, n)}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

/** Kept under its old name: the end-of-session and match forms use it. */
export const ScaleButtons = RadioScale
