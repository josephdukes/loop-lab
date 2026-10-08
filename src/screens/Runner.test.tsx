// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'

vi.mock('../pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import App from '../App'
import { AppProvider } from '../appState'
import { NavProvider } from '../nav'
import { UndoProvider } from '../undo'
import { getDb } from '../db/db'
import { createRunnerDrill, createRunnerState } from '../lib/runnerState'
import { RunnerView } from './Runner'
import type { Drill, MetricType } from '../db/types'

afterEach(async () => {
  cleanup()
  getDb().close()
  await Dexie.delete('loop-lab')
})

function drill(metricType: MetricType): Drill {
  return {
    id: metricType, name: `Drill ${metricType}`, category: 'Loop from Backspin', description: 'Do the thing', metricType,
    suggestedSettings: 'heavy backspin', cues: 'brush low to high', source: 'custom', isBuiltIn: false, modifiedByUser: false, archived: false,
    createdAt: '', updatedAt: '', defaultDurationMin: 2,
    benchmark: metricType === 'hits_attempts' ? { metricType, threshold: 0.8, minAttempts: 10, consecutiveSessions: 1, description: '8/10' } : undefined,
  }
}

const value = (label: string) => screen.getByRole('spinbutton', { name: label }).textContent
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }

describe('runner counters (jsdom)', () => {
  it('renders every metric type with labelled counters that update', async () => {
    const initial = createRunnerState({
      startedAt: '2026-10-07T10:00:00.000Z', date: '2026-10-07', kind: 'robot', templateName: 'Test session',
      drills: (['hits_attempts', 'streak', 'score_vs_robot', 'duration', 'rating'] as MetricType[]).map((t, i) => createRunnerDrill({ key: 'k' + i, drill: drill(t) })),
    })
    render(
      <AppProvider renderLoading={() => <p>loading</p>} renderError={(m) => <p>{m}</p>}>
        <NavProvider><UndoProvider><RunnerView initial={initial} /></UndoProvider></NavProvider>
      </AppProvider>,
    )
    await screen.findByText('Drill hits_attempts')

    // The drill card shows description, settings, cues, target and timer.
    expect(screen.getByText('Do the thing')).toBeTruthy()
    expect(screen.getByText(/heavy backspin/)).toBeTruthy()
    expect(screen.getByText(/brush low to high/)).toBeTruthy()
    expect(screen.getByText(/8\/10/)).toBeTruthy()
    expect(screen.getByLabelText('Time left').textContent).toBe('2:00')
    expect((screen.getByLabelText('Robot settings used') as HTMLInputElement).value).toBe('heavy backspin')
    // Wake lock is not available in jsdom: the small notice shows.
    expect(await screen.findByText(/Keep-awake is not supported/)).toBeTruthy()

    // hits_attempts: Hit increments both, Miss only attempts, steppers adjust.
    await click(screen.getByRole('button', { name: 'Hit' }))
    await click(screen.getByRole('button', { name: 'Hit' }))
    await click(screen.getByRole('button', { name: 'Miss' }))
    expect(value('Hits')).toBe('2')
    expect(value('Attempts')).toBe('3')
    await click(screen.getByRole('button', { name: 'Attempts plus 1' }))
    expect(value('Attempts')).toBe('4')
    await click(screen.getByRole('button', { name: 'Hits minus 1' }))
    expect(value('Hits')).toBe('1')
    expect(screen.getByText(/Success rate 25.0%/)).toBeTruthy()

    // timer +1 minute
    await click(screen.getByRole('button', { name: '+1 minute' }))
    expect(screen.getByLabelText('Time left').textContent).toBe('3:00')

    // streak
    await click(screen.getByRole('button', { name: 'Next' }))
    await click(screen.getByRole('button', { name: 'Current run plus 1' }))
    await click(screen.getByRole('button', { name: 'Current run plus 1' }))
    expect(value('Current run')).toBe('2')
    await click(screen.getByRole('button', { name: 'New best' }))
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy()

    // score vs robot
    await click(screen.getByRole('button', { name: 'Next' }))
    await click(screen.getByRole('button', { name: 'Me plus 1' }))
    await click(screen.getByRole('button', { name: 'Robot plus 1' }))
    await click(screen.getByRole('button', { name: 'Robot plus 1' }))
    expect(value('Me')).toBe('1')
    expect(value('Robot')).toBe('2')

    // duration (manual) then rating
    await click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.change(screen.getByLabelText(/Minutes/), { target: { value: '7' } })
    expect((screen.getByLabelText(/Minutes/) as HTMLInputElement).value).toBe('7')
    await click(screen.getByRole('button', { name: 'Next' }))
    const rating = screen.getByRole('radiogroup', { name: 'Rating 1 to 5' })
    await click(within(rating).getByRole('radio', { name: '4 of 5' }))
    expect(within(rating).getByRole('radio', { name: '4 of 5' }).getAttribute('aria-checked')).toBe('true')
    expect(within(rating).getByRole('radio', { name: '3 of 5' }).getAttribute('aria-checked')).toBe('false')

    // the last drill's button says Finish and leads to the summary with the prefilled minutes
    await click(screen.getByRole('button', { name: 'Finish' }))
    expect(screen.getByText(/5 of 5 drills have a result/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save session' })).toBeTruthy()
  })
})

async function openApp() {
  render(<App />)
  await screen.findByText(/^\d+ of \d+ robot sessions this week$/)
}

describe('core workflow through the UI (jsdom)', () => {
  it('start a session from Train, enter results, finish early, save; Home counts it; resume and delete with undo work', async () => {
    await openApp()
    await click(screen.getByRole('button', { name: 'Train' }))
    await click(screen.getByRole('tab', { name: 'Sessions' }))
    await click(await screen.findByRole('button', { name: 'Start now: Original Phase 1 Session' }))

    // runner opens at the first drill
    await screen.findByRole('dialog', { name: 'Session runner' })
    expect(await screen.findByRole('heading', { name: 'Pure Repetition Loop' })).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Hit' }))
    expect(value('Attempts')).toBe('1')

    // the state was autosaved: it is in the activeSession store
    await waitFor(async () => {
      const rec = await getDb().activeSession.get('active')
      expect(JSON.stringify(rec?.state)).toContain('"attempts":1')
    })

    // Leave, then Home offers Resume; resume restores the counter
    await click(screen.getByRole('button', { name: 'Leave' }))
    await click(screen.getByRole('button', { name: 'Home' }))
    await click(await screen.findByRole('button', { name: 'Resume' }))
    await screen.findByRole('heading', { name: 'Pure Repetition Loop' })
    expect(value('Attempts')).toBe('1')
    expect(value('Hits')).toBe('1')

    // Finish early, fill in the summary, save
    await click(screen.getByRole('button', { name: 'Finish early' }))
    await click(within(screen.getByRole('radiogroup', { name: 'Effort' })).getByRole('radio', { name: '4 of 5' }))
    await click(within(screen.getByRole('radiogroup', { name: 'Loop confidence' })).getByRole('radio', { name: '3 of 5' }))
    await click(screen.getByRole('button', { name: 'Save session' }))
    await screen.findByText(/^1 of 3 robot sessions this week$/)
    expect(await getDb().sessionLogs.count()).toBe(1)
    expect(await getDb().drillLogs.count()).toBe(1)
    expect(await getDb().activeSession.get('active')).toBeUndefined()

    // Recent sessions -> detail -> delete -> undo
    await click(await screen.findByRole('button', { name: /Original Phase 1 Session/ }))
    await screen.findByRole('heading', { name: 'Session' })
    await click(await screen.findByRole('button', { name: 'Delete' }))
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await screen.findByText('Session deleted.')
    expect(await getDb().sessionLogs.count()).toBe(0)
    await click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await getDb().sessionLogs.count()).toBe(1))
    expect(await getDb().drillLogs.count()).toBe(1)
  })

  it('starting the Pressure Loop plan makes Home show Week 1, Session 1; discard asks for confirmation', async () => {
    await openApp()
    await click(screen.getByRole('button', { name: 'Train' }))
    await click(await screen.findByRole('button', { name: /Pressure Loop, 2 Weeks/ }))
    await click(await screen.findByRole('button', { name: 'Start' }))
    await click(screen.getByRole('button', { name: 'Home' }))
    const next = await screen.findByRole('region', { name: 'Next up' })
    expect(within(next).getByRole('heading').textContent).toContain('Week 1, Session 1')
    await click(within(next).getByRole('button', { name: 'Start session' }))
    await screen.findByRole('dialog', { name: 'Session runner' })
    await click(await screen.findByRole('button', { name: 'Discard' }))
    // confirmation first: nothing is discarded until confirmed
    expect(await getDb().activeSession.get('active')).toBeDefined()
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard session' }))
    await waitFor(async () => expect(await getDb().activeSession.get('active')).toBeUndefined())
  })
})
