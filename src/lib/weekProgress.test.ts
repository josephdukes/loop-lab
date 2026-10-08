import { afterEach, expect, it } from 'vitest'
import Dexie from 'dexie'
import { LoopLabDb } from '../db/db'
import { weekProgressFor } from './weekProgress'
import type { DrillLog, SessionLog } from '../db/types'

const name = 'weekprogresstest'
afterEach(async () => { await Dexie.delete(name) })

const ts = { createdAt: 'x', updatedAt: 'x' }
const session = (id: string, date: string, kind: 'robot' | 'club'): SessionLog => ({ id, date, kind, totalMinutes: 30, notes: '', ...ts })
const drillLog = (id: string, sessionId: string): DrillLog => ({ id, sessionId, order: 1, drillId: 'd', drillNameSnapshot: 'd', categorySnapshot: 'c', metricType: 'duration', ...ts })

it('counts robot sessions with drill logs in the Monday-start week, ignoring other weeks, empty sessions and club', async () => {
  const db = new LoopLabDb(name)
  await db.sessionLogs.bulkPut([
    session('a', '2026-10-19', 'robot'), // Monday of the clock-change week
    session('b', '2026-10-25', 'robot'), // Sunday, the 25-hour day
    session('c', '2026-10-26', 'robot'), // next week
    session('d', '2026-10-21', 'robot'), // no drill logs: does not count
    session('e', '2026-10-22', 'club'),
  ])
  await db.drillLogs.bulkPut([drillLog('1', 'a'), drillLog('2', 'b'), drillLog('3', 'c')])
  expect(await weekProgressFor(db, '2026-10-25')).toEqual({ weekStart: '2026-10-19', robotSessions: 2, clubSessions: 1 })
  expect((await weekProgressFor(db, '2026-10-26')).robotSessions).toBe(1)
  db.close()
})
