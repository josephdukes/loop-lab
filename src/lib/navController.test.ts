// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NavController } from './navController'
import type { NavState } from './navModel'

const home: NavState = { tab: 'home', trainSub: 'programs', overlays: [] }
const quick: NavState = { ...home, overlays: [{ kind: 'quicklog' }] }
const train: NavState = { ...home, tab: 'train' }

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))
let seen: NavState[] = []
let detach: () => void = () => {}
let c: NavController

beforeEach(() => {
  seen = []
  c = new NavController(window)
  detach = c.attach((s) => seen.push(s))
})
afterEach(() => detach())

describe('NavController with the real History API (jsdom)', () => {
  it('Back closes a screen opened on top', async () => {
    c.push(quick)
    await tick()
    expect(c.state.overlays).toHaveLength(1)
    window.history.back()
    await tick()
    expect(c.state.overlays).toHaveLength(0)
    expect(c.state.tab).toBe('home')
  })

  it('Back from a root tab goes to Home', async () => {
    c.tab(train)
    await tick()
    expect(c.state.tab).toBe('train')
    window.history.back()
    await tick()
    expect(c.state.tab).toBe('home')
  })

  it('an interceptor (unsaved changes) catches Back, the screen stays open and the handler runs once', async () => {
    c.push(quick)
    await tick()
    let asked = 0
    const off = c.intercept({ run: () => { asked++ } })
    window.history.back()
    await tick(80)
    expect(asked).toBe(1)
    expect(c.state.overlays).toHaveLength(1)
    // pressing Back again asks again, it never silently discards
    window.history.back()
    await tick(80)
    expect(asked).toBe(2)
    expect(c.state.overlays).toHaveLength(1)
    // once the guard is gone Back works
    off()
    window.history.back()
    await tick(80)
    expect(c.state.overlays).toHaveLength(0)
  })

  it('a Close tap goes through runInterceptor first, and does nothing when nothing intercepts', () => {
    expect(c.runInterceptor()).toBe(false)
    let ran = false
    const off = c.intercept({ run: () => { ran = true } })
    expect(c.runInterceptor()).toBe(true)
    expect(ran).toBe(true)
    off()
  })

  it('closing several screens at once lands on the right entry', async () => {
    c.tab(train)
    c.push({ ...train, overlays: [{ kind: 'quicklog' }] })
    c.push({ ...train, overlays: [{ kind: 'quicklog' }, { kind: 'allSessions' }] })
    await tick()
    c.back(2)
    await tick(80)
    expect(c.state.overlays).toHaveLength(0)
    expect(c.state.tab).toBe('train')
    window.history.back()
    await tick()
    expect(c.state.tab).toBe('home')
  })
})
