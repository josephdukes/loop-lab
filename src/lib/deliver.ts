// Getting files and text OUT of the app: download, the Web Share API, and the clipboard.
// Everything is feature-detected. Nothing here sends data anywhere except to what Joe chooses (the browser's download
// folder, the phone's share sheet, or the clipboard).

/** Starts a browser download of a file. Throws if the browser cannot do it. */
export function downloadFile(file: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('This browser cannot save files from the app.')
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser time to start the download before the temporary address is released.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported'

/** True only if this browser can share these files through the system share sheet. */
export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

/**
 * Opens the share sheet with the files. 'cancelled' means the person closed the sheet, which must NOT be treated as a
 * completed backup. Other failures are thrown.
 */
export async function shareFiles(files: File[], title: string): Promise<ShareOutcome> {
  if (!canShareFiles(files)) return 'unsupported'
  try {
    await navigator.share({ files, title })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    throw e
  }
}

export type CopyOutcome = 'copied' | 'blocked'

/** Copies text with the Clipboard API. 'blocked' means the caller should show the text selected so it can be copied by hand. */
export async function copyText(text: string): Promise<CopyOutcome> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch { /* fall through to blocked */ }
  return 'blocked'
}

export function textFile(text: string, filename: string, type: string): File {
  return new File([text], filename, { type })
}
