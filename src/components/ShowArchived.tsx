export function ShowArchived({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="btn" aria-pressed={value} onClick={() => onChange(!value)}>
      {value ? 'Hide archived' : 'Show archived'}
    </button>
  )
}
