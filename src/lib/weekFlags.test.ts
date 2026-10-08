import { describe, expect, it } from 'vitest'
import { addSession } from '../test/fixtures'
import { useSeededDb } from '../test/helpers'
import { loadHome } from './homeData'
import { loadRestWeeks, setRestWeek } from './weekFlags'

const harness = useSeededDb()
const today = '2026-10-07' // Wednesday; current week starts 2026-10-05

async function threeSessions(db: Awaited<ReturnType<typeof harness.create>>, monday: string) {
  for (const d of [monday, monday.replace(/-(\d\d)$/, (_m, x) => '-' + String(Number(x) + 1).padStart(2, '0')), monday.replace(/-(\d\d)$/, (_m, x) => '-' + String(Number(x) + 2).padStart(2, '0'))]) await addSession(db, { date: d })
}

describe('rest weeks', () => {
  it('writes the flag and reads it back; can be undone', async () => {
    const db = await harness.create()
    await setRestWeek(db, '2026-09-21', true, today)
    expect([...(await loadRestWeeks(db))]).toEqual(['2026-09-21'])
    await setRestWeek(db, '2026-09-21', false, today)
    expect((await loadRestWeeks(db)).size).toBe(0)
  })
  it('only accepts Mondays that are not in the future', async () => {
    const db = await harness.create()
    await expect(setRestWeek(db, '2026-09-22', true, today)).rejects.toThrow(/Monday/)
    await expect(setRestWeek(db, '2026-10-12', true, today)).rejects.toThrow(/past or current/)
    await setRestWeek(db, '2026-10-05', true, today)
  })
  it('a rest week in the middle keeps the streak unbroken (spec 18)', async () => {
    const db = await harness.create()
    await threeSessions(db, '2026-09-14') // met
    // week of 09-21: nothing logged (holiday)
    await threeSessions(db, '2026-09-28') // met
    expect((await loadHome(db, today, 3)).streak).toEqual({ current: 1, longest: 1 })
    await setRestWeek(db, '2026-09-21', true, today)
    expect((await loadHome(db, today, 3)).streak).toEqual({ current: 2, longest: 2 })
    await setRestWeek(db, '2026-09-21', false, today)
    expect((await loadHome(db, today, 3)).streak).toEqual({ current: 1, longest: 1 })
  })
})
