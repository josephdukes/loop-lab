// A database with a bit of everything, built through the app's own services (stage 4 tests).
import type { LoopLabDb } from '../db/db'
import { newId } from '../lib/id'
import { programByKey, recordEverything } from './helpers'
import { addMatch, addSession } from './fixtures'
import { startProgramRun } from '../lib/programRuns'
import { buildQuickLogState, buildStateFromRun } from '../lib/startSession'
import { draftFromState, saveSession } from '../lib/sessionService'
import { runnerReducer } from '../lib/runnerState'
import { setRestWeek } from '../lib/weekFlags'
import { drillByKey } from './fixtures'
import { saveItem } from '../lib/libraryService'
import type { Drill } from '../db/types'

export const OPPONENT_NAME = 'Zebediah Quill'
export const FORMULA_NOTE = '=HYPERLINK("http://example.com","click"), then more'
export const MULTILINE_NOTE = 'Line one, with comma\nline "two" in quotes'

export interface RichIds { runId: string; sessionIds: string[]; matchIds: string[] }

/** Pressure Loop run with one saved run session, a quick log with awkward notes, a club session, matches, a rest week, a block review, a custom drill, an edited built-in and an unfinished session draft. */
export async function addRichData(db: LoopLabDb): Promise<RichIds> {
  const p2 = await programByKey(db, 'P2')
  const run = await startProgramRun(db, p2, '2026-10-05')

  const now = new Date(2026, 9, 5, 18, 30)
  let s = recordEverything(await buildStateFromRun(db, run.id, now))
  s = runnerReducer(s, { type: 'setNote', index: 0, note: FORMULA_NOTE })
  s = runnerReducer(s, { type: 'setSettings', index: 0, text: 'fast, "heavy" spin' })
  s = runnerReducer(s, { type: 'setSummary', patch: { effort: 4, loopConfidence: 3, notes: MULTILINE_NOTE, totalMinutes: 50 } })
  const saved = await saveSession(db, draftFromState(s, { now: now.getTime(), startedAt: now.toISOString(), endedAt: new Date(2026, 9, 5, 19, 20).toISOString() }), { now: now.getTime() })

  const qNow = new Date(2026, 9, 6, 9, 5)
  let q = recordEverything(await buildQuickLogState(db, { templateId: (await db.sessionTemplates.toArray()).find((t) => t.builtInKey === 'T-orig-p1')!.id }, qNow))
  q = runnerReducer(q, { type: 'setSummary', patch: { effort: 2, loopConfidence: 2, notes: '=1+1', totalMinutes: 40 } })
  const quick = await saveSession(db, draftFromState(q, { now: qNow.getTime(), startedAt: qNow.toISOString() }), { now: qNow.getTime() })

  const club = await addSession(db, { date: '2026-10-03', kind: 'club', minutes: 45, logs: [{ drillKey: 'sp-tactical', rating: 4, durationMin: 45 }] })
  const m1 = await addMatch(db, { date: '2026-10-02', opponent: OPPONENT_NAME, opponentStyle: 'chopper', result: 'W', loopsAttempted: 20, loopsLanded: 15, confidence: 4, notes: 'x', breakdownNote: 'Pushed long, then missed' })
  const m2 = await addMatch(db, { date: '2026-10-04', opponent: 'Someone, Else', opponentStyle: 'looper', result: 'L', confidence: 2, cueUsed: '+ let it drop' })

  await setRestWeek(db, '2026-09-21', true, '2026-10-07')
  await db.blockReviews.add({ id: newId(), programRunId: run.id, cycleNumber: 1, date: '2026-10-07', windowStart: '2026-09-09', windowEnd: '2026-10-07', emphasisNotes: 'more pressure', createdAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z' })

  const base = await drillByKey(db, 'orig-A')
  await saveItem(db, 'drill', { ...base, description: 'My edited description' } as Drill)
  const custom: Drill = {
    id: newId(), name: 'My custom drill', category: 'Footwork and Conditioning', description: 'x', metricType: 'rating', suggestedSettings: '', cues: '',
    source: 'custom', isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z',
  }
  await saveItem(db, 'drill', custom)
  await db.activeSession.put({ key: 'active', state: { version: 1, note: 'draft' }, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z' })

  return { runId: run.id, sessionIds: [saved.sessionId, quick.sessionId, club], matchIds: [m1, m2] }
}
