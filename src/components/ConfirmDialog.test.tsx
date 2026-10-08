// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)
// jsdom has no layout, so every element reports no boxes; pretend everything is visible so Tab handling can be tested.
HTMLElement.prototype.getClientRects = function () { return [{ width: 1, height: 1 }] as unknown as DOMRectList }

function Host({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <main data-testid="bg"><button type="button" onClick={() => setOpen(true)}>Open it</button></main>
      {open && <ConfirmDialog title="Delete this?" message="It cannot be undone." confirmLabel="Delete" danger onCancel={() => setOpen(false)} onConfirm={() => { onConfirm(); setOpen(false) }} />}
    </div>
  )
}

describe('ConfirmDialog accessibility', () => {
  it('is a labelled modal dialog, focuses Cancel, and makes the page behind inert', () => {
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    opener.focus()
    fireEvent.click(opener)
    const dlg = screen.getByRole('alertdialog')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    expect(dlg.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('bg').parentElement!.parentElement!.hasAttribute('inert')).toBe(true)
  })

  it('keeps Tab inside the dialog in both directions', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }))
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const del = screen.getByRole('button', { name: 'Delete' })
    del.focus()
    fireEvent.keyDown(del, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(del)
  })

  it('Escape closes without confirming, and focus returns to the button that opened it', () => {
    const onConfirm = vi.fn()
    render(<Host onConfirm={onConfirm} />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
    expect(screen.getByTestId('bg').parentElement!.parentElement!.hasAttribute('inert')).toBe(false)
  })
})
