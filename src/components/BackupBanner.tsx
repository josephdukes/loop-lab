// Home banner (spec 5): last backup older than the reminder period AND new data since. "Remind me later" hides it for 2 days.
import { useApp } from '../appState'
import { DAY_MS, SNOOZE_DAYS, backupBannerDue, loadDataTimestamps } from '../lib/backup/backupBanner'
import { daysAgoText, longDate } from '../lib/format'
import { useAsync } from '../hooks/useAsync'
import { useNav } from '../nav'

export function BackupBanner() {
  const { db, settings, updateSetting } = useApp()
  const { openData } = useNav()
  const stamps = useAsync(() => loadDataTimestamps(db), [db, settings.lastBackupAt])
  // While loading, or if the check fails, show nothing: this banner is a reminder, not a feature that may get in the way.
  if (stamps.status !== 'ready') return null
  const now = new Date()
  const due = backupBannerDue({
    now, lastBackupAt: settings.lastBackupAt, reminderDays: settings.backupReminderDays, snoozedUntil: settings.backupSnoozedUntil, ...stamps.data,
  })
  if (!due) return null
  const since = settings.lastBackupAt
    ? `Your last backup was ${daysAgoText(settings.lastBackupAt, now)} (${longDate(settings.lastBackupAt)}). Anything you have logged since then exists only on this phone.`
    : 'You have never made a backup. Everything you have logged exists only on this phone.'
  return (
    <div className="card banner" role="region" aria-label="Backup reminder">
      <h2>Time to back up</h2>
      <p>{since}</p>
      <div className="stack">
        <button type="button" className="btn btn-primary" onClick={() => openData('backup')}>Back up now</button>
        <button
          type="button" className="btn"
          onClick={() => { void updateSetting({ backupSnoozedUntil: new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString() }) }}
        >Remind me later</button>
      </div>
      <p className="muted">Remind me later hides this for {SNOOZE_DAYS} days.</p>
    </div>
  )
}
