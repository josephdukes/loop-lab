import { describe, expect, it, vi } from 'vitest'
import { useSeededDb, programByKey, recordEverything } from '../test/helpers'
import { Autosaver, loadActiveState } from './activeSessionStore'
import { completedSessionsInRun, getActiveRun, pauseRun, resumeRun, setRunPosition, startProgramRun } from './programRuns'
import { loadRunView } from './runView'
import { runnerReducer } from './runnerState'
import { draftFromState, deleteSession, restoreSession, saveSession, updateSession } from './sessionService'
import { loadStateForEdit } from './sessionDraft'
import { buildQuickLogState, buildStateFromRun, buildStateFromTemplate, drillToRunnerDrill } from './startSession'
import { loadHome } from './homeData'

const h = useSeededDb()
const NOW = Date.UTC(2026, 9, 7, 12, 0, 0)
const TODAY = '2026-10-07' // Wednesday

async function templateByKey(db: Awaited<ReturnType<typeof h.create>>, key: string) {
  const t = (await db.sessionTemplates.toArray()).find((x) => x.builtInKey === key)
  if (!t) throw new Error(key)
  return t
}

describe('save session', () => {
  it('creates the session log and drill logs with snapshots, targets and benchmarkMet', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const state = recordEverything(await buildStateFromTemplate(db, t.id, new Date(2026, 9, 7)))
    const onFirstSave = vi.fn()
    const { sessionId, isFirst } = await saveSession(db, draftFromState({ ...state, summary: { ...state.summary, effort: 4, loopConfidence: 3, notes: 'felt good' } }, { now: NOW, startedAt: state.startedAt, endedAt: '2026-10-07T12:00:00.000Z' }), { now: NOW, onFirstSave })

    expect(isFirst).toBe(true)
    expect(onFirstSave).toHaveBeenCalledTimes(1)
    const session = await db.sessionLogs.get(sessionId)
    expect(session).toMatchObject({ date: TODAY, kind: 'robot', effort: 4, loopConfidence: 3, notes: 'felt good', templateNameSnapshot: 'Original Phase 1 Session' })
    expect(session?.programRunId).toBeUndefined()
    const logs = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
    expect(logs.map((l) => l.drillNameSnapshot)).toEqual(['Pure Repetition Loop', 'Spin Calibration Blocks', 'Push-Push-Loop Pattern', 'Free Multiball Cool-down'])
    expect(logs[0]).toMatchObject({ hits: 8, attempts: 10, categorySnapshot: 'Loop from Backspin', benchmarkMet: true })
    expect(logs[0].targetSnapshot).toMatchObject({ value: 0.8, minAttempts: 10 })
    expect(logs[1].benchmarkMet).toBeNull() // no benchmark on Spin Calibration Blocks
    expect(logs[3]).toMatchObject({ metricType: 'duration', durationMin: 5 })
  })

  it('calls the persistent-storage hook only after the very first saved session', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const hook = vi.fn()
    for (let i = 0; i < 2; i++) {
      const s = recordEverything(await buildStateFromTemplate(db, t.id))
      await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW, onFirstSave: hook })
    }
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('refuses to save when no drill has a result', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const s = await buildStateFromTemplate(db, t.id)
    await expect(saveSession(db, draftFromState(s, { now: NOW }))).rejects.toThrow(/Nothing to save/)
  })

  it('a club template saves as kind club and does not count toward the weekly target', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-club')
    const s = recordEverything(await buildStateFromTemplate(db, t.id, new Date(2026, 9, 7)))
    expect(s.kind).toBe('club')
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    expect((await db.sessionLogs.get(sessionId))?.kind).toBe('club')
    const home = await loadHome(db, TODAY, 3)
    expect(home).toMatchObject({ robotThisWeek: 0, clubThisWeek: 1 })
  })

  it('a quick-logged past session counts toward the week of its date', async () => {
    const db = await h.create()
    const drill = (await db.drills.toArray()).find((d) => d.builtInKey === 'orig-A')!
    let s = await buildQuickLogState(db, {}, new Date(2026, 9, 7))
    s = runnerReducer(s, { type: 'addDrill', drill: drillToRunnerDrill(drill) })
    s = recordEverything(runnerReducer(s, { type: 'setMeta', patch: { date: '2026-09-30' } }))
    await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    expect((await loadHome(db, TODAY, 3)).robotThisWeek).toBe(0) // 30 Sep is in the previous week
    expect((await loadHome(db, '2026-09-30', 3)).robotThisWeek).toBe(1)
  })
})

