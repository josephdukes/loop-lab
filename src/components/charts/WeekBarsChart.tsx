// Weekly columns with an optional target line. Rest weeks are hatched (a pattern, not colour alone).
// Tapping a column selects that week (used for the rest-week menu). Inline SVG, scales to phone width.
import { useId } from 'react'
import { dayMonth } from '../../lib/format'
import { yDomain } from '../../lib/progressData'
import { columnPath, labelEvery, linear } from './chartKit'

export interface BarDatum {
  weekStart: string
  value: number
  isRest: boolean
}

const W = 360
const H = 200
const M = { top: 14, right: 54, bottom: 30, left: 32 }

export function WeekBarsChart({ title, summary, bars, target, selected, onSelect, unit }: {
  title: string
  summary: string
  bars: BarDatum[]
  target?: number
  selected?: string
  onSelect?: (weekStart: string) => void
  /** Used in accessible names, e.g. "sessions" or "minutes". */
  unit: string
}) {
  const uid = useId().replace(/:/g, '')
  const n = bars.length
  const dom = yDomain('count', bars.map((b) => b.value), target)
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  const y = linear(dom.min, dom.max, M.top + plotH, M.top)
  const slot = plotW / n
  const bw = Math.min(24, Math.max(3, slot - 4))
  const every = labelEvery(n)
  const showValues = n <= 13

  return (
    <figure className="chart">
      <figcaption id={`${uid}-t`} className="chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="chart-svg">
        <defs>
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-muted)" strokeWidth="2" />
          </pattern>
        </defs>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="chart-text">{t}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x0 = M.left + i * slot
          const bx = x0 + (slot - bw) / 2
          const h = y(dom.min) - y(b.value)
          const sel = selected === b.weekStart
          const label = `Week of ${dayMonth(b.weekStart)}: ${b.value} ${unit}${b.isRest ? ', rest week' : ''}${sel ? ', selected' : ''}`
          return (
            <g key={b.weekStart}>
              {b.isRest && <rect x={bx} y={M.top} width={bw} height={plotH} fill={`url(#${uid}-hatch)`} opacity="0.55" />}
              {b.value > 0 && <path d={columnPath(bx, y(dom.min), bw, h)} fill="var(--accent)" />}
              {showValues && b.value > 0 && <text x={bx + bw / 2} y={y(b.value) - 4} textAnchor="middle" className="chart-text chart-value">{b.value}</text>}
              {sel && <rect x={x0 + 0.5} y={M.top - 4} width={slot - 1} height={plotH + 8} rx="4" fill="none" stroke="var(--text)" strokeWidth="1.5" />}
              {i % every === 0 && <text x={x0 + slot / 2} y={H - 10} textAnchor="middle" className="chart-text">{dayMonth(b.weekStart)}</text>}
              {onSelect && (
                <rect
                  x={x0} y={M.top - 4} width={slot} height={plotH + 8} fill="transparent" role="button" tabIndex={0} aria-label={label} aria-pressed={sel}
                  className="chart-hit"
                  onClick={() => onSelect(b.weekStart)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.weekStart) } }}
                />
              )}
            </g>
          )
        })}
        {target !== undefined && (
          <g>
            <line x1={M.left} x2={W - M.right + 4} y1={y(target)} y2={y(target)} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={W - M.right + 8} y={y(target) + 4} className="chart-text chart-strong">Target {target}</text>
          </g>
        )}
        <line x1={M.left} x2={W - M.right} y1={y(dom.min)} y2={y(dom.min)} stroke="var(--text-muted)" strokeWidth="1" />
      </svg>
      <p id={`${uid}-d`} className="chart-summary">{summary}</p>
    </figure>
  )
}
