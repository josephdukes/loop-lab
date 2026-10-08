// @vitest-environment jsdom
// Component tests for the stage 3 editors, the match form and the rest-week menu (Testing Library + fake-indexeddb).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import type { ReactNode } from 'react'

vi.mock('../pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { AppProvider } from '../appState'
import { NavProvider } from '../nav'
import { UndoProvider } from '../undo'
import { getDb } from '../db/db'
import { addMatch, addSession, drillByKey } from '../test/fixtures'
import { todayLocal, weekStartOf } from '../lib/dates'
import { DrillEditorScreen } from './DrillEditor'
import { TemplateEditorScreen } from './TemplateEditor'
import { ProgramEditorScreen } from './ProgramEditor'
import { MatchFormScreen } from './MatchForm'
import { Matches } from './Matches'
import { Progress } from './Progress'
import { BlockReviewScreen } from './BlockReview'
import { GuidesTab } from './GuidesTab'
import { SessionsTab } from './SessionsTab'
import { DrillsTab } from './DrillsTab'
import { setArchived } from '../lib/libraryService'
import type { Drill, Program, SessionTemplate } from '../db/types'

afterEach(async () => {
  cleanup()
  getDb().close()
  await Dexie.delete('loop-lab')
})

function wrap(ui: ReactNode) {
  return render(
    <AppProvider renderLoading={() => <p>loading</p>} renderError={(m) => <p>{m}</p>}>
      <NavProvider><UndoProvider>{ui}</UndoProvider></NavProvider>
    </AppProvider>,
  )
}
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const type = async (el: HTMLElement, value: string) => { await act(async () => { fireEvent.change(el, { target: { value } }) }) }
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement

describe('Drill editor', () => {
  it('creates a custom drill with a benchmark', async () => {
    wrap(<DrillEditorScreen />)
    await screen.findByRole('button', { name: 'Save drill' })
    await click(screen.getByRole('button', { name: 'Save drill' }))
    expect(await screen.findByText(/Give the drill a name/)).toBeTruthy()

    await type(field('Name'), 'My backspin drill')
    await type(field('Description'), 'Loop everything to the middle')
    await click(screen.getByRole('button', { name: 'Add a benchmark' }))
    await type(field(/success rate to reach/), '75')
    await type(field(/Minimum attempts/), '20')
    await type(field('Sessions in a row'), '2')
    await click(screen.getByRole('button', { name: 'Save drill' }))

    const db = getDb()
    await waitFor(async () => expect((await db.drills.toArray()).some((d) => d.name === 'My backspin drill')).toBe(true))
    const d = (await db.drills.toArray()).find((x) => x.name === 'My backspin drill') as Drill
    expect(d).toMatchObject({ isBuiltIn: false, source: 'custom', description: 'Loop everything to the middle', metricType: 'hits_attempts' })
    expect(d.benchmark).toMatchObject({ metricType: 'hits_attempts', threshold: 0.75, minAttempts: 20, consecutiveSessions: 2 })
    expect(d.benchmark?.description).toMatch(/75%/)
  })

  it('rejects an out-of-range benchmark with a plain message and saves nothing', async () => {
    wrap(<DrillEditorScreen />)
    await screen.findByRole('button', { name: 'Save drill' })
    await type(field('Name'), 'Bad one')
    await click(screen.getByRole('button', { name: 'Add a benchmark' }))
    await type(field(/success rate to reach/), '150')
    await click(screen.getByRole('button', { name: 'Save drill' }))
    expect(await screen.findByText(/above 0% and at most 100%/)).toBeTruthy()
    expect((await getDb().drills.toArray()).some((d) => d.name === 'Bad one')).toBe(false)
  })

  it('editing a built-in marks it as modified', async () => {
    wrap(<div id="host" />)
    await screen.findByText('loading', {}, { timeout: 10 }).catch(() => {})
    const db = getDb()
    await waitFor(async () => expect(await db.drills.count()).toBeGreaterThan(0))
    const d = await drillByKey(db, 'orig-A')
    cleanup()
    wrap(<DrillEditorScreen drillId={d.id} />)
    await screen.findByRole('button', { name: 'Save drill' })
    await waitFor(() => expect(field('Name').value).toBe('Pure Repetition Loop'))
    await type(field('Description'), 'Edited by Joe')
    await click(screen.getByRole('button', { name: 'Save drill' }))
    await waitFor(async () => expect((await db.drills.get(d.id))?.modifiedByUser).toBe(true))
    expect((await db.drills.get(d.id))?.description).toBe('Edited by Joe')
    expect((await db.drills.get(d.id))?.benchmark?.threshold).toBe(0.8)
  })
})

describe('Session builder', () => {
  it('reorders drills with Up and Down and saves the new order', async () => {
    wrap(<div />)
    const db = getDb()
    await waitFor(async () => expect(await db.sessionTemplates.count()).toBeGreaterThan(0))
    const t = (await db.sessionTemplates.toArray()).find((x) => x.builtInKey === 'T-reset') as SessionTemplate
    cleanup()
    wrap(<TemplateEditorScreen templateId={t.id} />)
    await screen.findByRole('button', { name: 'Save session' })
    await screen.findByText(/1\. Pure Repetition Loop/)
    await click(screen.getByRole('button', { name: 'Move Spin Calibration Blocks up' }))
    expect(screen.getByRole('heading', { level: 3, name: /1\. Spin Calibration Blocks/ })).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Remove Free Multiball Cool-down' }))
    await type(screen.getAllByLabelText('Minutes')[0], '20')
    await click(screen.getByRole('button', { name: 'Save session' }))
    await waitFor(async () => expect((await db.sessionTemplates.get(t.id))?.modifiedByUser).toBe(true))
    const saved = (await db.sessionTemplates.get(t.id)) as SessionTemplate
    const names = await Promise.all(saved.items.map(async (i) => (await db.drills.get(i.drillId))?.name))
    expect(names).toEqual(['Spin Calibration Blocks', 'Pure Repetition Loop'])
    expect(saved.items.map((i) => i.order)).toEqual([1, 2])
    expect(saved.items[0].durationMin).toBe(20)
  })

  it('builds a new session by picking from the library, and refuses an empty one', async () => {
    wrap(<TemplateEditorScreen />)
    await screen.findByRole('button', { name: 'Save session' })
    await type(field('Name'), 'Mine')
    await click(screen.getByRole('button', { name: 'Save session' }))
    expect(await screen.findByText(/Add at least one drill/)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Add a drill' }))
    await click(await screen.findByRole('button', { name: /Footwork Ladder/ }))
    expect(await screen.findByText(/1\. Footwork Ladder/)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Club session' }))
    await click(screen.getByRole('button', { name: 'Save session' }))
    const db = getDb()
    await waitFor(async () => expect((await db.sessionTemplates.toArray()).some((t) => t.name === 'Mine')).toBe(true))
    const t = (await db.sessionTemplates.toArray()).find((x) => x.name === 'Mine') as SessionTemplate
    expect(t).toMatchObject({ kind: 'club', isBuiltIn: false })
    expect(t.items).toHaveLength(1)
  })
})

describe('Program builder', () => {
  it('builds a two-week program from templates and changes sessions per week', async () => {
    wrap(<ProgramEditorScreen />)
    await screen.findByRole('button', { name: 'Save program' })
    await type(field('Name'), 'My plan')
    await click(screen.getByRole('button', { name: 'Add a week' }))
    await type(field('Sessions per week'), '2')
    expect(screen.queryByLabelText('Session 3 name')).toBeNull()
    await click(screen.getByRole('button', { name: /Runs once/ }))
    await type(field('Cycle length in weeks'), '2')
    await click(screen.getByRole('button', { name: 'Save program' }))
    const db = getDb()
    await waitFor(async () => expect((await db.programs.toArray()).some((p) => p.name === 'My plan')).toBe(true))
    const p = (await db.programs.toArray()).find((x) => x.name === 'My plan') as Program
    expect(p).toMatchObject({ sessionsPerWeek: 2, repeating: true, cycleLengthWeeks: 2, isBuiltIn: false })
    expect(p.weeks).toHaveLength(2)
    expect(p.weeks.every((w) => w.sessions.length === 2)).toBe(true)
  })
})

describe('Match form', () => {
  it('saves every field, shows the loops percentage, and refuses a missing result', async () => {
    wrap(<MatchFormScreen />)
    await screen.findByRole('button', { name: 'Save match' })
    await click(screen.getByRole('button', { name: 'Save match' }))
    expect(await screen.findByText(/Choose win or loss/)).toBeTruthy()
    expect(screen.getByText(/Choose a confidence/)).toBeTruthy()

    await type(field('Opponent (kept on this phone only)'), 'Sam')
    await type(field('Opponent style'), 'chopper')
    await click(screen.getByRole('button', { name: 'Win' }))
    await type(field(/Games score/), '3-1')
    await type(field('Serve faced'), 'short backspin')
    await type(field('Loops attempted'), '20')
    await type(field('Loops landed'), '15')
    expect(await screen.findByText('Loops landed: 75.0%')).toBeTruthy()
    await click(within(screen.getByRole('radiogroup', { name: 'Confidence' })).getByRole('radio', { name: '4 of 5' }))
    await type(field('Cue used'), 'let it drop')
    await type(field(/push-to-attack decision/), 'third ball at 9-9')
    await type(field('Notes'), 'good match')
    await click(screen.getByRole('button', { name: 'Save match' }))

    const db = getDb()
    await waitFor(async () => expect(await db.matchLogs.count()).toBe(1))
    expect((await db.matchLogs.toArray())[0]).toMatchObject({
      competition: 'league', opponent: 'Sam', opponentStyle: 'chopper', result: 'W', gamesScore: '3-1', serveFaced: 'short backspin',
      loopsAttempted: 20, loopsLanded: 15, confidence: 4, cueUsed: 'let it drop', breakdownNote: 'third ball at 9-9', notes: 'good match', date: todayLocal(),
    })
  })

  it('edits, then deletes with confirmation and Undo brings it back', async () => {
    wrap(<div />)
    const db = getDb()
    await waitFor(async () => expect(await db.drills.count()).toBeGreaterThan(0))
    const id = await addMatch(db, { date: '2026-10-01', result: 'L', confidence: 2, opponent: 'Alex' })
    cleanup()
    wrap(<MatchFormScreen matchId={id} />)
    await screen.findByRole('button', { name: 'Save changes' })
    await waitFor(() => expect(field('Opponent (kept on this phone only)').value).toBe('Alex'))
    await click(screen.getByRole('button', { name: 'Win' }))
    await click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(async () => expect((await db.matchLogs.get(id))?.result).toBe('W'))

    cleanup()
    wrap(<MatchFormScreen matchId={id} />)
    await screen.findByRole('button', { name: 'Delete match' })
    await click(screen.getByRole('button', { name: 'Delete match' }))
    const dlg = await screen.findByRole('alertdialog')
    expect(within(dlg).getByText(/8 seconds/)).toBeTruthy()
    await click(within(dlg).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.matchLogs.count()).toBe(0))
    await click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await db.matchLogs.count()).toBe(1))
    expect((await db.matchLogs.get(id))?.opponent).toBe('Alex')
  })
})

