// Shared helpers for database-level tests.
import Dexie from 'dexie'
import { afterEach } from 'vitest'
import { LoopLabDb } from '../db/db'
import { seedBuiltInContent } from '../content/seed'
import type { Program } from '../db/types'
import { runnerReducer, type RunnerAction, type RunnerState } from '../lib/runnerState'

let n = 0
const names: string[] = []

/** A fresh, seeded database; deleted after each test. Call at module level of a test file. */
export function useSeededDb() {
  const holder: { db: LoopLabDb } = { db: undefined as unknown as LoopLabDb }
  afterEach(async () => {
    holder.db?.close()
    for (const name of names.splice(0)) await Dexie.delete(name)
  })
  return {
    async create(): Promise<LoopLabDb> {
      const name = `stage2-${++n}-${Math.random().toString(36).slice(2)}`
      names.push(name)
      holder.db = new LoopLabDb(name)
      await holder.db.open()
      await seedBuiltInContent(holder.db)
      return holder.db
    },
  }
}

export async function programByKey(db: LoopLabDb, key: string): Promise<Program> {
  const p = (await db.programs.toArray()).find((x) => x.builtInKey === key)
  if (!p) throw new Error('no program ' + key)
  return p
}

/** Give every drill in the state a valid result (a hit/miss mix, streak, score, rating or minutes). */
export function recordEverything(state: RunnerState, overrides: Record<string, RunnerAction[]> = {}): RunnerState {
  let s = state
  s.drills.forEach((d, index) => {
    const extra = overrides[d.name]
    if (extra) {
      for (const a of extra) s = runnerReducer(s, a)
      return
    }
    switch (d.metricType) {
      case 'hits_attempts':
        for (let i = 0; i < 10; i++) s = runnerReducer(s, { type: 'hitMiss', index, result: i < 8 ? 'hit' : 'miss' })
        break
      case 'streak':
        s = runnerReducer(s, { type: 'adjust', index, field: 'streakCurrent', delta: 3 })
        s = runnerReducer(s, { type: 'newBest', index })
        break
      case 'score_vs_robot':
        s = runnerReducer(s, { type: 'adjust', index, field: 'scoreYou', delta: 11 })
        s = runnerReducer(s, { type: 'adjust', index, field: 'scoreRobot', delta: 7 })
        break
      case 'duration':
        s = runnerReducer(s, { type: 'setManualMinutes', index, minutes: 5 })
        break
      case 'rating':
        s = runnerReducer(s, { type: 'setRating', index, rating: 4 })
        break
    }
  })
  return s
}
