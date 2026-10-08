import { useEffect, useState } from 'react'
import { useApp } from '../appState'

export type Async<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/**
 * Runs an async loader and reloads it whenever `deps` change or the app signals new data.
 * Keeps showing the previous data while reloading, so screens do not flash.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> & { reload: () => void } {
  const { dataVersion } = useApp()
  const [state, setState] = useState<Async<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => { if (!cancelled) setState({ status: 'ready', data }) },
      (e) => { if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }) },
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dataVersion, tick])

  return { ...state, reload: () => { setState({ status: 'loading' }); setTick((n) => n + 1) } }
}
