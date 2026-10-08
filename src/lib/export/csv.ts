// CSV writing (spec 6): UTF-8 text, comma separated, CRLF line ends, RFC 4180 quoting,
// and a guard against spreadsheet formula injection for TEXT cells.

/** A number that must be written exactly as given (for example "80.0"), never guarded or reformatted. */
export interface RawNumber { raw: string }

export type CsvCell = string | number | boolean | null | undefined | RawNumber

/** Fixed decimal places as a raw number cell, e.g. fixed(80, 1) -> "80.0". */
export function fixed(n: number, places: number): RawNumber {
  return { raw: n.toFixed(places) }
}

const FORMULA_START = /^[=+@\t\r]/

/** Text cells starting with = + @ tab or carriage return get a single quote in front. */
export function guardText(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text
}

function isRawNumber(v: CsvCell): v is RawNumber {
  return typeof v === 'object' && v !== null
}

/** One cell, escaped. Booleans are TRUE or FALSE, null/undefined are blank, numbers are plain (never guarded). */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (isRawNumber(value)) return value.raw
  const text = guardText(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Header row plus data rows, every line ended with CRLF. */
export function buildCsv(headers: readonly string[], rows: CsvCell[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))]
  return lines.join('\r\n') + '\r\n'
}