describe('Matches tab', () => {
  it('shows an empty state, then stats and a newest-first list', async () => {
    wrap(<Matches />)
    expect(await screen.findByText('No matches logged yet')).toBeTruthy()
    const db = getDb()
    await addMatch(db, { date: '2026-10-01', result: 'W', opponentStyle: 'chopper', loopsAttempted: 10, loopsLanded: 7, confidence: 3, opponent: 'Older' })
    await addMatch(db, { date: '2026-10-05', result: 'L', opponentStyle: 'chopper', loopsAttempted: 10, loopsLanded: 5, confidence: 4, opponent: 'Newer' })
    cleanup()
    wrap(<Matches />)
    expect(await screen.findByText('60.0%')).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Matches, newest first' })
    const items = within(list).getAllByRole('button')
    expect(items[0].textContent).toContain('Newer')
    expect(items[1].textContent).toContain('Older')
    const row = screen.getByRole('row', { name: /Chopper/ })
    expect(row.textContent).toContain('1')
    expect(screen.getByRole('button', { name: 'Open Block Review' })).toBeTruthy()
  })
})

describe('Progress: rest weeks', () => {
  it('marks the selected week as a rest week and writes weekFlags', async () => {
    wrap(<Progress />)
    expect(await screen.findByText('No sessions logged yet')).toBeTruthy()
    const db = getDb()
    await addSession(db, { date: todayLocal() })
    cleanup()
    wrap(<Progress />)
    await screen.findByText('Weekly training', { selector: 'h2' })
    const current = weekStartOf(todayLocal())
    const btn = await screen.findByRole('button', { name: /Mark as rest week: week of/ })
    await click(btn)
    await waitFor(async () => expect((await db.weekFlags.get(current))?.isRest).toBe(true))
    expect(await screen.findByRole('button', { name: /Remove rest week: week of/ })).toBeTruthy()
    // every chart states its key numbers in text
    expect(screen.getByText(/Rest weeks \(hatched\)/)).toBeTruthy()
    expect(screen.getAllByText(/Robot sessions per week over/).length).toBeGreaterThan(0)
  })

  it('shows the benchmark board with icon plus text, and the range filter changes the weeks', async () => {
    wrap(<div />)
    const db = getDb()
    await waitFor(async () => expect(await db.drills.count()).toBeGreaterThan(0))
    await addSession(db, { date: todayLocal(), logs: [{ drillKey: 'orig-A', hits: 9, attempts: 10, durationMin: 15 }] })
    cleanup()
    wrap(<Progress />)
    const board = await screen.findByRole('list', { name: 'Benchmark board' })
    const card = within(board).getByRole('heading', { name: 'Pure Repetition Loop' }).closest('li') as HTMLElement
    expect(within(card).getByText('Met')).toBeTruthy()
    expect(card.textContent).toContain('90.0%')
    const sel = screen.getByRole('combobox', { name: /Selected week/ }) as HTMLSelectElement
    expect(sel.options.length).toBe(12)
    await click(screen.getByRole('button', { name: '4 weeks' }))
    expect((screen.getByRole('combobox', { name: /Selected week/ }) as HTMLSelectElement).options.length).toBe(4)
  })
})

