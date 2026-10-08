// Rest weeks (spec 3.4): written to the weekFlags store. The streak logic already skips flagged weeks.
import type { LoopLabDb } from '../db/db'
import type { WeekFlag } from '../db/types'
import { weekStartOf } from './dates'
import { nowIso } from './id'

export async function setRestWeek(db: LoopLabDb, weekStart: string, isRest: boolean, today: string): Promise<void> {
  if (weekStartOf(weekStart) !== weekStart) throw new Error('A week must be identified by its Monday.')
  if (weekStart > weekStartOf(today)) throw new Error('Only past or current weeks can be marked as rest weeks.')
  const existing = await db.weekFlags.get(weekStart)
  const ts = nowIso()
  const flag: WeekFlag = { weekStart, isRest, createdAt: existing?.createdAt ?? ts, updatedAt: ts }
  await db.weekFlags.put(flag)
}

export async function loadRestWeeks(db: LoopLabDb): Promise<Set<string>> {
  return new Set((await db.weekFlags.toArray()).filter((f) => f.isRest).map((f) => f.weekStart))
}
