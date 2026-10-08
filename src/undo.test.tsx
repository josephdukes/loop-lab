// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_MS, UndoProvider, useUndo } from './undo'

function Trigger({ restored }: { restored: string[] }) {
  const { showUndo } = useUndo()
  return (
    <>
      <button onClick={() => showUndo({ message: 'A deleted.', onUndo: () => { restored.push('A') } })}>del A</button>
      <button onClick={() => showUndo({ message: 'B deleted.', onUndo: () => { restored.push('B') } })}>del B</button>
    </>
  )
}

describe('Undo queue (Finding 2)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  const setup = () => {
    const restored: string[] = []
    render(<UndoProvider><Trigger restored={restored} /></UndoProvider>)
    return restored
  }
  const click = async (name: RegExp | string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }

  it('two deletes within 8 s can both be undone, newest first, with a count on the button', async () => {
    const restored = setup()
    await click('del A')
    await act(async () => { vi.advanceTimersByTime(3000) })
    await click('del B')
    expect(screen.getByRole('button', { name: 'Undo (2)' })).toBeTruthy()
    await click('Undo (2)')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    await click('Undo')
    expect(restored).toEqual(['B', 'A'])
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull()
  })

  it('each item has its own 8 s expiry: an expired item can no longer be restored', async () => {
    const restored = setup()
    await click('del A')
    await act(async () => { vi.advanceTimersByTime(5000) })
    await click('del B')
    await act(async () => { vi.advanceTimersByTime(UNDO_MS - 5000 + 1) }) // A is now 8 s old, B only 3 s
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy() // single again
    await click('Undo')
    expect(restored).toEqual(['B'])
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull() // A cannot come back
    await act(async () => { vi.advanceTimersByTime(UNDO_MS * 2) })
    expect(restored).toEqual(['B'])
  })

  it('uses a polite live region', async () => {
    setup()
    await click('del A')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })
})
