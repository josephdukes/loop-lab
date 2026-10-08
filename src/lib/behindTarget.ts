// "Behind on target" in-app banner rule (spec 8). Informational only.
import { weekdayIndex } from './dates'

export interface BehindInput {
  /** Local calendar date, YYYY-MM-DD. */
  today: string
  isRestWeek: boolean
  robotThisWeek: number
  weeklyTarget: number
}

/** Thursday in a Monday-start week (Monday = 0). */
export const BEHIND_FROM_WEEKDAY = 3

/** Days left in the Monday-start week, counting today (Monday = 7 ... Sunday = 1). */
export function daysLeftInWeek(today: string): number {
  return 7 - weekdayIndex(today)
}

/**
 * Returns the banner text, or null when it should not show. Shown only when the week is not a rest week,
 * robot sessions this week are below the target, and it is Thursday or later.
 */
export function behindOnTargetText(i: BehindInput): string | null {
  if (i.isRestWeek) return null
  if (i.robotThisWeek >= i.weeklyTarget) return null
  if (weekdayIndex(i.today) < BEHIND_FROM_WEEKDAY) return null
  const left = daysLeftInWeek(i.today)
  return `${i.robotThisWeek} of ${i.weeklyTarget} robot sessions this week, ${left} ${left === 1 ? 'day' : 'days'} left (including today)`
}
