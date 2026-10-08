// A line chart over time with optional benchmark line. Marker shape carries meaning too:
// filled dot = met (or no benchmark), hollow dot = not met. Inline SVG, scales to phone width.
import { useId } from 'react'
import type { YDomain } from '../../lib/progressData'
import { linear } from './chartKit'

export interface TrendPoint {
  x: number
  label: string
  y: number
  /** False draws a hollow dot (benchmark not met). */
  met?: boolean | null
}

const W = 360
const H = 210
const M = { top: 22, right: 20, bottom: 32, left: 38 }

export function TrendChart({ title, summary, points, domain, line, formatY, formatEnd }: {
  title: string
  summary: string
  points: TrendPoint[]
  domain: YDomain
  line?: { value: number; label: string }
  formatY: (n: number) => string
  formatEnd?: (n: number) => string
}) {
  const uid = useId().replace(/:/g, '')
  const xs = points.map((p) => p.x)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const x = points.length > 1 ? linear(xMin, xMax, M.left + 8, W - M.right - 8) : () => (M.left + W - M.right) / 2
  const y = linear(domain.min, domain.max, H - M.bottom, M.top)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const labelIdx = new Set<number>([0, points.length - 1])
  if (points.length >= 3) {
    // The middle label is the point nearest the horizontal centre, shown only if it clears both end labels.
    const mid = (xMin + xMax) / 2
    const best = points.reduce((a, p, i) => (Math.abs(p.x - mid) < Math.abs(points[a].x - mid) ? i : a), 0)
    if (best !== 0 && best !== points.length - 1 && x(points[best].x) - x(xMin) > 80 && x(xMax) - x(points[best].x) > 80) labelIdx.add(best)
  }
  const r = points.length > 14 ? 4 : 5
  const hasHollow = points.some((p) => p.met === false)

  return (
    <figure className="chart">
      <figcaption id={`${uid}-t`} className="chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="chart-svg">
        {domain.ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="chart-text">{formatY(t)}</text>
          </g>
        ))}
        {line && (
          <g>
            <line x1={M.left} x2={W - M.right} y1={y(line.value)} y2={y(line.value)} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={M.left + 4} y={y(line.value) - 5} className="chart-text chart-strong">{line.label}</text>
          </g>
        )}
        {points.length > 1 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          p.met === false
            ? <circle key={i} cx={x(p.x)} cy={y(p.y)} r={r} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
            : <circle key={i} cx={x(p.x)} cy={y(p.y)} r={r} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        ))}
        {last && (
          <text x={Math.min(x(last.x), W - M.right - 2)} y={y(last.y) - 11} textAnchor="end" className="chart-text chart-value">{(formatEnd ?? formatY)(last.y)}</text>
        )}
        {points.map((p, i) => labelIdx.has(i) && (
          <text key={`l${i}`} x={x(p.x)} y={H - 10} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'} className="chart-text">{p.label}</text>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(domain.min)} y2={y(domain.min)} stroke="var(--text-muted)" strokeWidth="1" />
      </svg>
      {(line || hasHollow) && (
        <p className="chart-key">
          {line ? 'Dashed line: benchmark. ' : ''}{hasHollow ? 'Filled dot: benchmark met. Hollow dot: not met.' : ''}
        </p>
      )}
      <p id={`${uid}-d`} className="chart-summary">{summary}</p>
    </figure>
  )
}