describe('Block Review screen', () => {
  it('shows comparison cards and the two prompts, and saves the emphasis notes', async () => {
    wrap(<BlockReviewScreen />)
    expect(await screen.findByText(/recognition under pressure/)).toBeTruthy()
    expect(screen.getByText(/block\/counter rallies/)).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Loops landed in matches' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Best Pressure Streak Game streak' })).toBeTruthy()
    expect(screen.getByText('No block reviews yet')).toBeTruthy()
    await type(field('Emphasis for next block'), 'More randomisation')
    await click(screen.getByRole('button', { name: 'Save block review' }))
    const db = getDb()
    await waitFor(async () => expect(await db.blockReviews.count()).toBe(1))
    expect((await db.blockReviews.toArray())[0].emphasisNotes).toBe('More randomisation')
    expect(await screen.findByText('More randomisation')).toBeTruthy()
  })
})

describe('Guides', () => {
  it('shows the diagnosis, between-ball routine and match-day cards', () => {
    render(<GuidesTab />)
    expect(screen.getByRole('heading', { name: /Diagnosis/ })).toBeTruthy()
    for (const w of ['Rushing', 'Racket angle not matched to spin', 'Inconsistent brush contact', 'Weak leg drive']) expect(screen.getByText(w)).toBeTruthy()
    expect(screen.getByText('Push-to-attack is a recognition skill.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Between-ball routine' })).toBeTruthy()
    for (const w of ['Breath', 'Towel', 'Reset']) expect(screen.getByText(w)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Match-day protocol' })).toBeTruthy()
    expect(screen.getByText(/One cue, not a checklist/)).toBeTruthy()
  })
})

