// A labelled row of mutually exclusive choices (theme, on/off, 2/4/8 weeks). Each button is 48 px tall and says which is chosen.
import { useId } from 'react'

export function ChoiceRow<T extends string | number | boolean>({ label, hint, value, options, onChange }: {
  label: string
  hint?: string
  value: T
  options: Array<{ value: T; label: string; ariaLabel?: string }>
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="choice" role="group" aria-labelledby={id}>
      <span id={id} className="choice-label">{label}</span>
      {hint && <span className="muted choice-hint">{hint}</span>}
      <div className="row">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="btn choice-btn" aria-label={o.ariaLabel} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}
