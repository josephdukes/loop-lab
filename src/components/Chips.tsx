import { CATEGORIES } from '../content/builtinContent'

/** Category filter chips: "All" plus the seven categories. */
export function CategoryChips({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="chips" role="group" aria-label="Filter by category">
      <button type="button" className="chip" aria-pressed={value === null} onClick={() => onChange(null)}>All</button>
      {CATEGORIES.map((c) => (
        <button key={c} type="button" className="chip" aria-pressed={value === c} onClick={() => onChange(value === c ? null : c)}>{c}</button>
      ))}
    </div>
  )
}
