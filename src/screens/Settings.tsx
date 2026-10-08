// Settings and Help (spec 5): every change is saved the moment it is made and takes effect straight away.
import { useState } from 'react'
import { useApp } from '../appState'
import { ChoiceRow } from '../components/ChoiceRow'
import { EditorShell } from '../components/EditorShell'
import { Stepper } from '../components/Stepper'
import { CONTENT_VERSION } from '../content/builtinContent'
import { SCHEMA_VERSION } from '../db/migrations'
import type { Theme } from '../db/types'
import { APP_VERSION } from '../lib/appInfo'
import { SUMMARY_WEEK_CHOICES } from '../lib/export/summary'
import { audioSupported, beep, primeAudio, vibrate, vibrationSupported } from '../lib/alerts'

export const MIN_WEEKLY_TARGET = 1
export const MAX_WEEKLY_TARGET = 14
export const REMINDER_CHOICES = [7, 14, 30, 60]

const ON_OFF = [{ value: true, label: 'On' }, { value: false, label: 'Off' }]

export function SettingsScreen() {
  const { settings, updateSetting } = useApp()
  const [saved, setSaved] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // The target is tracked here too, so two quick taps on +1 count twice even before the first save has finished.
  const [target, setTarget] = useState(settings.weeklyTarget)

  async function save(patch: Parameters<typeof updateSetting>[0], what: string) {
    try {
      await updateSetting(patch)
      setProblem(null)
      setSaved(what)
    } catch (e) {
      setSaved(null)
      setProblem(`That change could not be saved (${e instanceof Error ? e.message : String(e)}).`)
    }
  }

  // A reminder value that came from a restored file may not be one of the usual choices: still show it.
  const reminderValues = REMINDER_CHOICES.includes(settings.backupReminderDays) ? REMINDER_CHOICES : [...REMINDER_CHOICES, settings.backupReminderDays].sort((a, b) => a - b)
  const summaryValues: number[] = SUMMARY_WEEK_CHOICES.includes(settings.summaryWeeks as 2 | 4 | 8) ? [...SUMMARY_WEEK_CHOICES] : [...SUMMARY_WEEK_CHOICES, settings.summaryWeeks].sort((a, b) => a - b)

  return (
    <EditorShell title="Settings and help">
      <p className="muted" role="status" aria-live="polite">{problem ? '' : saved ? `Saved: ${saved}.` : 'Changes are saved as soon as you make them.'}</p>
      {problem && <p className="error" role="alert">{problem}</p>}

      <div className="card" role="region" aria-label="Training settings">
        <h2>Training</h2>
        <Stepper
          label="Weekly target (robot sessions)" value={target}
          min={MIN_WEEKLY_TARGET} max={MAX_WEEKLY_TARGET}
          onChange={(d) => {
            const next = Math.min(MAX_WEEKLY_TARGET, Math.max(MIN_WEEKLY_TARGET, target + d))
            setTarget(next)
            void save({ weeklyTarget: next }, 'weekly target')
          }}
        />
        <ChoiceRow<Theme>
          label="Theme" value={settings.theme}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          onChange={(theme) => { void save({ theme }, 'theme') }}
        />
      </div>

      <div className="card" role="region" aria-label="Timer settings">
        <h2>Drill timer</h2>
        <ChoiceRow<boolean> label="Timer sound" hint="A beep when a drill timer reaches zero." value={settings.timerSound} options={ON_OFF} onChange={(timerSound) => { void save({ timerSound }, 'timer sound') }} />
        <ChoiceRow<boolean> label="Timer vibration" hint="The phone vibrates when a drill timer reaches zero." value={settings.timerVibrate} options={ON_OFF} onChange={(timerVibrate) => { void save({ timerVibrate }, 'timer vibration') }} />
        <div className="row">
          <button type="button" className="btn" onClick={() => { primeAudio(); beep() }} disabled={!audioSupported()}>Test sound</button>
          <button type="button" className="btn" onClick={() => vibrate()} disabled={!vibrationSupported()}>Test vibration</button>
        </div>
        {(!audioSupported() || !vibrationSupported()) && (
          <p className="muted">This browser cannot {!audioSupported() && !vibrationSupported() ? 'play sounds or vibrate' : !audioSupported() ? 'play sounds' : 'vibrate'}, so that alert will stay silent.</p>
        )}
      </div>

      <div className="card" role="region" aria-label="Backup and summary settings">
        <h2>Backup and summary</h2>
        <ChoiceRow<number>
          label="Remind me to back up after (days)" hint="The Home screen shows a reminder when your last backup is older than this and you have logged something new since."
          value={settings.backupReminderDays} options={reminderValues.map((d) => ({ value: d, label: String(d), ariaLabel: `${d} days` }))}
          onChange={(backupReminderDays) => { void save({ backupReminderDays, backupSnoozedUntil: undefined }, 'backup reminder') }}
        />
        <ChoiceRow<number>
          label="Summary length (weeks)" hint="How far back Copy summary for Claude looks."
          value={settings.summaryWeeks} options={summaryValues.map((w) => ({ value: w, label: String(w), ariaLabel: `${w} weeks` }))}
          onChange={(summaryWeeks) => { void save({ summaryWeeks }, 'summary length') }}
        />
      </div>

      <div className="card" role="region" aria-label="Install guide">
        <h2>Install on your phone</h2>
        <p>Do this once, in Chrome on your Android phone, at the address you will keep using:</p>
        <ol className="plain">
          <li>Tap the three-dot menu at the top right of Chrome.</li>
          <li>Tap <strong>Install app</strong>. On some phones it says <strong>Add to Home screen</strong> instead.</li>
          <li>Tap <strong>Install</strong> to confirm. Loop Lab appears on your home screen and opens full screen, like any other app.</li>
        </ol>
        <p className="muted">Your data is tied to the web address. If the address ever changes, make a backup first and restore it at the new address. iPhone: the app works in Safari, but installing it is not supported here.</p>
      </div>

      <div className="card" role="region" aria-label="What is stored where">
        <h2>What is stored where</h2>
        <ul className="guide-points">
          <li><strong>Everything stays on this phone.</strong> Sessions, matches, drills, programs and settings are saved in Chrome's storage for this app. There is no account, no server and no tracking.</li>
          <li><strong>Only things you start leave the phone:</strong> exporting a CSV, sharing files, copying the summary, and making a backup. Nothing is sent automatically.</li>
          <li>Opponent names appear only in the matches CSV and in backups. They are never in the summary you copy for Claude.</li>
          <li>The app's own files are saved in the browser too, so Loop Lab opens without a signal.</li>
          <li><strong>Clearing Chrome's site data for this app, or uninstalling it, deletes everything</strong> unless you have a backup saved somewhere else. Back up now and then, and keep a copy off the phone.</li>
        </ul>
      </div>

      <div className="card" role="region" aria-label="About">
        <h2>About</h2>
        <p className="muted">Loop Lab version {APP_VERSION}. Data format {SCHEMA_VERSION}. Built-in content version {CONTENT_VERSION}.</p>
      </div>
    </EditorShell>
  )
}
