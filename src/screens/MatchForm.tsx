// Add or edit a match (spec 4 matchLogs): every field, delete with confirmation and 8-second Undo.
import { useEffect, useState } from 'react'
import { useApp } from '../appState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditorShell, FormErrors, parseNumber } from '../components/EditorShell'
import { ErrorBox, Loading } from '../components/ScreenState'
import { ScaleButtons } from '../components/ScaleButtons'
import type { Competition, OpponentStyle } from '../db/types'
import { todayLocal } from '../lib/dates'
import { OPPONENT_STYLES } from '../lib/matchStats'
import { COMPETITIONS, deleteMatch, inputFromMatch, restoreMatch, saveMatch, validateMatch, type MatchInput } from '../lib/matchService'
import { requestPersistentStorage } from '../lib/storage'
import { ValidationError } from '../lib/validation'
import { useNav, useUnsavedGuard } from '../nav'
import { useUndo } from '../undo'

const STYLE_LABEL: Record<OpponentStyle, string> = { hitter: 'Hitter', chopper: 'Chopper', blocker: 'Blocker', looper: 'Looper', other: 'Other' }
const COMP_LABEL: Record<Competition, string> = { league: 'League', club: 'Club', friendly: 'Friendly' }

interface Form {
  date: string
  competition: Competition
  opponent: string
  opponentStyle: OpponentStyle
  result: 'W' | 'L' | null
  gamesScore: string
  serveFaced: string
  attempted: string
  landed: string
  confidence: number | null
  cueUsed: string
  breakdownNote: string
  notes: string
}

export function formToInput(f: Form): MatchInput {
  return {
    date: f.date, competition: f.competition, opponent: f.opponent, opponentStyle: f.opponentStyle, result: f.result, gamesScore: f.gamesScore,
    serveFaced: f.serveFaced, loopsAttempted: parseNumber(f.attempted), loopsLanded: parseNumber(f.landed), confidence: f.confidence,
    cueUsed: f.cueUsed, breakdownNote: f.breakdownNote, notes: f.notes,
  }
}

export function MatchFormScreen({ matchId }: { matchId?: string }) {
  const { db } = useApp()
  const [initial, setInitial] = useState<Form | null>(matchId ? null : blank())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!matchId) return
    db.matchLogs.get(matchId).then(
      (m) => {
        if (!m) { setError('This match no longer exists.'); return }
        const i = inputFromMatch(m)
        setInitial({ ...i, opponent: i.opponent ?? '', attempted: i.loopsAttempted?.toString() ?? '', landed: i.loopsLanded?.toString() ?? '' })
      },
      (e) => setError(String(e)),
    )
  }, [db, matchId])

  return (
    <EditorShell title={matchId ? 'Edit match' : 'Log a match'}>
      {error && <ErrorBox message={error} />}
      {!initial && !error && <Loading />}
      {initial && <MatchFormBody initial={initial} matchId={matchId} />}
    </EditorShell>
  )
}

function blank(): Form {
  return {
    date: todayLocal(), competition: 'league', opponent: '', opponentStyle: 'hitter', result: null, gamesScore: '', serveFaced: '',
    attempted: '', landed: '', confidence: null, cueUsed: '', breakdownNote: '', notes: '',
  }
}

