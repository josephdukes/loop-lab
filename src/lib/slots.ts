// Resolving a program slot or session template into drills with their effective benchmark and minutes.
import type { Benchmark, Drill, Program, ProgramSessionSlot, SessionKind, SessionTemplate } from '../db/types'

export interface ResolvedItem {
  drill: Drill
  durationMin?: number
  note?: string
  /** Effective benchmark: slot override, else template item override, else the drill's own. */
  benchmark?: Benchmark
  /** True when the benchmark came from an override rather than the drill. */
  overridden: boolean
}

export interface ResolvedSlot {
  label: string
  templateId: string
  templateName: string
  kind: SessionKind
  items: ResolvedItem[]
  totalMinutes: number
}

export function resolveItems(template: SessionTemplate, drills: Map<string, Drill>, slot?: ProgramSessionSlot): ResolvedItem[] {
  const out: ResolvedItem[] = []
  for (const item of [...template.items].sort((a, b) => a.order - b.order)) {
    const drill = drills.get(item.drillId)
    if (!drill) continue
    const o = slot?.itemOverrides?.[item.drillId]
    const benchmark = o?.benchmarkOverride ?? item.benchmarkOverride ?? drill.benchmark
    out.push({
      drill,
      durationMin: o?.durationMin ?? item.durationMin ?? drill.defaultDurationMin,
      note: [item.note, o?.note].filter(Boolean).join(' ') || undefined,
      benchmark,
      overridden: !!(o?.benchmarkOverride ?? item.benchmarkOverride),
    })
  }
  return out
}

export function resolveSlot(slot: ProgramSessionSlot, templates: Map<string, SessionTemplate>, drills: Map<string, Drill>): ResolvedSlot | null {
  const template = templates.get(slot.templateId)
  if (!template) return null
  const items = resolveItems(template, drills, slot)
  return {
    label: slot.label,
    templateId: template.id,
    templateName: template.name,
    kind: template.kind,
    items,
    totalMinutes: items.reduce((s, i) => s + (i.durationMin ?? 0), 0),
  }
}

export function programShape(p: Program) {
  return { sessionsPerWeek: p.sessionsPerWeek, weekCount: p.weeks.length, repeating: p.repeating, cycleLengthWeeks: p.cycleLengthWeeks }
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]))
}
