// Library actions for drills, session templates and programs (spec 3.9, 5 Builders):
// duplicate, save (edit), reset to original, archive and restore, delete rules.
import type { Table } from 'dexie'
import type { LoopLabDb } from '../db/db'
import type { Drill, Program, SessionTemplate } from '../db/types'
import { seedBuiltInContent } from '../content/seed'
import { newId, nowIso } from './id'
import { validateDrill, validateProgram, validateTemplate } from './libraryRules'
import { ValidationError } from './validation'

export type LibraryKind = 'drill' | 'template' | 'program'
export type LibraryItem = Drill | SessionTemplate | Program

function table(db: LoopLabDb, kind: LibraryKind): Table<LibraryItem, string> {
  return (kind === 'drill' ? db.drills : kind === 'template' ? db.sessionTemplates : db.programs) as unknown as Table<LibraryItem, string>
}

export const KIND_LABEL: Record<LibraryKind, string> = { drill: 'drill', template: 'session', program: 'program' }

/** Copy of an item: new id, "Copy of ..." name, custom, not modified, not archived, no builtInKey. */
export async function duplicateItem(db: LoopLabDb, kind: LibraryKind, id: string): Promise<string> {
  const src = await table(db, kind).get(id)
  if (!src) throw new Error('That item no longer exists.')
  const ts = nowIso()
  const { builtInKey: _key, ...rest } = src as LibraryItem & { builtInKey?: string }
  void _key
  const copy = {
    ...structuredClone(rest),
    id: newId(),
    name: `Copy of ${src.name}`,
    isBuiltIn: false,
    modifiedByUser: false,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
    ...(kind === 'drill' ? { source: 'custom' as const } : {}),
  } as LibraryItem
  await table(db, kind).add(copy)
  return copy.id
}

async function validate(db: LoopLabDb, kind: LibraryKind, item: LibraryItem): Promise<string[]> {
  if (kind === 'drill') return validateDrill(item as Drill)
  if (kind === 'template') return validateTemplate(item as SessionTemplate, new Set((await db.drills.toArray()).map((d) => d.id)))
  return validateProgram(item as Program, new Set((await db.sessionTemplates.toArray()).map((t) => t.id)))
}

/**
 * Saves a new or edited item after validating it. Editing a built-in sets modifiedByUser = true
 * so app updates never overwrite it.
 */
export async function saveItem(db: LoopLabDb, kind: LibraryKind, item: LibraryItem): Promise<LibraryItem> {
  const errors = await validate(db, kind, item)
  if (errors.length) throw new ValidationError(errors)
  const existing = await table(db, kind).get(item.id)
  const ts = nowIso()
  const saved = {
    ...item,
    name: item.name.trim(),
    modifiedByUser: item.isBuiltIn ? true : item.modifiedByUser,
    createdAt: existing?.createdAt ?? item.createdAt ?? ts,
    updatedAt: ts,
  } as LibraryItem
  await table(db, kind).put(saved)
  return saved
}

/** Restores a built-in's seeded values from builtinContent and clears modifiedByUser. Archive state is kept. */
export async function resetToOriginal(db: LoopLabDb, kind: LibraryKind, id: string): Promise<void> {
  await db.transaction('rw', [db.drills, db.sessionTemplates, db.programs, db.settings], async () => {
    const item = await table(db, kind).get(id)
    if (!item || !item.isBuiltIn || !item.builtInKey) throw new Error('Only built-in items can be reset to original.')
    await table(db, kind).put({ ...item, modifiedByUser: false, updatedAt: nowIso() })
    // Seeding rewrites every unmodified built-in to its seeded content, which now includes this item.
    await seedBuiltInContent(db)
  })
}

export async function setArchived(db: LoopLabDb, kind: LibraryKind, id: string, archived: boolean): Promise<void> {
  const item = await table(db, kind).get(id)
  if (!item) throw new Error('That item no longer exists.')
  await table(db, kind).put({ ...item, archived, updatedAt: nowIso() })
}

/** What still points at this item (logs, or other items that use it). */
export async function referenceCount(db: LoopLabDb, kind: LibraryKind, id: string): Promise<number> {
  if (kind === 'drill') {
    const logs = await db.drillLogs.where('drillId').equals(id).count()
    const templates = (await db.sessionTemplates.toArray()).filter((t) => t.items.some((i) => i.drillId === id)).length
    return logs + templates
  }
  if (kind === 'template') {
    const logs = await db.sessionLogs.filter((s) => s.templateId === id).count()
    const programs = (await db.programs.toArray()).filter((p) => p.weeks.some((w) => w.sessions.some((s) => s.templateId === id))).length
    return logs + programs
  }
  return db.programRuns.where('programId').equals(id).count()
}

export type DeleteOutcome = 'deleted' | 'archived'

/**
 * Custom items are deleted permanently only when nothing references them (no logs, no template or
 * program that uses them, no program run); otherwise they are archived. Built-ins are only archived.
 */
export async function deleteOrArchive(db: LoopLabDb, kind: LibraryKind, id: string): Promise<DeleteOutcome> {
  const item = await table(db, kind).get(id)
  if (!item) throw new Error('That item no longer exists.')
  if (item.isBuiltIn || (await referenceCount(db, kind, id)) > 0) {
    await setArchived(db, kind, id, true)
    return 'archived'
  }
  await table(db, kind).delete(id)
  return 'deleted'
}
