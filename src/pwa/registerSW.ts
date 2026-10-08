// Service worker registration. The page is NEVER reloaded automatically: when a new version is
// ready we only tell the UI, and the user taps "Reload" (which calls the returned `applyUpdate`).
import { registerSW } from 'virtual:pwa-register'

export interface PwaHandle {
  /** Activates the waiting service worker and reloads the page. Only call from a user tap. */
  applyUpdate: () => void
}

export function startServiceWorker(onUpdateReady: () => void, onOfflineReady?: () => void): PwaHandle {
  let update: ((reloadPage?: boolean) => Promise<void>) | undefined
  try {
    update = registerSW({
      immediate: true,
      onNeedRefresh: onUpdateReady,
      onOfflineReady,
      onRegisterError: () => { /* fail quietly: the app still works without a service worker */ },
    })
  } catch { /* ignore */ }
  return { applyUpdate: () => { void update?.(true) } }
}
