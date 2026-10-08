// Error boundaries: a crash in one screen shows a plain message instead of a blank page.
import { Component, lazy, Suspense, type ComponentProps, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { Loading } from './ScreenState'

interface Props {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
  /** When this value changes the boundary tries again (for example when Joe goes to a different tab). */
  resetKey?: string
  onReset?: () => void
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is sent anywhere. The console line is for someone debugging with the browser tools.
    console.error('Loop Lab screen error:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children
  }
}

/** Whole-app safety net: a plain-English message and a Reload button. Reloading never deletes anything stored on the phone. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <main className="screen error-screen" role="alert">
          <h1>Loop Lab hit a problem</h1>
          <p>Something went wrong while showing this screen.</p>
          <p className="muted">Your data is stored safely on this phone and was not changed by this. If you were part way through a session, it was saved as you went: Home will offer to resume it.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <details className="mb">
            <summary>Technical detail (for support)</summary>
            <p className="muted">{error.message}</p>
          </details>
        </main>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RetryableLazy<C extends ComponentType<any>> = ((props: ComponentProps<C>) => ReactNode) & { retry: () => void }

/** React.lazy that can try again after a failed load (for example the first time the phone is offline). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<C extends ComponentType<any>>(factory: () => Promise<{ default: C }>): RetryableLazy<C> {
  let Inner = lazy(factory)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Screen = ((props: ComponentProps<C>) => <Inner {...(props as any)} />) as RetryableLazy<C>
  Screen.retry = () => { Inner = lazy(factory) }
  return Screen
}

/** Wraps a lazy screen: a loading state while it arrives, and a retry card if it cannot be loaded. */
export function LazyBoundary({ name, children, resetKey, retry, loading }: { name: string; children: ReactNode; resetKey: string; retry?: () => void; loading?: ReactNode }) {
  return (
    <ErrorBoundary
      resetKey={resetKey}
      onReset={retry}
      fallback={(_, reset) => (
        <div className="card" role="alert">
          <h1>{name} could not be opened</h1>
          <p className="muted">The screen did not load. Your data is safe. If you have just updated the app and are offline, connect once and try again.</p>
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        </div>
      )}
    >
      <Suspense fallback={loading ?? <><h1>{name}</h1><Loading label={`Loading ${name}`} /></>}>{children}</Suspense>
    </ErrorBoundary>
  )
}
