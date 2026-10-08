// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Dexie from 'dexie'

vi.mock('./pwa/registerSW', () => ({ startServiceWorker: () => ({ applyUpdate: () => {} }) }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import App from './App'
import { getDb } from './db/db'

let root: Root | null = null
afterEach(async () => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
  getDb().close()
  await Dexie.delete('loop-lab')
})

async function mount() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => { root!.render(<App />) })
  // wait for database open + seeding
  for (let i = 0; i < 100 && !document.body.textContent?.includes('robot sessions this week'); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  }
}

describe('app shell', () => {
  it('shows five tabs, the week card and the seeded content counts on Home', async () => {
    await mount()
    const tabs = [...document.querySelectorAll('nav[aria-label="Main"] button')].map((b) => b.textContent)
    expect(tabs).toEqual(['Home', 'Train', 'Progress', 'Matches', 'Data'])
    expect(document.querySelector('[data-testid="count-categories"]')?.textContent).toBe('7')
    expect(document.querySelector('[data-testid="count-drills"]')?.textContent).toBe('25')
    expect(document.querySelector('[data-testid="count-templates"]')?.textContent).toBe('24')
    expect(document.querySelector('[data-testid="count-programs"]')?.textContent).toBe('7')
    expect(document.body.textContent).toContain('of 3')
  })

  it('every tab renders; Data shows the storage line; theme switch changes data-theme', async () => {
    await mount()
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Main"] button')]
    for (const b of buttons.slice(1)) {
      await act(async () => { b.click() })
      // Progress, Matches and Data load on demand: wait for their heading.
      for (let i = 0; i < 100 && !document.querySelector('main h1'); i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      expect(document.querySelector('main h1')).not.toBeNull()
    }
    for (let i = 0; i < 100 && !document.body.textContent?.includes('Persistent storage'); i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(document.body.textContent).toContain('Persistent storage')
    // The theme switch lives in Settings and Help (reached from the Data tab).
    const settingsButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Settings and help')!
    await act(async () => { settingsButton.click() })
    const findLight = () => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Light')
    for (let i = 0; i < 100 && !findLight(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const light = findLight()!
    await act(async () => { light.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
