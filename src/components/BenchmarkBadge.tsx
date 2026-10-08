// Green plus check for "met", amber plus clock for "not yet": never colour alone (spec 1).
export function BenchmarkBadge({ status }: { status: 'met' | 'not_met' | 'no_data' | boolean | null | undefined }) {
  if (status === null || status === undefined) return null
  const met = status === true || status === 'met'
  const label = met ? 'Met' : status === 'no_data' ? 'Not yet (no results)' : 'Not yet'
  return (
    <span className={met ? 'badge badge-met' : 'badge badge-notyet'}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        {met ? (
          <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>
        )}
      </svg>
      {label}
    </span>
  )
}
