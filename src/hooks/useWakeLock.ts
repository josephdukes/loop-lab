import { useEffect, useState } from 'react'

export type WakeLockStatus = 'pending' | 'active' | 'unsupported' | 'denied'

interface Sentinel { release(): Promise<void>; addEventListener(type: 'release', cb: () => void): void }

/** Keeps the screen awake while mounted. Feature-detected; re-acquires after the tab becomes visible again. */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('pending')

  useEffect(() => {
    if (!enabled) return
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') {
      setStatus('unsupported')
      return
    }
    let sentinel: Sentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request('screen')
        if (cancelled) { void s.release().catch(() => {}); return }
        void sentinel?.release().catch(() => {})
        sentinel = s
        setStatus('active')
        s.addEventListener('release', () => { if (!cancelled) setStatus('pending') })
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire() } // the browser drops the lock when the page is hidden
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [enabled])

  return status
}
