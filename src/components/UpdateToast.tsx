export function UpdateToast({ onReload, onDismiss }: { onReload: () => void; onDismiss: () => void }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>Update ready: reload</span>
      <button type="button" className="btn btn-primary" onClick={onReload}>Reload</button>
      <button type="button" className="btn" onClick={onDismiss}>Later</button>
    </div>
  )
}