describe('autosave and resume', () => {
  it('writes the state on every change and restores it exactly', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    let state = await buildStateFromTemplate(db, t.id)
    const saver = new Autosaver(db)
    const actions = [
      { type: 'hitMiss', index: 0, result: 'hit' },
      { type: 'hitMiss', index: 0, result: 'miss' },
      { type: 'setNote', index: 0, note: 'pushed too early' },
      { type: 'next', now: NOW },
      { type: 'adjust', index: 1, field: 'attempts', delta: 4 },
    ] as const
    for (const a of actions) {
      state = runnerReducer(state, a)
      void saver.save(state)
    }
    await saver.flush()
    const loaded = await loadActiveState(db)
    expect(loaded.kind).toBe('ok')
    if (loaded.kind !== 'ok') return
    expect(loaded.state).toEqual(state)
    expect(loaded.state.currentIndex).toBe(1)
    expect(loaded.state.drills[0]).toMatchObject({ hits: 1, attempts: 2, note: 'pushed too early' })
    // Resuming pauses nothing that was not running, and keeps all values.
    const resumed = runnerReducer(loaded.state, { type: 'restore', savedAtMs: loaded.savedAtMs })
    expect(resumed.drills.map((d) => [d.hits, d.attempts])).toEqual(state.drills.map((d) => [d.hits, d.attempts]))
  })

  it('saving the session clears the active session', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const state = recordEverything(await buildStateFromTemplate(db, t.id))
    const saver = new Autosaver(db)
    await saver.save(state)
    expect((await loadActiveState(db)).kind).toBe('ok')
    await saver.close()
    await saveSession(db, draftFromState(state, { now: NOW }), { now: NOW })
    expect((await loadActiveState(db)).kind).toBe('none')
  })

  it('a corrupt active record is reported, not thrown', async () => {
    const db = await h.create()
    await db.activeSession.put({ key: 'active', state: { nonsense: true }, createdAt: '', updatedAt: '' })
    expect((await loadActiveState(db)).kind).toBe('corrupt')
  })
})

describe('edit, delete and undo', () => {
  it('edit replaces the drill logs and keeps the session id and program attachment', async () => {
    const db = await h.create()
    const program = await programByKey(db, 'P2')
    const run = await startProgramRun(db, program, TODAY)
    const s = recordEverything(await buildStateFromRun(db, run.id, new Date(2026, 9, 7)))
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })

    const edit = await loadStateForEdit(db, sessionId)
    let e = runnerReducer(edit, { type: 'setSummary', patch: { effort: 5, notes: 'edited' } })
    e = runnerReducer(e, { type: 'setMeta', patch: { date: '2026-10-06' } })
    e = runnerReducer(e, { type: 'adjust', index: 0, field: 'attempts', delta: 0 })
    await updateSession(db, sessionId, draftFromState(e, { now: NOW }), { now: NOW })

    const after = await db.sessionLogs.get(sessionId)
    expect(after).toMatchObject({ id: sessionId, date: '2026-10-06', effort: 5, notes: 'edited', programRunId: run.id, programWeek: 1, sessionLabel: 'Session 1' })
    expect(await db.drillLogs.where('sessionId').equals(sessionId).count()).toBe(s.drills.length)
    expect(await db.sessionLogs.count()).toBe(1)
  })

  it('editing a session keeps drill-log ids stable, mints ids only for new rows and deletes only removed rows', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const s = recordEverything(await buildStateFromTemplate(db, t.id))
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    const before = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
    // change a metric
    let e = await loadStateForEdit(db, sessionId)
    e = runnerReducer(e, { type: 'hitMiss', index: 0, result: 'miss' })
    await updateSession(db, sessionId, draftFromState(e, { now: NOW }), { now: NOW })
    let after = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
    expect(after.map((l) => l.id)).toEqual(before.map((l) => l.id))
    expect(after[0].attempts).toBe(before[0].attempts! + 1)
    expect(after[0].createdAt).toBe(before[0].createdAt)
    // remove the middle drill: the other ids survive, only that one goes
    e = await loadStateForEdit(db, sessionId)
    const removed = e.drills[1]
    e = { ...e, drills: e.drills.filter((_, i) => i !== 1) }
    await updateSession(db, sessionId, draftFromState(e, { now: NOW }), { now: NOW })
    after = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)
    expect(after.map((l) => l.id)).toEqual(before.filter((l) => l.drillId !== removed.drillId).map((l) => l.id))
    // add a row back: it gets a new id, the rest keep theirs
    e = await loadStateForEdit(db, sessionId)
    e = { ...e, drills: [...e.drills, { ...removed, key: 'added' }] }
    await updateSession(db, sessionId, draftFromState(e, { now: NOW }), { now: NOW })
    const final = await db.drillLogs.where('sessionId').equals(sessionId).toArray()
    expect(final).toHaveLength(before.length)
    const keptIds = before.filter((l) => l.drillId !== removed.drillId).map((l) => l.id)
    expect(keptIds.every((id) => final.some((l) => l.id === id))).toBe(true)
  })

  it('an edited log keeps its original target snapshot and re-evaluates benchmarkMet against it', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const s = recordEverything(await buildStateFromTemplate(db, t.id))
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    // Change the drill's benchmark afterwards: history must not be rewritten.
    const drillA = (await db.drills.toArray()).find((d) => d.builtInKey === 'orig-A')!
    await db.drills.put({ ...drillA, benchmark: { ...drillA.benchmark!, threshold: 0.95 } })
    let e = await loadStateForEdit(db, sessionId)
    e = runnerReducer(e, { type: 'hitMiss', index: 0, result: 'miss' }) // 8/11 = 72.7% is below the ORIGINAL 0.8 target
    await updateSession(db, sessionId, draftFromState(e, { now: NOW }), { now: NOW })
    const logA = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).find((l) => l.drillNameSnapshot === 'Pure Repetition Loop')!
    expect(logA).toMatchObject({ hits: 8, attempts: 11, benchmarkMet: false })
    expect(logA.targetSnapshot?.value).toBe(0.8)
  })

  it('delete removes the session and its drill logs; Undo restores them exactly', async () => {
    const db = await h.create()
    const t = await templateByKey(db, 'T-orig-p1')
    const s = recordEverything(await buildStateFromTemplate(db, t.id))
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    const beforeSession = await db.sessionLogs.get(sessionId)
    const beforeLogs = (await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)

    const snapshot = await deleteSession(db, sessionId)
    expect(snapshot).not.toBeNull()
    expect(await db.sessionLogs.count()).toBe(0)
    expect(await db.drillLogs.count()).toBe(0)
    expect((await loadHome(db, TODAY, 3)).robotThisWeek).toBe(0)

    await restoreSession(db, snapshot!)
    expect(await db.sessionLogs.get(sessionId)).toEqual(beforeSession)
    expect((await db.drillLogs.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order)).toEqual(beforeLogs)
    expect((await loadHome(db, TODAY, 3)).robotThisWeek).toBe(1)
  })

  it('deleting a session that is not there returns null', async () => {
    const db = await h.create()
    expect(await deleteSession(db, 'missing')).toBeNull()
  })

  it('deleting a run session moves the program position back; Undo moves it forward again', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    const s = recordEverything(await buildStateFromRun(db, run.id))
    const { sessionId } = await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    expect(await completedSessionsInRun(db, run.id)).toBe(1)
    const snap = await deleteSession(db, sessionId)
    expect(await completedSessionsInRun(db, run.id)).toBe(0)
    await restoreSession(db, snap!)
    expect(await completedSessionsInRun(db, run.id)).toBe(1)
  })
})

