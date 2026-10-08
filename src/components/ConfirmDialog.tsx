// Modal confirmation. Focus moves in (to the safe button), Tab stays inside, Escape and the Back button cancel,
// the page behind is made inert, and focus returns to what had it before.
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { inertExcept, trapTab } from '../lib/focus'
import { useBackInterceptor } from '../navContext'

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const messageId = useId()
  useBackInterceptor(true, onCancel)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const undo = backdrop.current ? inertExcept(backdrop.current) : () => {}
    cancelRef.current?.focus()
    return () => {
      undo()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const content = (
    <div className="dialog-backdrop" ref={backdrop}>
      <div
        className="dialog" ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return }
          if (dialog.current) trapTab(e, dialog.current)
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="row">
          <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

