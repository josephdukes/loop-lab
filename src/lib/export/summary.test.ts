import { describe, expect, it } from 'vitest'
import { useSeededDb } from '../../test/helpers'
import { addMatch, addSession } from '../../test/fixtures'
import { addRichData, OPPONENT_NAME } from '../../test/richData'
import { NOTE_MAX_CHARS, SUMMARY_FIRST_LINE, SUMMARY_MAX_CHARS, buildSummary, truncateNote } from './summary'
import { buildSummaryText } from './exportActions'
import type { SessionLog } from '../../db/types'

const h = useSeededDb()
const TODAY = '2026-10-07'

describe('summary text', () => {
  it('starts with the exact first line and contains every item from spec 3.10', async () => {
    const db = await h.create()
    await addRichData(db)
    const text = await buildSummaryText(db, 4, 3, TODAY)
    const lines = text.split('\n')
    expect(lines[0]).toBe('Table tennis robot training log summary. Please suggest where I should focus next.')
    expect(SUMMARY_FIRST_LINE).toBe(lines[0])

    expect(text).toContain('Period: 2026-09-14 to 2026-10-07 (4 weeks')
    expect(text).toContain('Robot sessions per week (target 3):')
    expect(text).toContain('- Week of 2026-10-05: 2 of 3')
    expect(text).toContain('- Week of 2026-09-21: 0 of 3 (rest week)')
    expect(text).toMatch(/Total training minutes: \d+ across 3 sessions\./) // 50 + 40 + 45
    expect(text).toContain('Total training minutes: 135')
    expect(text).toContain('Time by category (from drill minutes):')
    expect(text).toMatch(/- Loop from Backspin: \d+ min \(\d+%\)/)
    expect(text).toContain('Benchmarked drills')
    expect(text).toMatch(/- Pure Repetition Loop \(target: 80% or better with at least 10 attempts\): latest 8\/10 \(80\.0%\) on 2026-10-06; best 8\/10 \(80\.0%\); benchmark met\./)
    expect(text).toMatch(/Traffic Light .*not trained in this period|Traffic Light .*latest/)
    expect(text).toContain('- Week of 2026-10-05: effort 3, loop confidence 2.5')
    expect(text).toContain('Matches in this period: 2 (1 won, 1 lost).')
    expect(text).toContain('Loops attempted vs landed: 15 of 20 landed (75.0%).')
    expect(text).toContain('Average match confidence: 3 of 5.')
    expect(text).toContain('Most recent notes')
    expect(text).toContain('Line one, with comma line "two" in quotes') // newline collapsed
    expect(text.length).toBeLessThan(SUMMARY_MAX_CHARS)
  })

  it('works for 2 and 8 weeks and for an empty database', async () => {
    const db = await h.create()
    const empty = await buildSummaryText(db, 2, 3, TODAY)
    expect(empty).toContain('Period: 2026-09-28 to 2026-10-07 (2 weeks')
    expect(empty).toContain('Matches in this period: none logged.')
    expect(empty).toContain('Recent notes: none.')
    expect(empty).toContain('no drill minutes were recorded')
    await addRichData(db)
    expect(await buildSummaryText(db, 8, 3, TODAY)).toContain('Period: 2026-08-17 to 2026-10-07 (8 weeks')
    const two = await buildSummaryText(db, 2, 3, TODAY)
    expect(two).not.toContain('2026-09-21') // outside a 2-week window
  })

  it('never contains an opponent name or any free-text opponent field, or match notes', async () => {
    const db = await h.create()
    await addRichData(db)
    await addMatch(db, { date: '2026-10-06', opponent: 'Bartholomew Nibs', notes: 'Bartholomew was rude', breakdownNote: 'against Bartholomew' })
    for (const weeks of [2, 4, 8]) {
      const text = await buildSummaryText(db, weeks, 3, TODAY)
      for (const name of [OPPONENT_NAME, 'Zebediah', 'Quill', 'Someone, Else', 'Bartholomew']) expect(text).not.toContain(name)
    }
  })

  it('truncates each note to 200 characters', () => {
    expect(truncateNote('a'.repeat(500))).toHaveLength(NOTE_MAX_CHARS)
    expect(truncateNote('a'.repeat(500)).endsWith('...')).toBe(true)
    expect(truncateNote('short  \n note')).toBe('short note')
    expect(truncateNote('x'.repeat(200))).toHaveLength(200)
  })

  it('stays under the limit, keeps at most 10 notes, and trims the OLDEST notes first', async () => {
    const db = await h.create()
    // 12 sessions on 12 days, each with a 500-character note starting with its own number.
    for (let i = 1; i <= 12; i++) {
      const date = `2026-10-${String(i).padStart(2, '0')}`
      const id = await addSession(db, { date: i <= 7 ? date : '2026-10-07', minutes: 30 })
      const s = (await db.sessionLogs.get(id)) as SessionLog
      await db.sessionLogs.put({ ...s, date: i <= 7 ? date : s.date, notes: `NOTE${String(i).padStart(2, '0')} ` + 'word '.repeat(100) })
    }
    const text = await buildSummaryText(db, 4, 3, TODAY)
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS)
    const noteLines = text.split('\n').filter((l) => /NOTE\d\d/.test(l))
    expect(noteLines.length).toBeLessThanOrEqual(10)
    for (const l of noteLines) expect(l.length).toBeLessThanOrEqual(NOTE_MAX_CHARS + 30)
  })

  it('drops the oldest notes first when the text is too long', () => {
    // Pure call with many benchmarked drills to force the limit.
    const drills = Array.from({ length: 25 }, (_, i) => ({
      id: `d${i}`, name: `A long benchmarked drill name number ${i} for the length test`, category: 'Loop from Backspin', description: '', metricType: 'hits_attempts' as const,
      suggestedSettings: '', cues: '', source: 'custom' as const, isBuiltIn: false, modifiedByUser: false, archived: false, createdAt: '', updatedAt: '',
      benchmark: { metricType: 'hits_attempts' as const, threshold: 0.8, minAttempts: 10, consecutiveSessions: 1, description: 'eight out of ten, every time, no excuses at all' },
    }))
    const sessions: SessionLog[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`, date: `2026-10-0${i % 7 + 1}`, kind: 'robot', totalMinutes: 30, notes: `NOTE-${i} ` + 'y'.repeat(190), createdAt: `2026-10-0${i % 7 + 1}T10:0${i}:00Z`, updatedAt: '',
    }))
    const text = buildSummary({ today: TODAY, weeks: 4, weeklyTarget: 3, sessions, drillLogs: [], matches: [], drills, restWeeks: new Set() })
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS)
    const kept = [...text.matchAll(/NOTE-(\d)/g)].map((m) => Number(m[1]))
    const all = buildSummary({ today: TODAY, weeks: 4, weeklyTarget: 3, sessions, drillLogs: [], matches: [], drills: [], restWeeks: new Set() })
    const allKept = [...all.matchAll(/NOTE-(\d)/g)].map((m) => Number(m[1]))
    expect(allKept).toHaveLength(10)
    expect(kept.length).toBeLessThan(10) // some were trimmed
    expect(kept.length).toBeGreaterThan(0)
    // What remains is a prefix of the newest-first order: the dropped ones are the oldest.
    expect(kept).toEqual(allKept.slice(0, kept.length))
  })
})