describe('Library lists', () => {
  it('Duplicate, Reset to original, Archive and Show archived with Restore work from the Sessions list', async () => {
    wrap(<SessionsTab />)
    const name = 'Original Phase 1 Session'
    await click(await screen.findByRole('button', { name: `Duplicate session: ${name}` }))
    const db = getDb()
    await waitFor(async () => expect((await db.sessionTemplates.toArray()).some((t) => t.name === `Copy of ${name}`)).toBe(true))
    expect(await screen.findByRole('heading', { name: `Copy of ${name}` })).toBeTruthy()
    // a built-in that has not been edited has no Reset button; the copy is custom and can be deleted
    expect(screen.queryByRole('button', { name: `Reset to original session: ${name}` })).toBeNull()
    expect(screen.getByRole('button', { name: `Delete session: Copy of ${name}` })).toBeTruthy()
    // edit the built-in in the database, then Reset appears and works
    const t = (await db.sessionTemplates.toArray()).find((x) => x.name === name)!
    await db.sessionTemplates.put({ ...t, name: 'My renamed', modifiedByUser: true })
    cleanup(); wrap(<SessionsTab />)
    await click(await screen.findByRole('button', { name: 'Reset to original session: My renamed' }))
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset' }))
    await waitFor(async () => expect((await db.sessionTemplates.get(t.id))?.name).toBe(name))
    // archive hides it; Show archived reveals it with Restore
    await click(await screen.findByRole('button', { name: `Archive session: ${name}` }))
    await click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name })).toBeNull())
    await click(screen.getByRole('button', { name: 'Show archived' }))
    await click(await screen.findByRole('button', { name: `Restore session: ${name}` }))
    await waitFor(async () => expect((await db.sessionTemplates.get(t.id))?.archived).toBe(false))
  })

  it('archived drills are hidden until Show archived is on', async () => {
    wrap(<div />)
    const db = getDb()
    await waitFor(async () => expect(await db.drills.count()).toBeGreaterThan(0))
    const d = await drillByKey(db, 'orig-B')
    await setArchived(db, 'drill', d.id, true)
    cleanup(); wrap(<DrillsTab />)
    await screen.findByText('Pure Repetition Loop')
    expect(screen.queryByText('Spin Calibration Blocks (archived)')).toBeNull()
    await click(screen.getByRole('button', { name: 'Show archived' }))
    expect(await screen.findByText('Spin Calibration Blocks (archived)')).toBeTruthy()
  })
})
