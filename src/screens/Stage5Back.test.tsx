// @vitest-environment jsdom
// Stage 5: the browser Back button (jsdom's real History API) and Quick log reordering, through the whole app.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'

vi.mock('../pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import App from '../App'
import { getDb } from '../db/db'

afterEach(async () => {
  cleanup()
  getDb().close()
  await Dexie.delete('loop-lab')
})

const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const back = async () => { await act(async () => { window.history.back(); await new Promise((r) => setTimeout(r, 60)) }) }

async function openApp() {
  render(<App />)
  await screen.findByText(/^\d+ of \d+ robot sessions this week$/)
}

describe('Android Back button (History API)', () => {
  it('Back from the runner returns to Home, where the Resume banner is waiting', async () => {
    await openApp()
    await click(screen.getByRole('button', { name: 'Train' }))
    await click(screen.getByRole('tab', { name: 'Sessions' }))
    await click(await screen.findByRole('button', { name: 'Start now: Original Phase 1 Session' }))
    await screen.findByRole('heading', { name: 'Pure Repetition Loop' })
    await click(screen.getByRole('button', { name: 'Hit' }))
    await waitFor(async () => expect(JSON.stringify((await getDb().activeSession.get('active'))?.state)).toContain('"attempts":1'))

    await back()
    expect(screen.queryByRole('dialog', { name: 'Session runner' })).toBeNull()
    // Back from a tab-level screen goes to the tab below it (Train), then Home.
    await back()
    await screen.findByRole('region', { name: 'Unfinished session' })
    expect(await getDb().activeSession.get('active')).toBeDefined()
  })

  it('Back closes an editor; with typed text it asks first and Keep editing leaves it open', async () => {
    await openApp()
    await click(screen.getByRole('button', { name: 'Train' }))
    await click(screen.getByRole('tab', { name: 'Drills' }))
    await click(await screen.findByRole('button', { name: 'New drill' }))
    await screen.findByRole('heading', { name: 'New drill' })
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'New drill' })).toBeNull())

    await click(await screen.findByRole('button', { name: 'New drill' }))
    await screen.findByRole('heading', { name: 'New drill' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Half typed' } }) })
    await back()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('heading', { name: 'New drill' })).toBeTruthy()
    // Back while the dialog is open closes only the dialog
    await back()
    await screen.findByRole('alertdialog')
    await back()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'New drill' })).toBeTruthy()
    // Discard really closes it and nothing was saved
    await back()
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'New drill' })).toBeNull())
    expect((await getDb().drills.toArray()).some((d) => d.name === 'Half typed')).toBe(false)
  })

  it('Back from Settings and from Block Review returns to the screen that opened them', async () => {
    await openApp()
    await click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByRole('heading', { name: 'Settings and help' })
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Settings and help' })).toBeNull())
    expect(screen.getByRole('heading', { name: 'Home', level: 1 })).toBeTruthy()

    await click(screen.getByRole('button', { name: 'Matches' }))
    await click(await screen.findByRole('button', { name: 'Open Block Review' }))
    await screen.findByRole('heading', { name: 'Block Review', level: 1 })
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Block Review', level: 1 })).toBeNull())
    expect(screen.getByRole('heading', { name: 'Matches', level: 1 })).toBeTruthy()
  })
})

describe('Quick log ordering', () => {
  it('Up and Down reorder the drills and the saved session keeps the new order', async () => {
    await openApp()
    await click(screen.getAllByRole('button', { name: 'Quick log' })[0])
    const list = await screen.findByRole('list', { name: 'Session templates' })
    await click(within(list).getByRole('button', { name: /Original Phase 1 Session/ }))
    const order = () => screen.getAllByRole('region').filter((r) => /^Drill \d+:/.test(r.getAttribute('aria-label') ?? '')).map((r) => r.getAttribute('aria-label'))
    await waitFor(() => expect(order()[0]).toBe('Drill 1: Pure Repetition Loop'))
    expect(screen.getByRole('button', { name: 'Move Pure Repetition Loop up' }).hasAttribute('disabled')).toBe(true)
    await click(screen.getByRole('button', { name: 'Move Pure Repetition Loop down' }))
    expect(order().slice(0, 2)).toEqual(['Drill 1: Spin Calibration Blocks', 'Drill 2: Pure Repetition Loop'])
    await click(screen.getByRole('button', { name: 'Move Pure Repetition Loop up' }))
    expect(order()[0]).toBe('Drill 1: Pure Repetition Loop')
    await click(screen.getByRole('button', { name: 'Move Pure Repetition Loop down' }))

    // give both of the first two drills a result, then save
    const first = screen.getByRole('region', { name: 'Drill 1: Spin Calibration Blocks' })
    await click(within(first).getByRole('button', { name: 'Hit' }))
    const second = screen.getByRole('region', { name: 'Drill 2: Pure Repetition Loop' })
    await click(within(second).getByRole('button', { name: 'Hit' }))
    await click(screen.getByRole('button', { name: 'Save session' }))
    await screen.findByText(/^1 of 3 robot sessions this week$/)
    const logs = (await getDb().drillLogs.toArray()).sort((a, b) => a.order - b.order)
    expect(logs.map((l) => l.drillNameSnapshot)).toEqual(['Spin Calibration Blocks', 'Pure Repetition Loop'])
  })
})
