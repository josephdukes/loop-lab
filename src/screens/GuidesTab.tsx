import { GUIDES } from '../content/guides'

export function GuidesTab() {
  return (
    <div>
      {GUIDES.map((g) => (
        <article key={g.id} className="card guide" aria-labelledby={`guide-${g.id}`}>
          <h2 id={`guide-${g.id}`}>{g.title}</h2>
          {g.intro && <p className="muted">{g.intro}</p>}
          <ul className="guide-points">
            {g.points.map((p, i) => (
              <li key={i}>{p.heading && <strong>{p.heading}. </strong>}{p.text}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
