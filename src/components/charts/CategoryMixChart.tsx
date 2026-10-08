// Time by category as horizontal bars. Each row names the category and states minutes and share as text.
import { useId } from 'react'
import type { CategoryTime } from '../../lib/progressData'

const W = 360
const ROW = 46

export function CategoryMixChart({ title, summary, items }: { title: string; summary: string; items: CategoryTime[] }) {
  const uid = useId().replace(/:/g, '')
  const max = Math.max(...items.map((i) => i.minutes), 1)
  const barMax = W - 130
  return (
    <figure className="chart">
      <figcaption id={`${uid}-t`} className="chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${items.length * ROW + 4}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="chart-svg">
        {items.map((it, i) => {
          const w = Math.max(4, (it.minutes / max) * barMax)
          const top = i * ROW
          return (
            <g key={it.category}>
              <text x="0" y={top + 16} className="chart-text chart-strong">{it.category}</text>
              <path d={`M0,${top + 24} L${w - 4},${top + 24} Q${w},${top + 24} ${w},${top + 28} L${w},${top + 32} Q${w},${top + 36} ${w - 4},${top + 36} L0,${top + 36} Z`} fill="var(--accent)" />
              <text x={w + 8} y={top + 35} className="chart-text chart-value">{it.minutes} min ({Math.round(it.share * 100)}%)</text>
            </g>
          )
        })}
      </svg>
      <p id={`${uid}-d`} className="chart-summary">{summary}</p>
    </figure>
  )
}
