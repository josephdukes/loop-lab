// Persistent-storage helpers. Everything is feature-detected and fails quietly.

export type PersistenceStatus = 'granted' | 'not-granted' | 'unsupported'

export interface StorageStatus {
  persistence: PersistenceStatus
  usageBytes?: number
  quotaBytes?: number
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  const status: StorageStatus = { persistence: 'unsupported' }
  if (!storage) return status
  try {
    if (typeof storage.persisted === 'function') {
      status.persistence = (await storage.persisted()) ? 'granted' : 'not-granted'
    }
  } catch { /* ignore */ }
  try {
    if (typeof storage.estimate === 'function') {
      const est = await storage.estimate()
      status.usageBytes = est.usage
      status.quotaBytes = est.quota
    }
  } catch { /* ignore */ }
  return status
}

/**
 * Asks the browser to keep this app's data. It is a request, not a guarantee.
 * Stage 2 calls this once after the first saved session. Nothing calls it in stage 1.
 */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      return (await navigator.storage.persist()) ? 'granted' : 'not-granted'
    }
  } catch { /* ignore */ }
  return 'unsupported'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function describeStorage(s: StorageStatus): { persistence: string; used: string } {
  const persistence =
    s.persistence === 'granted'
      ? 'Persistent storage: granted (the browser has agreed not to clear this data automatically).'
      : s.persistence === 'not-granted'
        ? 'Persistent storage: not granted yet. This is a request to the browser, not a guarantee.'
        : 'Persistent storage: not available in this browser.'
  const used =
    s.usageBytes !== undefined
      ? `Approximate storage used: ${formatBytes(s.usageBytes)}.`
      : 'Approximate storage used: not available in this browser.'
  return { persistence, used }
}
