import { useEffect, useState } from 'react'
import { useApp } from '../../appState'
import { daysAgoText, longDateTime } from '../../lib/format'
import { describeStorage, readStorageStatus, type StorageStatus } from '../../lib/storage'

export function StorageCard() {
  const { settings } = useApp()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  useEffect(() => {
    readStorageStatus().then(setStatus, () => setStatus({ persistence: 'unsupported' }))
  }, [])
  const text = status ? describeStorage(status) : null
  const last = settings.lastBackupAt
  return (
    <div className="card" role="region" aria-label="Backup and storage status">
      <h2>Where your data lives</h2>
      <p>
        <strong>Last backup:</strong>{' '}
        {last ? `${longDateTime(last)} (${daysAgoText(last)})` : 'never. There is no copy of your data anywhere except this phone.'}
      </p>
      <p>{text ? text.persistence : 'Checking storage'}</p>
      <p>{text ? text.used : ''}</p>
      <p className="warning">
        <strong>Warning:</strong> if you clear Chrome's site data for this app (or uninstall it), everything is deleted for good unless you have a backup saved somewhere else.
      </p>
    </div>
  )
}
