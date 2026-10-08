// Small helpers shared by the hand-built SVG charts. No chart library (spec 5).

export function linear(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): (v: number) => number {
  const span = domainMax - domainMin || 1
  return (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin)
}

/** A column that is square at the baseline and has a rounded (up to 4px) top. */
export function columnPath(x: number, baselineY: number, w: number, h: number, r = 4): string {
  if (h <= 0) return ''
  const rr = Math.min(r, h, w / 2)
  const top = baselineY - h
  return `M${x},${baselineY} L${x},${top + rr} Q${x},${top} ${x + rr},${top} L${x + w - rr},${top} Q${x + w},${top} ${x + w},${top + rr} L${x + w},${baselineY} Z`
}

/** Which of `n` evenly spaced labels to show so they never overlap on a ~360px chart. */
export function labelEvery(n: number): number {
  if (n <= 6) return 1
  if (n <= 13) return 2
  return Math.ceil(n / 6)
}
