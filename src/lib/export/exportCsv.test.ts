import { describe, expect, it } from 'vitest'
import { useSeededDb } from '../../test/helpers'
import { addRichData, FORMULA_NOTE, MULTILINE_NOTE, OPPONENT_NAME } from '../../test/richData'
import { parseCsv } from '../../test/csvParse'
import { buildCsv, csvCell, fixed, guardText } from './csv'
import {
  DRILL_LOG_COLUMNS, MATCH_COLUMNS, SESSION_COLUMNS, buildAllCsvFiles, buildDrillLogsCsv, buildMatchesCsv, buildSessionsCsv, csvFilename, localTime,
} from './exportCsv'
import { loadExportData } from './exportActions'
import { backupFilename } from './exportCsv'

const h = useSeededDb()

describe('csv writer', () => {
  it('quotes cells with commas, quotes, CR or LF and doubles inner quotes', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('cr\rhere')).toBe('"cr\rhere"')
  })

  it('writes TRUE/FALSE, blanks, plain numbers and CRLF line ends', () => {
    expect(csvCell(true)).toBe('TRUE')
    expect(csvCell(false)).toBe('FALSE')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(1234567.5)).toBe('1234567.5')
    expect(csvCell(fixed(80, 1))).toBe('80.0')
    expect(buildCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n')
  })

  it('prefixes text starting with = + @ tab or CR with a single quote, but never numbers', () => {
    for (const bad of ['=SUM(A1)', '+1', '@cmd', '\tx', '\rx']) expect(guardText(bad)).toBe(`'${bad}`)
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('\rx')).toBe('"\'\rx"') // guarded, then quoted because it holds a CR
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(0)).toBe('0')
    expect(csvCell('safe =')).toBe('safe =')
  })
})

