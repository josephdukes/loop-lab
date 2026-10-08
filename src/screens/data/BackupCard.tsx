import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../appState'
import { Status, type StatusMessage } from '../../components/Status'
import { performBackup, shareSupportedForBackup, type BackupOutcome } from '../../lib/backup/backupActions'

function describe(o: BackupOutcome): StatusMessage {
  switch (o.kind) {
    case 'downloaded': return { kind: 'ok', text: `Saved ${o.filename} to this phone's downloads. Now put a copy somewhere off the phone, such as Google Drive or an email to yourself.` }
    case 'shared': return { kind: 'ok', text: `Shared ${o.filename}. The backup date has been recorded.` }
    case 'cancelled': return { kind: 'info', text: 'Sharing was cancelled, so no backup was recorded. Tap Back up now to try again.' }
  }
}

export function BackupCard({ focusOnOpen }: { focusOnOpen: boolean }) {
  const { db, refreshSettings } = useApp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<StatusMessage>(null)
  const canShare = shareSupportedForBackup()
  const card = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!focusOnOpen) return
    card.current?.scrollIntoView?.({ block: 'center' })
    button.current?.focus()
  }, [focusOnOpen])

  async function run(prefer: 'share' | 'download') {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(describe(await performBackup(db, prefer)))
      await refreshSettings()
    } catch (e) {
      setMessage({ kind: 'error', text: `The backup could not be made (${e instanceof Error ? e.message : String(e)}). Your data has not been changed.` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" ref={card} role="region" aria-label="Backup">
      <h2>Backup (JSON)</h2>
      <p className="muted">One file with everything: sessions, matches, your drills and programs, and settings. Keep a copy off the phone.</p>
      <div className="stack">
        <button type="button" className="btn btn-big btn-primary" ref={button} disabled={busy} onClick={() => run(canShare ? 'share' : 'download')}>
          {busy ? 'Making backup' : canShare ? 'Back up now (share)' : 'Back up now (download)'}
        </button>
        {canShare && <button type="button" className="btn" disabled={busy} onClick={() => run('download')}>Save a copy to this phone instead</button>}
      </div>
      <Status message={message} />
    </div>
  )
}
