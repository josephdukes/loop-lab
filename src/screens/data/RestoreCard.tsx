import { useRef, useState } from 'react'
import { useApp } from '../../appState'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { BACKUP_MAX_BYTES } from '../../lib/appInfo'
import { performBackup } from '../../lib/backup/backupActions'
import { RestoreError, commitRestore, type RestoreMode, type RestoreResult } from '../../lib/backup/restoreCommit'
import { NOTHING_CHANGED, validateBackupText, type RestorePreview, type ValidBackup } from '../../lib/backup/restoreValidate'
import { STORE_LABEL, STORE_NAMES, readAllStores, type StoreName } from '../../lib/backup/stores'
import { longDate, longDateTime } from '../../lib/format'

type Stage =
  | { kind: 'idle' }
  | { kind: 'checking'; name: string }
  | { kind: 'refused'; name: string; message: string }
  | { kind: 'preview'; name: string; backup: ValidBackup; preview: RestorePreview; current: Record<StoreName, number> }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; result: RestoreResult }

const nothingRestoredNote = 'Nothing was changed.'

export function RestoreCard() {
  const { db, refreshSettings, notifyDataChanged } = useApp()
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [confirming, setConfirming] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setMode('merge')
    setStage({ kind: 'checking', name: file.name })
    try {
      if (file.size >= BACKUP_MAX_BYTES) {
        // Refused without reading the file.
        const r = validateBackupText('', { sizeBytes: file.size })
        setStage({ kind: 'refused', name: file.name, message: r.ok ? NOTHING_CHANGED : r.message })
        return
      }
      const text = await file.text()
      const result = validateBackupText(text, { sizeBytes: file.size })
      if (!result.ok) { setStage({ kind: 'refused', name: file.name, message: result.message }); return }
      const current = await readCounts()
      setStage({ kind: 'preview', name: file.name, backup: result.backup, preview: result.preview, current })
    } catch (e) {
      setStage({ kind: 'refused', name: file.name, message: `The file could not be read (${e instanceof Error ? e.message : String(e)}). ${NOTHING_CHANGED}` })
    } finally {
      if (input.current) input.current.value = '' // so choosing the same file again works
    }
  }

  async function readCounts(): Promise<Record<StoreName, number>> {
    const s = await readAllStores(db)
    return Object.fromEntries(STORE_NAMES.map((n) => [n, s[n].length])) as Record<StoreName, number>
  }

  async function run(backup: ValidBackup, chosen: RestoreMode) {
    setConfirming(false)
    setStage({ kind: 'working' })
    try {
      const result = await commitRestore(db, backup, chosen, {
        // Replace: the safety backup is a download of everything currently on the phone.
        safetyBackup: async () => { await performBackup(db, 'download') },
      })
      await refreshSettings()
      notifyDataChanged()
      setStage({ kind: 'done', result })
    } catch (e) {
      const message = e instanceof RestoreError ? e.message : `The restore failed (${e instanceof Error ? e.message : String(e)}). ${nothingRestoredNote}`
      setStage({ kind: 'failed', message })
    }
  }

  return (
    <div className="card" role="region" aria-label="Restore">
      <h2>Restore from a backup</h2>
      <p className="muted">Choose a Loop Lab backup file (loop-lab-backup-....json). You will see what is inside before anything changes.</p>
      <input
        ref={input} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Backup file to restore"
        onChange={(e) => { void onFile(e.target.files?.[0]) }}
      />
      <button type="button" className="btn btn-big" disabled={stage.kind === 'checking' || stage.kind === 'working'} onClick={() => input.current?.click()}>Choose backup file</button>

      {stage.kind === 'checking' && <p className="muted" role="status">Checking {stage.name}</p>}
      {stage.kind === 'refused' && (
        <div className="card form-errors restore-refused" role="alert">
          <h3>This file was not restored</h3>
          <p>{stage.message}</p>
          <p className="muted">File: {stage.name}</p>
        </div>
      )}
      {stage.kind === 'failed' && (
        <div className="card form-errors" role="alert">
          <h3>The restore did not happen</h3>
          <p>{stage.message}</p>
        </div>
      )}
      {stage.kind === 'working' && <p role="status">Restoring. Please keep this screen open.</p>}
      {stage.kind === 'preview' && (
        <PreviewCard
          stage={stage} mode={mode} onMode={setMode}
          onRestore={() => (mode === 'replace' ? setConfirming(true) : void run(stage.backup, 'merge'))}
          onCancel={() => setStage({ kind: 'idle' })}
        />
      )}
      {stage.kind === 'done' && <ResultCard result={stage.result} onClose={() => setStage({ kind: 'idle' })} />}

      {confirming && stage.kind === 'preview' && (
        <ConfirmDialog
          title="Replace everything on this phone?"
          message={`This deletes everything now on this phone (${stage.current.sessionLogs} sessions, ${stage.current.matchLogs} matches, and your drills, programs and settings) and puts the backup's data in their place. A backup of your current data will be downloaded first. If that download fails, nothing is replaced.`}
          confirmLabel="Download backup, then replace"
          cancelLabel="Keep my data"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => { void run(stage.backup, 'replace') }}
        />
      )}
    </div>
  )
}

