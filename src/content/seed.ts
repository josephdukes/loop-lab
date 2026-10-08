// Seeding of built-in content (spec 3.9).
//  - First run: everything is added.
//  - Later runs: new built-ins are added; unmodified built-ins are updated to the current content;
//    items with modifiedByUser = true are NEVER touched; archived built-ins stay archived.
// Safe to run on every app start: when nothing changed, nothing is written.

import type { LoopLabDb } from '../db/db'
import type { Drill, Program, ProgramSessionSlot, SessionTemplate, SessionTemplateItem } from '../db/types'
import { newId, nowIso } from '../lib/id'
import { loadSettings, updateSettings } from '../db/settings'
import {
  BUILTIN_DRILLS,
  BUILTIN_PROGRAMS,
  BUILTIN_TEMPLATES,
  CONTENT_VERSION,
  type BuiltinDrill,
  type BuiltinProgram,
  type BuiltinTemplate,
} from './builtinContent'

export interface SeedCounts {
  added: number
  updated: number
  unchanged: number
  skippedModified: number
}

export interface SeedResult {
  drills: SeedCounts
  templates: SeedCounts
  programs: SeedCounts
  contentVersion: number
}

const emptyCounts = (): SeedCounts => ({ added: 0, updated: 0, unchanged: 0, skippedModified: 0 })

/** Stable comparison of content fields (key order does not matter). */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

// --- content (without ids / flags) as stored ---------------------------------------------------

function drillContent(d: BuiltinDrill): Omit<Drill, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn' | 'modifiedByUser' | 'archived'> {
  return {
    builtInKey: d.builtInKey,
    name: d.name,
    category: d.category,
    description: d.description,
    metricType: d.metricType,
    defaultAttempts: d.defaultAttempts,
    defaultDurationMin: d.defaultDurationMin,
    suggestedSettings: d.suggestedSettings,
    cues: d.cues,
    benchmark: d.benchmark,
    source: d.source,
  }
}

function templateContent(t: BuiltinTemplate, drillIdByKey: Map<string, string>) {
  const items: SessionTemplateItem[] = t.items.map((it, i) => ({
    drillId: mustGet(drillIdByKey, it.drillKey, `drill for template ${t.builtInKey}`),
    order: i + 1,
    durationMin: it.durationMin,
    ...(it.note ? { note: it.note } : {}),
  }))
  return { builtInKey: t.builtInKey, name: t.name, kind: t.kind, items }
}

function programContent(p: BuiltinProgram, drillIdByKey: Map<string, string>, templateIdByKey: Map<string, string>) {
  return {
    builtInKey: p.builtInKey,
    name: p.name,
    category: p.category,
    description: p.description,
    repeating: p.repeating,
    cycleLengthWeeks: p.cycleLengthWeeks,
    sessionsPerWeek: p.sessionsPerWeek,
    notes: p.notes,
    weeks: p.weeks.map((w) => ({
      weekNumber: w.weekNumber,
      title: w.title,
      ...(w.goal ? { goal: w.goal } : {}),
      sessions: w.sessions.map((s): ProgramSessionSlot => {
        const slot: ProgramSessionSlot = {
          label: s.label,
          templateId: mustGet(templateIdByKey, s.templateKey, `template for program ${p.builtInKey}`),
        }
        if (s.benchmarkOverrides) {
          slot.itemOverrides = {}
          for (const [drillKey, o] of Object.entries(s.benchmarkOverrides)) {
            slot.itemOverrides[mustGet(drillIdByKey, drillKey, `drill for program ${p.builtInKey}`)] = {
              benchmarkOverride: o.benchmark,
              ...(o.note ? { note: o.note } : {}),
            }
          }
        }
        return slot
      }),
    })),
  }
}

function mustGet(map: Map<string, string>, key: string, what: string): string {
  const v = map.get(key)
  if (!v) throw new Error(`Built-in content error: missing ${what} "${key}"`)
  return v
}

// --- generic reconcile -------------------------------------------------------------------------

interface BuiltInRecord {
  id: string
  builtInKey?: string
  modifiedByUser: boolean
  createdAt: string
  updatedAt: string
  archived: boolean
}

async function reconcile<T extends BuiltInRecord, C extends { builtInKey?: string }>(
  table: { toArray(): Promise<T[]>; bulkPut(items: T[]): Promise<unknown> },
  wanted: C[],
  idByKey: Map<string, string>,
): Promise<SeedCounts> {
  const counts = emptyCounts()
  const existing = new Map((await table.toArray()).filter((r) => r.builtInKey).map((r) => [r.builtInKey as string, r]))
  const toWrite: T[] = []
  const now = nowIso()

  for (const content of wanted) {
    const current = existing.get(content.builtInKey as string)
    if (!current) {
      const id = idByKey.get(content.builtInKey as string) ?? newId()
      idByKey.set(content.builtInKey as string, id)
      toWrite.push({ ...content, id, isBuiltIn: true, modifiedByUser: false, archived: false, createdAt: now, updatedAt: now } as unknown as T)
      counts.added++
      continue
    }
    idByKey.set(content.builtInKey as string, current.id)
    if (current.modifiedByUser) {
      counts.skippedModified++
      continue
    }
    const { id: _id, createdAt: _c, updatedAt: _u, isBuiltIn: _b, modifiedByUser: _m, archived: _a, ...currentContent } = current as unknown as Record<string, unknown>
    void _id; void _c; void _u; void _b; void _m; void _a
    if (stableJson(currentContent) === stableJson(content)) {
      counts.unchanged++
      continue
    }
    // Update content; keep id, createdAt and the archived flag (archived built-ins stay archived).
    toWrite.push({ ...current, ...content, updatedAt: now } as unknown as T)
    counts.updated++
  }
  if (toWrite.length) await table.bulkPut(toWrite)
  return counts
}

/** Seeds in dependency order (drills, then templates, then programs) so references can use real ids. */
export async function seedBuiltInContent(db: LoopLabDb): Promise<SeedResult> {
  return db.transaction('rw', [db.drills, db.sessionTemplates, db.programs, db.settings], async () => {
    const drillIdByKey = new Map<string, string>()
    const templateIdByKey = new Map<string, string>()

    const drills = await reconcile<Drill, ReturnType<typeof drillContent>>(
      db.drills as never,
      BUILTIN_DRILLS.map(drillContent),
      drillIdByKey,
    )

    const templates = await reconcile<SessionTemplate, ReturnType<typeof templateContent>>(
      db.sessionTemplates as never,
      BUILTIN_TEMPLATES.map((t) => templateContent(t, drillIdByKey)),
      templateIdByKey,
    )

    const programs = await reconcile<Program, ReturnType<typeof programContent>>(
      db.programs as never,
      BUILTIN_PROGRAMS.map((p) => programContent(p, drillIdByKey, templateIdByKey)),
      new Map(),
    )

    const settings = await loadSettings(db)
    if (settings.contentVersion !== CONTENT_VERSION) await updateSettings(db, { contentVersion: CONTENT_VERSION })

    return { drills, templates, programs, contentVersion: CONTENT_VERSION }
  })
}
