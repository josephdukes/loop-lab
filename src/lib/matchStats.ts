// Match statistics (spec 5, Matches): loops landed %, confidence trend, results by opponent style.
import type { MatchLog, OpponentStyle } from '../db/types'

export const OPPONENT_STYLES: OpponentStyle[] = ['hitter', 'chopper', 'blocker', 'looper', 'other']

/** Landed / attempted as a percentage; null when there were no attempts (never divides by zero). */
export function loopPercent(landed: number, attempted: number): number | null {
  return attempted > 0 ? (landed / attempted) * 100 : null
}

export function chronologicalMatches(matches: MatchLog[]): MatchLog[] {
  return matches.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export interface LoopTotals {
  attempted: number
  landed: number
  /** Matches that recorded loop numbers. */
  matchesWithLoops: number
  percent: number | null
}

/** Only matches that recorded both loopsAttempted and loopsLanded count. */
export function loopTotals(matches: MatchLog[]): LoopTotals {
  let attempted = 0
  let landed = 0
  let n = 0
  for (const m of matches) {
    if (m.loopsAttempted === undefined || m.loopsLanded === undefined) continue
    attempted += m.loopsAttempted
    landed += m.loopsLanded
    n++
  }
  return { attempted, landed, matchesWithLoops: n, percent: loopPercent(landed, attempted) }
}

export function averageConfidence(matches: MatchLog[]): number | null {
  return matches.length ? matches.reduce((s, m) => s + m.confidence, 0) / matches.length : null
}

export interface StyleResult {
  style: OpponentStyle
  wins: number
  losses: number
}

export interface MatchStats {
  count: number
  wins: number
  losses: number
  loops: LoopTotals
  averageConfidence: number | null
  /** Oldest first. */
  confidenceTrend: Array<{ date: string; confidence: number }>
  /** Every style, including those with no matches yet (0 and 0). */
  byStyle: StyleResult[]
}

export function matchStats(matches: MatchLog[]): MatchStats {
  const ordered = chronologicalMatches(matches)
  const byStyle = OPPONENT_STYLES.map((style) => ({ style, wins: 0, losses: 0 }))
  let wins = 0
  for (const m of ordered) {
    const row = byStyle.find((s) => s.style === m.opponentStyle)
    if (m.result === 'W') { wins++; if (row) row.wins++ } else if (row) row.losses++
  }
  return {
    count: ordered.length,
    wins,
    losses: ordered.length - wins,
    loops: loopTotals(ordered),
    averageConfidence: averageConfidence(ordered),
    confidenceTrend: ordered.map((m) => ({ date: m.date, confidence: m.confidence })),
    byStyle,
  }
}
