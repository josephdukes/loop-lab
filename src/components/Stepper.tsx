// A big +1 / -1 counter (spec 5, labels on counters). The value is an ARIA spin button, so a screen reader hears
// "Hits, spin button, 3" and can use its increase/decrease actions; the arrow keys work too. A polite live region
// announces the new value after it changes (not when the screen first appears).
import { useEffect, useId, useRef, useState } from 'react'

export function Stepper({ label, value, onChange, disableMinus, disablePlus, min = 0, max }: {
  label: string
  value: number
  onChange: (delta: number) => void
  disableMinus?: boolean
  disablePlus?: boolean
  min?: number
  max?: number
}) {
  const id = useId()
  const minusOff = disableMinus ?? value <= min
  const plusOff = disablePlus ?? (max !== undefined && value >= max)
  const [announcement, setAnnouncement] = useState('')
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current !== value) { previous.current = value; setAnnouncement(`${label} ${value}`) }
  }, [value, label])

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); if (!plusOff) onChange(1) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); if (!minusOff) onChange(-1) }
  }

  return (
    <div className="stepper">
      <span id={id} className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="btn step-btn" aria-label={`${label} minus 1`} disabled={minusOff} onClick={() => onChange(-1)}>-1</button>
        <div
          className="stepper-value" role="spinbutton" tabIndex={0} aria-labelledby={id}
          aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} onKeyDown={key}
        >{value}</div>
        <button type="button" className="btn step-btn" aria-label={`${label} plus 1`} disabled={plusOff} onClick={() => onChange(1)}>+1</button>
      </div>
      <span className="sr-only" role="status">{announcement}</span>
    </div>
  )
}
