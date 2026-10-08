// Built-in drills, templates and programs get a random id on every phone. Restoring a backup from another phone into an
// app that has already been seeded would therefore create a second copy of every built-in. To avoid that, a built-in in the
// backup that matches a local built-in by builtInKey is given the LOCAL id, and every reference to it in the backup is rewritten.
import type { LoopLabDb } from '../../db/db'
import type { Program, SessionTemplate } from '../../db/types'
import type { StoreData } from './stores'

type KeyedTable = 'drills' | 'sessionTemplates' | 'programs'

async function idMap(db: LoopLabDb, table: KeyedTable, incoming: Array<{ id: string; builtInKey?: string }>): Promise<Map<string, string>> {
  const local = new Map<string, string>()
  for (const r of await db.table(table).toArray() as Array<{ id: string; builtInKey?: string }>) {
    if (r.builtInKey && !local.has(r.builtInKey)) local.set(r.builtInKey, r.id)
  }
  const map = new Map<string, string>()
  for (const r of incoming) {
    const localId = r.builtInKey ? local.get(r.builtInKey) : undefined
    if (localId && localId !== r.id) map.set(r.id, localId)
  }
  return map
}

/** Returns a copy of the stores with built-in ids matched to this phone's ids. Records that need no change are shared, not copied. */
export async function remapBuiltInIds(db: LoopLabDb, stores: StoreData): Promise<StoreData> {
  const drillMap = await idMap(db, 'drills', stores.drills)
  const templateMap = await idMap(db, 'sessionTemplates', stores.sessionTemplates)
  const programMap = await idMap(db, 'programs', stores.programs)
  if (drillMap.size + templateMap.size + programMap.size === 0) return stores

  const d = (id: string) => drillMap.get(id) ?? id
  const t = (id: string) => templateMap.get(id) ?? id
  const p = (id: string) => programMap.get(id) ?? id

  const remapTemplate = (tpl: SessionTemplate): SessionTemplate => ({
    ...tpl, id: t(tpl.id), items: tpl.items.map((it) => ({ ...it, drillId: d(it.drillId) })),
  })
  const remapProgram = (prog: Program): Program => ({
    ...prog,
    id: p(prog.id),
    weeks: prog.weeks.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) => ({
        ...s,
        templateId: t(s.templateId),
        ...(s.itemOverrides ? { itemOverrides: Object.fromEntries(Object.entries(s.itemOverrides).map(([drillId, o]) => [d(drillId), o])) } : {}),
      })),
    })),
  })

  return {
    ...stores,
    drills: stores.drills.map((x) => ({ ...x, id: d(x.id) })),
    sessionTemplates: stores.sessionTemplates.map(remapTemplate),
    programs: stores.programs.map(remapProgram),
    programRuns: stores.programRuns.map((r) => ({ ...r, programId: p(r.programId) })),
    sessionLogs: stores.sessionLogs.map((s) => (s.templateId ? { ...s, templateId: t(s.templateId) } : s)),
    drillLogs: stores.drillLogs.map((l) => ({ ...l, drillId: d(l.drillId) })),
  }
}