describe('program runs and position', () => {
  it('starting the Pressure Loop plan makes Home show Week 1, Session 1 with the slot override as the target', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P2'), TODAY)
    expect(run).toMatchObject({ status: 'active', startDate: TODAY, manualOffsetSessions: 0, cycleNumber: 1 })
    const home = await loadHome(db, TODAY, 3)
    expect(home.runView?.position).toMatchObject({ week: 1, session: 1 })
    expect(home.runView?.nextUp?.label).toBe('Session 1')
    expect(home.runView?.nextUp?.totalMinutes).toBe(40)
    const streak = home.runView!.nextUp!.items.find((i) => i.drill.builtInKey === 'pl-streak')!
    expect(streak.benchmark?.threshold).toBe(8)
    const state = await buildStateFromRun(db, run.id)
    expect(state).toMatchObject({ programRunId: run.id, programWeek: 1, sessionLabel: 'Session 1', kind: 'robot' })
    expect(state.drills.find((d) => d.name === 'Pressure Streak Game')?.target?.threshold).toBe(8)
  })

  it('position advances by completed sessions, attaching run, week and label', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    for (let i = 0; i < 7; i++) {
      const s = recordEverything(await buildStateFromRun(db, run.id))
      await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    }
    const view = await loadRunView(db, (await db.programRuns.get(run.id))!, TODAY)
    expect(view?.completed).toBe(7)
    expect(view?.position).toMatchObject({ week: 3, session: 2 })
    const last = (await db.sessionLogs.toArray()).filter((s) => s.programWeek === 3)
    expect(last.map((s) => s.sessionLabel).sort()).toEqual(['Session 1', 'Session 2'].slice(0, last.length))
    expect(last.every((s) => s.programRunId === run.id)).toBe(true)
  })

  it('a non-repeating run completes after its last session; a repeating run rolls into the next cycle', async () => {
    const db = await h.create()
    const p6 = await startProgramRun(db, await programByKey(db, 'P6'), TODAY) // 2 weeks x 3 = 6 sessions
    for (let i = 0; i < 6; i++) await saveSession(db, draftFromState(recordEverything(await buildStateFromRun(db, p6.id)), { now: NOW }), { now: NOW })
    expect((await db.programRuns.get(p6.id))?.status).toBe('completed')
    await expect(buildStateFromRun(db, p6.id)).rejects.toThrow(/finished/)

    const p5 = await startProgramRun(db, await programByKey(db, 'P5'), TODAY) // 1 week, repeating
    for (let i = 0; i < 4; i++) await saveSession(db, draftFromState(recordEverything(await buildStateFromRun(db, p5.id)), { now: NOW }), { now: NOW })
    const r5 = await db.programRuns.get(p5.id)
    expect(r5).toMatchObject({ status: 'active', cycleNumber: 2 })
    const view = await loadRunView(db, r5!, TODAY)
    expect(view?.position).toMatchObject({ week: 1, session: 2, cycleNumber: 2 })
  })

  it('only one run is active at a time; pause and resume work', async () => {
    const db = await h.create()
    const a = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    const b = await startProgramRun(db, await programByKey(db, 'P2'), TODAY)
    expect((await db.programRuns.get(a.id))?.status).toBe('paused')
    expect((await getActiveRun(db))?.id).toBe(b.id)
    await pauseRun(db, b.id)
    expect(await getActiveRun(db)).toBeUndefined()
    await resumeRun(db, a.id)
    expect((await getActiveRun(db))?.id).toBe(a.id)
  })

  it('Set position stores manualOffsetSessions and moves the next-up session', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    await saveSession(db, draftFromState(recordEverything(await buildStateFromRun(db, run.id)), { now: NOW }), { now: NOW })
    await setRunPosition(db, run.id, 5, 3)
    const r = (await db.programRuns.get(run.id))!
    expect(r.manualOffsetSessions).toBe((5 - 1) * 3 + 2 - 1)
    expect((await loadRunView(db, r, TODAY))?.position).toMatchObject({ week: 5, session: 3 })
    // The next session started from the run is saved with that week.
    const st = await buildStateFromRun(db, run.id)
    expect(st).toMatchObject({ programWeek: 5, sessionLabel: 'Session 3' })
    // A completed run set back becomes active again.
    await setRunPosition(db, run.id, 12, 3)
    await saveSession(db, draftFromState(recordEverything(await buildStateFromRun(db, run.id)), { now: NOW }), { now: NOW })
    expect((await db.programRuns.get(run.id))?.status).toBe('completed')
    await setRunPosition(db, run.id, 1, 1)
    expect((await db.programRuns.get(run.id))?.status).toBe('active')
  })
})