function PreviewCard({ stage, mode, onMode, onRestore, onCancel }: {
  stage: Extract<Stage, { kind: 'preview' }>
  mode: RestoreMode
  onMode: (m: RestoreMode) => void
  onRestore: () => void
  onCancel: () => void
}) {
  const p = stage.preview
  return (
    <div className="card preview" role="region" aria-label="Backup preview">
      <h3>What is in {stage.name}</h3>
      <dl className="preview-meta">
        <div><dt>Backed up on</dt><dd>{longDateTime(p.exportedAt)}</dd></div>
        <div><dt>App version</dt><dd>{p.appVersion}</dd></div>
        <div><dt>Sessions and matches from</dt><dd>{p.dateFrom && p.dateTo ? `${longDate(p.dateFrom + 'T12:00:00')} to ${longDate(p.dateTo + 'T12:00:00')}` : 'no dated records'}</dd></div>
      </dl>
      {p.migratedFrom !== undefined && <p className="muted">This file was made by an older version (format {p.migratedFrom}) and has been brought up to date.</p>}
      <table className="stat-table">
        <thead><tr><th scope="col">Records in the file</th><th scope="col" className="n">File</th><th scope="col" className="n">On this phone now</th></tr></thead>
        <tbody>
          {STORE_NAMES.map((n) => (
            <tr key={n}>
              <td>{STORE_LABEL[n]}{n === 'activeSession' ? ' (never restored)' : ''}</td>
              <td className="n">{p.counts[n]}</td>
              <td className="n">{stage.current[n]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="choice" role="radiogroup" aria-label="How to restore">
        <label className={`radio-card${mode === 'merge' ? ' selected' : ''}`}>
          <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => onMode('merge')} />
          <span><strong>Merge (recommended)</strong><br />Adds what is missing and updates anything the backup has a newer copy of. Nothing is deleted.</span>
        </label>
        <label className={`radio-card${mode === 'replace' ? ' selected' : ''}`}>
          <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => onMode('replace')} />
          <span><strong>Replace</strong><br />Deletes everything on this phone first, so it ends up exactly like the backup. A backup of your current data is downloaded before anything is deleted.</span>
        </label>
      </div>
      {mode === 'replace' && <p className="warning">Replace deletes data. You will be asked to confirm.</p>}
      <div className="row">
        <button type="button" className={mode === 'replace' ? 'btn btn-danger' : 'btn btn-primary'} onClick={onRestore}>
          {mode === 'replace' ? 'Replace my data...' : 'Merge backup into this phone'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function ResultCard({ result, onClose }: { result: RestoreResult; onClose: () => void }) {
  return (
    <div className="card banner-ok" role="region" aria-label="Restore result">
      <h3>Restore finished ({result.mode === 'merge' ? 'Merge' : 'Replace'})</h3>
      <p>
        <strong>{result.added}</strong> added, <strong>{result.updated}</strong> updated, <strong>{result.unchanged}</strong> unchanged.
        {result.mode === 'replace' && <> {result.removed} old records were removed first.</>}
      </p>
      <table className="stat-table">
        <thead><tr><th scope="col">Records</th><th scope="col" className="n">Added</th><th scope="col" className="n">Updated</th><th scope="col" className="n">Unchanged</th></tr></thead>
        <tbody>
          {STORE_NAMES.filter((n) => n !== 'activeSession').map((n) => (
            <tr key={n}><td>{STORE_LABEL[n]}</td><td className="n">{result.perStore[n].added}</td><td className="n">{result.perStore[n].updated}</td><td className="n">{result.perStore[n].unchanged}</td></tr>
          ))}
        </tbody>
      </table>
      {result.seeded && <p className="muted">Built-in drills, sessions and programs were checked and brought up to date.</p>}
      {result.seedWarning && <p className="error" role="alert">{result.seedWarning}</p>}
      <button type="button" className="btn" onClick={onClose}>Done</button>
    </div>
  )
}
