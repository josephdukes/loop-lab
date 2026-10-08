// Date helpers (spec 3.1). Dates are local calendar dates as "YYYY-MM-DD".
// All week maths is done on the calendar date itself (via UTC day numbers), never by adding
// 24h-multiples of milliseconds to a local timestamp, so clock changes cannot shift a date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** Format a calendar date from its parts. */
export function formatDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** Parse "YYYY-MM-DD"; returns null if the text is not a real calendar date. */
export function parseDate(text: string): { year: number; month: number; day: number } | null {
  const m = DATE_RE.exec(text)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1) return null
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > dim) return null
  return { year, month, day }
}

export function isValidDate(text: string): boolean {
  return parseDate(text) !== null
}

function mustParse(text: string) {
  const p = parseDate(text)
  if (!p) throw new Error(`Invalid date: ${text}`)
  return p
}

/** Whole days since 1970-01-01 for a calendar date (pure integer maths, no local time). */
export function toDayNumber(date: string): number {
  const { year, month, day } = mustParse(date)
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function fromDayNumber(dayNumber: number): string {
  const d = new Date(dayNumber * 86_400_000)
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days)
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** 0 = Monday ... 6 = Sunday. (1970-01-01 was a Thursday = 3.) */
export function weekdayIndex(date: string): number {
  return (((toDayNumber(date) + 3) % 7) + 7) % 7
}

/** The Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -weekdayIndex(date))
}

export function addWeeks(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7)
}

/** Monday-start week starts from oldest to newest, `count` weeks ending with the week containing `date`. */
export function lastNWeekStarts(date: string, count: number): string[] {
  const current = weekStartOf(date)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(addWeeks(current, -i))
  return out
}

/** Today's local calendar date from the phone's clock. */
export function todayLocal(now: Date = new Date()): string {
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Local calendar date of an ISO timestamp (in the phone's time zone). */
export function localDateOfIso(iso: string): string {
  return todayLocal(new Date(iso))
}