describe('ready to move on and repeat phase (spec 3.7)', () => {
  async function doSessions(db: Awaited<ReturnType<typeof h.create>>, runId: string, count: number, hits: number) {
    for (let i = 0; i < count; i++) {
      let s = await buildStateFromRun(db, runId)
      s = recordEverything(s, {
        'Pure Repetition Loop': Array.from({ length: 10 }, (_, k) => ({ type: 'hitMiss', index: 0, result: k < hits ? 'hit' : 'miss' }) as const),
      })
      await saveSession(db, draftFromState(s, { now: NOW }), { now: NOW })
    }
  }

  it('shows ready when the current week benchmark is met, not when it is below', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    await doSessions(db, run.id, 1, 6) // 6/10 in week 1: below 0.8
    let view = await loadRunView(db, (await db.programRuns.get(run.id))!, TODAY)
    expect(view?.ready).toBe(false)
    expect(view?.weekEntries[0].board.status).toBe('not_met')
    await doSessions(db, run.id, 1, 9)
    view = await loadRunView(db, (await db.programRuns.get(run.id))!, TODAY)
    expect(view?.weekEntries[0].board.status).toBe('met')
    expect(view?.ready).toBe(true)
  })

  it('suggests repeating the phase after 3 weeks without the phase benchmark; not when it was met', async () => {
    const db = await h.create()
    const run = await startProgramRun(db, await programByKey(db, 'P1'), TODAY)
    await doSessions(db, run.id, 9, 5) // nine sessions at 5/10
    const view = await loadRunView(db, (await db.programRuns.get(run.id))!, TODAY)
    expect(view?.position.week).toBe(4)
    expect(view?.repeatPhase?.phase).toMatchObject({ startWeek: 1, endWeek: 3 })

    const db2 = await h.create()
    const run2 = await startProgramRun(db2, await programByKey(db2, 'P1'), TODAY)
    await doSessions(db2, run2.id, 9, 9)
    expect((await loadRunView(db2, (await db2.programRuns.get(run2.id))!, TODAY))?.repeatPhase).toBeNull()
  })
})
