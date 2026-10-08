import { describe, expect, it } from 'vitest'
import {
  arrivedAt, closeAllOverlays, createModel, currentState, goBack, HOME_STATE, pushState, replaceState, toTab, upTo,
  type HistoryModel, type NavState, type Step,
} from './navModel'

const tab = (t: NavState['tab'], extra: Partial<NavState> = {}): NavState => ({ tab: t, trainSub: 'programs', overlays: [], ...extra })
const runner: NavState['overlays'][number] = { kind: 'runner', init: { mode: 'resume' } }
const quick: NavState['overlays'][number] = { kind: 'quicklog' }

/** Plays commands against a fake browser history so the model can be compared with what the browser would hold. */
function browser(initial: HistoryModel) {
  let entries = initial.entries.slice(0, initial.index + 1).map((e) => e)
  let index = initial.index
  return {
    apply(step: Step) {
      for (const c of step.commands) {
        if (c.type === 'push') { entries = [...entries.slice(0, index + 1), c.state]; index = entries.length - 1 }
        else if (c.type === 'replace') entries[index] = c.state
        else index += c.delta
      }
      return { entries, index }
    },
  }
}

describe('navigation model: browser Back', () => {
  it('starts at Home with nothing behind it', () => {
    const m = createModel()
    expect(m.index).toBe(0)
    expect(currentState(m)).toEqual(HOME_STATE)
    expect(goBack(m).commands).toEqual([])
  })

  it('opening the runner pushes one entry and Back closes it', () => {
    const m0 = createModel()
    const m1 = pushState(m0, { ...HOME_STATE, overlays: [runner] }).model
    expect(currentState(m1).overlays).toEqual([runner])
    const back = goBack(m1)
    expect(currentState(back.model)).toEqual(HOME_STATE)
    expect(back.commands).toEqual([{ type: 'go', delta: -1 }])
  })

  it('a tab other than Home sits above Home: Back goes to Home, and Back from Home stays on Home (the browser leaves the app)', () => {
    const m1 = toTab(createModel(), tab('progress')).model
    expect(m1.index).toBe(1)
    const m2 = goBack(m1).model
    expect(currentState(m2).tab).toBe('home')
    expect(goBack(m2).commands).toEqual([])
  })

  it('switching tabs does not pile up entries', () => {
    let m = toTab(createModel(), tab('train')).model
    m = toTab(m, tab('progress')).model
    m = toTab(m, tab('matches')).model
    expect(m.index).toBe(1)
    expect(currentState(m).tab).toBe('matches')
  })

  it('going Home from a tab opened on top of screens unwinds to the first entry', () => {
    let m = toTab(createModel(), tab('train')).model
    m = pushState(m, tab('train', { overlays: [quick] })).model
    m = pushState(m, tab('train', { overlays: [quick, { kind: 'sessionDetail', sessionId: 's' }] })).model
    expect(m.index).toBe(3)
    const step = toTab(m, tab('home'))
    expect(step.model.index).toBe(0)
    expect(step.commands).toEqual([{ type: 'go', delta: -3 }])
  })

  it('switching tab from deep inside screens unwinds then replaces entry 1', () => {
    let m = toTab(createModel(), tab('train')).model
    m = pushState(m, tab('train', { overlays: [quick] })).model
    const step = toTab(m, tab('data'))
    expect(step.model.index).toBe(1)
    expect(currentState(step.model).tab).toBe('data')
    expect(step.commands.map((c) => c.type)).toEqual(['go', 'replace'])
  })

  it('closeAllOverlays returns to the nearest entry without screens on top', () => {
    let m = toTab(createModel(), tab('train')).model
    m = pushState(m, tab('train', { overlays: [quick] })).model
    m = pushState(m, tab('train', { overlays: [quick, { kind: 'allSessions' }] })).model
    const step = closeAllOverlays(m)
    expect(step.model.index).toBe(1)
    expect(currentState(step.model).overlays).toEqual([])
    expect(closeAllOverlays(step.model).commands).toEqual([])
  })

  it('"up" within a tab is a plain Back when the entry below is the target, otherwise it replaces (Back never loops)', () => {
    let m = toTab(createModel(), tab('train')).model
    const detail = tab('train', { programId: 'p1' })
    m = pushState(m, detail).model
    const up = upTo(m, tab('train'))
    expect(up.commands).toEqual([{ type: 'go', delta: -1 }])
    const replaced = upTo(toTab(createModel(), detail).model, tab('train'))
    expect(replaced.commands.map((c) => c.type)).toEqual(['replace'])
    expect(replaced.model.index).toBe(1)
  })

  it('the model and a simulated browser history agree after a mixed sequence', () => {
    let m = createModel()
    const b = browser(m)
    const steps: Array<(m: HistoryModel) => Step> = [
      (x) => toTab(x, tab('train')),
      (x) => pushState(x, tab('train', { overlays: [quick] })),
      (x) => pushState(x, tab('train', { overlays: [quick, { kind: 'drillEditor' }] })),
      (x) => goBack(x),
      (x) => replaceState(x, tab('train', { overlays: [quick] , dataFocus: 'backup' })),
      (x) => toTab(x, tab('matches')),
      (x) => toTab(x, tab('home')),
    ]
    for (const s of steps) {
      const step = s(m)
      m = step.model
      const real = b.apply(step)
      expect(real.index).toBe(m.index)
      expect(real.entries[real.index]).toEqual(currentState(m))
    }
  })

  it('arrivedAt only accepts entries that exist', () => {
    const m = pushState(createModel(), tab('train')).model
    expect(arrivedAt(m, 0)?.index).toBe(0)
    expect(arrivedAt(m, 5)).toBeNull()
    expect(arrivedAt(m, -1)).toBeNull()
    expect(arrivedAt(m, 0.5)).toBeNull()
  })
})
