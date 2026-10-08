// Saving, deleting (with undo) and validating match logs (spec 4, matchLogs).
import type { LoopLabDb } from '../db/db'
import type { Competition, MatchLog, OpponentStyle } from '../db/types'
import { isValidDate } from './dates'
import { newId, nowIso } from './id'
import { ValidationError } from './validation'

export const COMPETITIONS: Competition[] = ['league', 'club', 'friendly']

export interface MatchInput {
  date: string
  competition: Competition
  opponent?: string
  opponentStyle: OpponentStyle
  result: 'W' | 'L' | null
  gamesScore: string
  serveFaced: string
  loopsAttempted?: number
  loopsLanded?: number
  confidence: number | null
  cueUsed: string
  breakdownNote: string
  notes: string
}

const isCount = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 0)

export function validateMatch(m: MatchInput, today: string): string[] {
  const errors: string[] = []
  if (!isValidDate(m.date)) errors.push('Choose a real date.')
  else if (m.date > today) errors.push('The date cannot be in the future.')
  if (m.result !== 'W' && m.result !== 'L') errors.push('Choose win or loss.')
  if (m.confidence === null || !Number.isInteger(m.confidence) || m.confidence < 1 || m.confidence > 5) errors.push('Choose a confidence from 1 to 5.')
  if (!isCount(m.loopsAttempted)) errors.push('Loops attempted must be a whole number, 0 or more.')
  if (!isCount(m.loopsLanded)) errors.push('Loops landed must be a whole number, 0 or more.')
  if ((m.loopsAttempted === undefined) !== (m.loopsLanded === undefined)) errors.push('Enter both loops attempted and loops landed, or leave both empty.')
  if (m.loopsAttempted !== undefined && m.loopsLanded !== undefined && m.loopsLanded > m.loopsAttempted) errors.push('Loops landed cannot be more than loops attempted.')
  return errors
}

export async function saveMatch(db: LoopLabDb, input: MatchInput, today: string, existingId?: string): Promise<MatchLog> {
  const errors = validateMatch(input, today)
  if (errors.length) throw new ValidationError(errors)
  const ts = nowIso()
  const old = existingId ? await db.matchLogs.get(existingId) : undefined
  if (existingId && !old) throw new Error('This match no longer exists.')
  const match: MatchLog = {
    id: old?.id ?? newId(),
    date: input.date,
    competition: input.competition,
    ...(input.opponent?.trim() ? { opponent: input.opponent.trim() } : {}),
    opponentStyle: input.opponentStyle,
    result: input.result as 'W' | 'L',
    gamesScore: input.gamesScore.trim(),
    serveFaced: input.serveFaced.trim(),
    ...(input.loopsAttempted !== undefined ? { loopsAttempted: input.loopsAttempted } : {}),
    ...(input.loopsLanded !== undefined ? { loopsLanded: input.loopsLanded } : {}),
    confidence: input.confidence as number,
    cueUsed: input.cueUsed.trim(),
    breakdownNote: input.breakdownNote.trim(),
    notes: input.notes.trim(),
    createdAt: old?.createdAt ?? ts,
    updatedAt: ts,
  }
  await db.matchLogs.put(match)
  return match
}

/** Deletes a match and returns it so the caller can offer an 8-second Undo. */
export async function deleteMatch(db: LoopLabDb, id: string): Promise<MatchLog | null> {
  const m = await db.matchLogs.get(id)
  if (!m) return null
  await db.matchLogs.delete(id)
  return m
}

export async function restoreMatch(db: LoopLabDb, m: MatchLog): Promise<void> {
  await db.matchLogs.put(m)
}

export function inputFromMatch(m: MatchLog): MatchInput {
  return {
    date: m.date, competition: m.competition, opponent: m.opponent, opponentStyle: m.opponentStyle, result: m.result,
    gamesScore: m.gamesScore, serveFaced: m.serveFaced, loopsAttempted: m.loopsAttempted, loopsLanded: m.loopsLanded,
    confidence: m.confidence, cueUsed: m.cueUsed, breakdownNote: m.breakdownNote, notes: m.notes,
  }
}
