// Duplicate / Edit / Reset to original / Archive / Restore / Delete for a library item (spec 3.9, 5 Builders).
import { useState } from 'react'
import { useApp } from '../appState'
import type { Drill, Program, SessionTemplate } from '../db/types'
import { deleteOrArchive, duplicateItem, KIND_LABEL, resetToOriginal, setArchived, type LibraryKind } from '../lib/libraryService'
import { ConfirmDialog } from './ConfirmDialog'

type Item = Drill | SessionTemplate | Program

export function ItemActions({ kind, item, onEdit, onDuplicated, onDeleted }: {
  kind: LibraryKind
  item: Item
  onEdit: () => void
  /** Called with the new id after Duplicate, so the screen can open it. */
  onDuplicated?: (id: string) => void
  /** Called after a permanent delete, so a detail screen can go back to its list. */
  onDeleted?: () => void
}) {
  const { db, notifyDataChanged } = useApp()
  const [confirm, setConfirm] = useState<null | 'reset' | 'archive' | 'delete'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const noun = KIND_LABEL[kind]
  const label = (verb: string) => `${verb} ${noun}: ${item.name}`

  const run = async (fn: () => Promise<string | void>) => {
    setError(null)
    setMessage(null)
    try {
      const m = await fn()
      if (m) setMessage(m)
      notifyDataChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="item-actions">
      <div className="row">
        {!item.archived && <button type="button" className="btn" aria-label={label('Edit')} onClick={onEdit}>Edit</button>}
        <button
          type="button" className="btn" aria-label={label('Duplicate')}
          onClick={() => run(async () => { const id = await duplicateItem(db, kind, item.id); onDuplicated?.(id); return `Duplicated as "Copy of ${item.name}".` })}
        >Duplicate</button>
        {item.isBuiltIn && item.modifiedByUser && <button type="button" className="btn" aria-label={label('Reset to original')} onClick={() => setConfirm('reset')}>Reset to original</button>}
        {item.archived
          ? <button type="button" className="btn" aria-label={label('Restore')} onClick={() => run(async () => { await setArchived(db, kind, item.id, false); return 'Restored.' })}>Restore</button>
          : <button type="button" className="btn" aria-label={label('Archive')} onClick={() => setConfirm('archive')}>Archive</button>}
        {!item.isBuiltIn && <button type="button" className="btn btn-danger" aria-label={label('Delete')} onClick={() => setConfirm('delete')}>Delete</button>}
      </div>
      {message && <p role="status" className="muted">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {confirm === 'reset' && (
        <ConfirmDialog
          title="Reset to original?" message={`Your changes to "${item.name}" will be replaced by the built-in version.`} confirmLabel="Reset"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); void run(async () => { await resetToOriginal(db, kind, item.id); return 'Reset to the original.' }) }}
        />
      )}
      {confirm === 'archive' && (
        <ConfirmDialog
          title={`Archive this ${noun}?`} message="It will be hidden from the library. Your logs keep their history. Use Show archived to restore it." confirmLabel="Archive"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); void run(async () => { await setArchived(db, kind, item.id, true); return 'Archived.' }) }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title={`Delete this ${noun}?`} danger confirmLabel="Delete"
          message="If nothing in your history uses it, it is deleted for good. If it is used by a log, a session or a program, it is archived instead so history stays readable."
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); void run(async () => {
            if ((await deleteOrArchive(db, kind, item.id)) === 'deleted') { onDeleted?.(); return 'Deleted.' }
            return 'It is used elsewhere, so it was archived instead.'
          }) }}
        />
      )}
    </div>
  )
}