function MatchFormBody({ initial, matchId }: { initial: Form; matchId?: string }) {
  const { db, notifyDataChanged } = useApp()
  const { closeOverlay } = useNav()
  const { showUndo } = useUndo()
  const [f, setF] = useState<Form>(initial)
  const [initialJson] = useState(() => JSON.stringify(initial))
  useUnsavedGuard(JSON.stringify(f) !== initialJson)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const today = todayLocal()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const attempted = parseNumber(f.attempted)
  const landed = parseNumber(f.landed)

  async function save() {
    setErrors([])
    const problems = validateMatch(formToInput(f), today)
    if (problems.length) { setErrors(problems); return }
    setSaving(true)
    try {
      const isFirst = (await db.matchLogs.count()) === 0 && (await db.sessionLogs.count()) === 0
      await saveMatch(db, formToInput(f), today, matchId)
      if (isFirst) void requestPersistentStorage().catch(() => {})
      notifyDataChanged()
      closeOverlay()
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.errors : [e instanceof Error ? e.message : String(e)])
      setSaving(false)
    }
  }

  async function remove() {
    if (!matchId) return
    setConfirmDelete(false)
    try {
      const snapshot = await deleteMatch(db, matchId)
      notifyDataChanged()
      closeOverlay()
      if (snapshot) showUndo({ message: 'Match deleted.', onUndo: async () => { await restoreMatch(db, snapshot); notifyDataChanged() } })
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)])
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
      <label className="field"><span>Date</span><input type="date" value={f.date} max={today} onChange={(e) => set('date', e.target.value)} /></label>

      <div className="field" role="group" aria-label="Competition">
        <span>Competition</span>
        <div className="row three">
          {COMPETITIONS.map((c) => <button key={c} type="button" className="btn" aria-pressed={f.competition === c} onClick={() => set('competition', c)}>{COMP_LABEL[c]}</button>)}
        </div>
      </div>

      <label className="field"><span>Opponent (kept on this phone only)</span><input type="text" value={f.opponent} onChange={(e) => set('opponent', e.target.value)} autoComplete="off" /></label>
      <label className="field">
        <span>Opponent style</span>
        <select value={f.opponentStyle} onChange={(e) => set('opponentStyle', e.target.value as OpponentStyle)}>
          {OPPONENT_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABEL[s]}</option>)}
        </select>
      </label>

      <div className="field" role="group" aria-label="Result">
        <span>Result</span>
        <div className="row two">
          <button type="button" className="btn btn-big" aria-pressed={f.result === 'W'} onClick={() => set('result', 'W')}>Win</button>
          <button type="button" className="btn btn-big" aria-pressed={f.result === 'L'} onClick={() => set('result', 'L')}>Loss</button>
        </div>
      </div>

      <label className="field"><span>Games score (for example 3-1)</span><input type="text" value={f.gamesScore} onChange={(e) => set('gamesScore', e.target.value)} autoComplete="off" /></label>
      <label className="field"><span>Serve faced</span><input type="text" value={f.serveFaced} onChange={(e) => set('serveFaced', e.target.value)} autoComplete="off" /></label>

      <div className="row two">
        <label className="field"><span>Loops attempted</span><input type="number" inputMode="numeric" min={0} step={1} value={f.attempted} onChange={(e) => set('attempted', e.target.value)} /></label>
        <label className="field"><span>Loops landed</span><input type="number" inputMode="numeric" min={0} step={1} value={f.landed} onChange={(e) => set('landed', e.target.value)} /></label>
      </div>
      {attempted !== undefined && landed !== undefined && attempted > 0 && landed <= attempted && (
        <p className="muted" aria-live="polite">Loops landed: {((landed / attempted) * 100).toFixed(1)}%</p>
      )}

      <ScaleButtons label="Confidence" value={f.confidence} onChange={(n) => set('confidence', n)} />

      <label className="field"><span>Cue used</span><input type="text" value={f.cueUsed} onChange={(e) => set('cueUsed', e.target.value)} autoComplete="off" /></label>
      <label className="field">
        <span>Where did the push-to-attack decision break down? Against what serve, spin and score?</span>
        <textarea rows={3} value={f.breakdownNote} onChange={(e) => set('breakdownNote', e.target.value)} />
      </label>
      <label className="field"><span>Notes</span><textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>

      <FormErrors errors={errors} />
      <div className="row">
        <button type="submit" className="btn btn-big btn-primary" disabled={saving}>{saving ? 'Saving' : matchId ? 'Save changes' : 'Save match'}</button>
        {matchId && <button type="button" className="btn btn-big btn-danger" onClick={() => setConfirmDelete(true)}>Delete match</button>}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this match?" message="The match will be deleted. You will have 8 seconds to undo." confirmLabel="Delete" danger
          onCancel={() => setConfirmDelete(false)} onConfirm={remove}
        />
      )}
    </form>
  )
}
