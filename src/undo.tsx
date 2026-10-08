// App-wide Undo bar: each delete can be undone for 8 seconds (spec 5). Several pending deletes form a stack; Undo restores the newest.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export const UNDO_MS = 8000

interface UndoItem { message: string; onUndo: () => void | Promise<void> }
interface UndoApi { showUndo: (item: UndoItem) => void }

const Ctx = createContext<UndoApi | null>(null)

export function useUndo(): UndoApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUndo must be used inside <UndoProvider>')
  return v
}

export function UndoProvider({ children, durationMs = UNDO_MS }: { children: ReactNode; durationMs?: number }) {
  // A stack of pending undo items, newest last. Each item keeps its own expiry timer.
  const [items, setItems] = useState<(UndoItem & { id: number })[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  const idRef = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const drop = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setItems((cur) => cur.filter((i) => i.id !== id))
  }, [])

  const showUndo = useCallback((i: UndoItem) => {
    const id = ++idRef.current
    setFailed(null)
    setItems((cur) => [...cur, { ...i, id }])
    timers.current.set(id, setTimeout(() => drop(id), durationMs))
  }, [drop, durationMs])
  const api = useMemo(() => ({ showUndo }), [showUndo])

  useEffect(() => {
    const t = timers.current
    return () => { t.forEach((x) => clearTimeout(x)); t.clear() }
  }, [])

  const newest = items[items.length - 1]
  const undo = async () => {
    if (!newest) return
    drop(newest.id)
    try { await newest.onUndo() } catch (e) { setFailed(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {newest && (
        <div className="toast undo-bar" role="status" aria-live="polite">
          <span>{newest.message}{items.length > 1 ? ` (${items.length} deletions can be undone)` : ''}</span>
          <button type="button" className="btn btn-primary" onClick={undo}>{items.length > 1 ? `Undo (${items.length})` : 'Undo'}</button>
        </div>
      )}
      {failed && (
        <div className="toast" role="alert">
          <span>Could not undo: {failed}</span>
          <button type="button" className="btn" onClick={() => setFailed(null)}>Close</button>
        </div>
      )}
    </Ctx.Provider>
  )
}
