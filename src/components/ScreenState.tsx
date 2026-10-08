import type { ReactNode } from 'react'
import type { Async } from '../hooks/useAsync'

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <p className="muted state-loading" role="status">{label}</p>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" role="alert">
      <h2>Something went wrong</h2>
      <p className="error">{message}</p>
      <p className="muted">Your saved data has not been changed.</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Renders the loading, error or ready state of a useAsync result. */
export function AsyncView<T>({ state, children }: { state: Async<T> & { reload: () => void }; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox message={state.message} onRetry={state.reload} />
  return <>{children(state.data)}</>
}