describe('the three CSV files', () => {
  it('has exactly the spec columns in order', () => {
    expect(DRILL_LOG_COLUMNS.join(',')).toBe(
      'log_id,session_id,date,session_start_time,program,program_week,session_label,drill_order,drill_id,drill_name,category,metric_type,hits,attempts,success_rate_pct,streak,score_you,score_robot,rating,duration_min,target_value,target_description,benchmark_met,robot_settings_used,drill_note',
    )
    expect(SESSION_COLUMNS.join(',')).toBe(
      'session_id,date,start_time,end_time,total_minutes,kind,program,program_week,session_label,template_name,effort_1_5,loop_confidence_1_5,drills_logged,drills_with_benchmark_met,notes',
    )
    expect(MATCH_COLUMNS.join(',')).toBe(
      'match_id,date,competition,opponent,opponent_style,result,games_score,serve_faced,loops_attempted,loops_landed,loop_success_pct,confidence_1_5,cue_used,breakdown_note,notes',
    )
  })

  it('writes the header text first and every row with the right number of cells', async () => {
    const db = await h.create()
    await addRichData(db)
    const data = await loadExportData(db)
    const files = buildAllCsvFiles(data, {}, '2026-10-07')
    const cols = [DRILL_LOG_COLUMNS, SESSION_COLUMNS, MATCH_COLUMNS]
    files.forEach((f, i) => {
      expect(f.text.startsWith(cols[i].join(',') + '\r\n')).toBe(true)
      expect(f.text.endsWith('\r\n')).toBe(true)
      const rows = parseCsv(f.text)
      expect(rows.length).toBeGreaterThan(1)
      for (const r of rows) expect(r).toHaveLength(cols[i].length)
    })
    expect(files.map((f) => f.filename)).toEqual(['loop-lab-drill-logs-2026-10-07.csv', 'loop-lab-sessions-2026-10-07.csv', 'loop-lab-matches-2026-10-07.csv'])
    expect(csvFilename('matches', '2026-01-02')).toBe('loop-lab-matches-2026-01-02.csv')
    expect(backupFilename('2026-01-02')).toBe('loop-lab-backup-2026-01-02.json')
  })

  it('keeps commas, quotes and newlines in notes intact, and guards a note that starts with =', async () => {
    const db = await h.create()
    await addRichData(db)
    const data = await loadExportData(db)

    const sessions = parseCsv(buildSessionsCsv(data))
    const head = sessions[0]
    const notesCol = head.indexOf('notes')
    const notes = sessions.slice(1).map((r) => r[notesCol])
    expect(notes).toContain(MULTILINE_NOTE) // comma, double quotes and a newline survive a round trip through the parser
    expect(notes).toContain("'=1+1") // the formula guard
    expect(notes).not.toContain('=1+1')

    const logs = parseCsv(buildDrillLogsCsv(data))
    const noteCol = logs[0].indexOf('drill_note')
    expect(logs.slice(1).map((r) => r[noteCol])).toContain("'" + FORMULA_NOTE)
    const settingsCol = logs[0].indexOf('robot_settings_used')
    expect(logs.slice(1).map((r) => r[settingsCol])).toContain('fast, "heavy" spin')

    // Numeric cells are never prefixed.
    const rawText = buildDrillLogsCsv(data)
    expect(rawText).not.toMatch(/'\d/)
    for (const r of logs.slice(1)) {
      for (const name of ['hits', 'attempts', 'drill_order', 'duration_min']) {
        const v = r[logs[0].indexOf(name)]
        expect(v === '' || /^-?\d+(\.\d+)?$/.test(v)).toBe(true)
      }
    }
  })

  it('writes TRUE, FALSE and blank for benchmark_met, and the success rate to one decimal place', async () => {
    const db = await h.create()
    await addRichData(db)
    const rows = parseCsv(buildDrillLogsCsv(await loadExportData(db)))
    const col = (n: string) => rows[0].indexOf(n)
    const values = new Set(rows.slice(1).map((r) => r[col('benchmark_met')]))
    expect(values.has('')).toBe(true)
    expect([...values].every((v) => ['TRUE', 'FALSE', ''].includes(v))).toBe(true)
    const met = rows.slice(1).find((r) => r[col('drill_name')] === 'Pure Repetition Loop')!
    expect(met[col('benchmark_met')]).toBe('TRUE') // 8/10 meets the 80% benchmark
    expect(met[col('success_rate_pct')]).toBe('80.0')
    expect(met[col('target_value')]).toBe('0.8')
    expect(met[col('metric_type')]).toBe('hits_attempts')
    // Metrics that are not hits/attempts have a blank success rate.
    const rating = rows.slice(1).find((r) => r[col('metric_type')] === 'rating')!
    expect(rating[col('success_rate_pct')]).toBe('')
    // Some logs fail their benchmark: build one directly.
    const data = await loadExportData(db)
    data.drillLogs[0] = { ...data.drillLogs[0], benchmarkMet: false }
    const failed = parseCsv(buildDrillLogsCsv(data))
    expect(failed.slice(1).some((r) => r[col('benchmark_met')] === 'FALSE')).toBe(true)
  })

  it('fills program, week, label, local start time and counts', async () => {
    const db = await h.create()
    await addRichData(db)
    const data = await loadExportData(db)
    const sessions = parseCsv(buildSessionsCsv(data))
    const c = (n: string) => sessions[0].indexOf(n)
    const runSession = sessions.slice(1).find((r) => r[c('date')] === '2026-10-05')!
    expect(runSession[c('program')]).toBe('Pressure Loop, 2 Weeks (post-league)')
    expect(runSession[c('program_week')]).toBe('1')
    expect(runSession[c('session_label')]).toBe('Session 1')
    expect(runSession[c('start_time')]).toBe('18:30')
    expect(runSession[c('end_time')]).toBe('19:20')
    expect(runSession[c('total_minutes')]).toBe('50')
    expect(runSession[c('effort_1_5')]).toBe('4')
    expect(runSession[c('loop_confidence_1_5')]).toBe('3')
    expect(Number(runSession[c('drills_logged')])).toBeGreaterThan(0)
    expect(Number(runSession[c('drills_with_benchmark_met')])).toBeGreaterThanOrEqual(0)
    const club = sessions.slice(1).find((r) => r[c('kind')] === 'club')!
    expect(club[c('program')]).toBe('')
    expect(club[c('start_time')]).toBe('')
    expect(localTime(undefined)).toBe('')
    expect(localTime('not a date')).toBe('')

    const logs = parseCsv(buildDrillLogsCsv(data))
    const lc = (n: string) => logs[0].indexOf(n)
    const first = logs.slice(1).find((r) => r[lc('date')] === '2026-10-05')!
    expect(first[lc('session_start_time')]).toBe('18:30')
    expect(first[lc('program')]).toBe('Pressure Loop, 2 Weeks (post-league)')
  })

  it('exports matches with the opponent, loop percentage to one decimal place and blanks', async () => {
    const db = await h.create()
    await addRichData(db)
    const rows = parseCsv(buildMatchesCsv(await loadExportData(db)))
    const c = (n: string) => rows[0].indexOf(n)
    expect(rows).toHaveLength(3)
    const first = rows[1]
    expect(first[c('date')]).toBe('2026-10-02')
    expect(first[c('opponent')]).toBe(OPPONENT_NAME)
    expect(first[c('loop_success_pct')]).toBe('75.0')
    expect(first[c('loops_attempted')]).toBe('20')
    const second = rows[2]
    expect(second[c('opponent')]).toBe('Someone, Else')
    expect(second[c('loops_attempted')]).toBe('')
    expect(second[c('loop_success_pct')]).toBe('')
    expect(second[c('cue_used')]).toBe("'+ let it drop")
  })

  it('filters by an inclusive date range on the session or match date', async () => {
    const db = await h.create()
    await addRichData(db)
    const data = await loadExportData(db)
    const dates = (csv: string) => parseCsv(csv).slice(1).map((r) => r[1])
    expect(dates(buildSessionsCsv(data, { from: '2026-10-05', to: '2026-10-05' }))).toEqual(['2026-10-05'])
    expect(dates(buildSessionsCsv(data, { from: '2026-10-05', to: '2026-10-06' }))).toHaveLength(2)
    expect(dates(buildSessionsCsv(data, { from: '2026-10-06' }))).toHaveLength(1)
    expect(dates(buildSessionsCsv(data, { to: '2026-10-03' }))).toEqual(['2026-10-03'])
    expect(dates(buildMatchesCsv(data, { from: '2026-10-03', to: '2026-10-04' }))).toEqual(['2026-10-04'])
    const logDates = parseCsv(buildDrillLogsCsv(data, { from: '2026-10-06', to: '2026-10-06' })).slice(1).map((r) => r[2])
    expect(logDates.length).toBeGreaterThan(0)
    expect(new Set(logDates)).toEqual(new Set(['2026-10-06']))
    expect(parseCsv(buildSessionsCsv(data, { from: '2030-01-01' }))).toHaveLength(1) // header only
  })
})
