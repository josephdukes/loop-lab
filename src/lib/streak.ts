// Spec 3.3 and 3.4: weekly-target streak. Rest weeks are skipped (neither break nor add).
import { addWeeks, weekStartOf } from './dates'

export interface StreakInput {
  /** Robot sessions per week, keyed by Monday. Missing weeks mean 0. */
  robotByWeek: Map<string, number>
  /** Mondays flagged as rest weeks. */
  restWeeks: Set<string>
  target: number
  /** Today's local date; its week is the "current week". */
  today: string
}

export interface StreakResult {
  current: number
  longest: number
}

/**
 * Walks every week from the first week that has a session up to the current week.
 * Completed weeks: met target = run + 1, missed = run resets to 0, rest = skipped.
 * The current week adds 1 only once it has met the target; not yet met does not break the run.
 */
export function computeStreaks(input: StreakInput): StreakResult {
  const { robotByWeek, restWeeks, target, today } = input
  const currentWeek = weekStartOf(today)
  const keys = [...robotByWeek.keys()].filter((k) => k <= currentWeek).sort()
  if (keys.length === 0) return { current: 0, longest: 0 }

  let run = 0
  let longest = 0
  for (let w = keys[0]; w < currentWeek; w = addWeeks(w, 1)) {
    if (restWeeks.has(w)) continue
    if ((robotByWeek.get(w) ?? 0) >= target) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  if (!restWeeks.has(currentWeek) && (robotByWeek.get(currentWeek) ?? 0) >= target) {
    run++
    if (run > longest) longest = run
  }
  return { current: run, longest }
}
