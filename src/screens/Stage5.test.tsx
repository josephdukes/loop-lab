// @vitest-environment jsdom
// Stage 5: a designed empty state on every screen, and the error boundaries (top level and lazy screens).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Dexie from 'dexie'
import type { ReactNode } from 'react'

vi.mock('../pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { AppProvider } from '../appState'
import { NavProvider } from '../nav'
import { UndoProvider } from '../undo'
import { getDb } from '../db/db'
import { seedBuiltInContent } from '../content/seed'
import { addSession } from '../test/fixtures'
import { AppErrorBoundary, LazyBoundary, lazyScreen } from '../components/ErrorBoundary'
import { Home } from './Home'
import { Progress } from './Progress'
import { Matches } from './Matches'
import { Data } from './Data'
import { BlockReviewScreen } from './BlockReview'
import { AllSessionsScreen, SessionDetailScreen } from './Sessions'
import { TemplateEditorScreen } from './TemplateEditor'

afterEach(async () => {
  cleanup()
  getDb().close()
  await Dexie.delete('loop-lab')
  vi.restoreAllMocks()
})
beforeEach(async () => {
  const db = getDb()
  await db.open()
  await seedBuiltInContent(db)
})

function wrap(ui: ReactNode) {
  return render(
    <AppProvider renderLoading={() => <p>loading</p>} renderError={(m) => <p>{m}</p>}>
      <NavProvider><UndoProvider>{ui}</UndoProvider></NavProvider>
    </AppProvider>,
  )
}

describe('empty states: a new install with nothing logged', () => {
  const cases: Array<[string, ReactNode, RegExp]> = [
    ['Home', <Home />, /No sessions logged yet/],
    ['Progress', <Progress />, /No sessions logged yet/],
    ['Matches', <Matches />, /No matches logged yet/],
    ['Data (export)', <Data />, /Nothing logged yet/],
    ['Block Review', <BlockReviewScreen />, /No block reviews yet/],
    ['All sessions', <AllSessionsScreen />, /No sessions yet/],
    ['Session detail for a missing session', <SessionDetailScreen sessionId="gone" />, /Session not found/],
    ['Session builder (new)', <TemplateEditorScreen />, /No drills yet/],
  ]
  for (const [name, ui, text] of cases) {
    it(`${name} explains what to do instead of showing a blank area`, async () => {
      wrap(ui)
      expect(await screen.findByText(text, undefined, { timeout: 4000 })).toBeTruthy()
    })
  }

  it('Home stops showing the empty message once a session exists', async () => {
    await addSession(getDb(), { date: new Date().toISOString().slice(0, 10) })
    wrap(<Home />)
    await screen.findByText('Recent sessions')
    await waitFor(() => expect(screen.queryByText(/No sessions logged yet/)).toBeNull())
  })
})

describe('error boundaries', () => {
  function Boom(): ReactNode { throw new Error('simulated screen crash') }

  it('the top-level boundary shows a plain message and a Reload button, and stored data is untouched', async () => {
    await addSession(getDb(), { date: '2026-10-01' })
    const before = await getDb().sessionLogs.count()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Loop Lab hit a problem' })).toBeTruthy()
    const reload = screen.getByRole('button', { name: 'Reload' })
    expect(reload).toBeTruthy()
    expect(screen.getByText(/simulated screen crash/)).toBeTruthy()
    expect(screen.getByText(/stored safely on this phone/)).toBeTruthy()
    expect(await getDb().sessionLogs.count()).toBe(before)
    expect(before).toBe(1)
  })

  it('a lazy screen that fails to load shows "could not be opened" and Try again loads it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempts = 0
    const Late = lazyScreen(async () => {
      attempts++
      if (attempts === 1) throw new Error('chunk missing')
      return { default: () => <p>Late screen is here</p> }
    })
    render(<LazyBoundary name="Late" resetKey="a" retry={Late.retry}><Late /></LazyBoundary>)
    expect(await screen.findByText('Late could not be opened')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(await screen.findByText('Late screen is here')).toBeTruthy()
    expect(attempts).toBe(2)
  })

  it('shows a loading state while a lazy screen arrives', async () => {
    let release: () => void = () => {}
    const Slow = lazyScreen(() => new Promise<{ default: () => ReactNode }>((res) => { release = () => res({ default: () => <p>Slow done</p> }) }))
    render(<LazyBoundary name="Slow" resetKey="a" retry={Slow.retry}><Slow /></LazyBoundary>)
    expect(screen.getByRole('status').textContent).toMatch(/Loading Slow/)
    await act(async () => { release() })
    expect(await screen.findByText('Slow done')).toBeTruthy()
  })
})
