// The activeSession store: one in-progress runner state, written on every change so a killed app can resume.
import type { LoopLabDb } from '../db/db'
import { isRunnerState, type RunnerState } from './runnerState'
import { nowIso } from './id'

export async function saveActiveState(db: LoopLabDb, state: RunnerState): Promise<void> {
  const existing = await db.activeSession.get('active')
  const now = nowIso()
  await db.activeSession.put({
    key: 'active',
    state: state as unknown as Record<string, unknown>,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

export type ActiveLoad =
  | { kind: 'none' }
  | { kind: 'ok'; state: RunnerState; savedAtMs: number }
  | { kind: 'corrupt' }

export async function loadActiveState(db: LoopLabDb): Promise<ActiveLoad> {
  const rec = await db.activeSession.get('active')
  if (!rec) return { kind: 'none' }
  if (!isRunnerState(rec.state)) return { kind: 'corrupt' }
  return { kind: 'ok', state: rec.state, savedAtMs: Date.parse(rec.updatedAt) || Date.now() }
}

export async function clearActiveState(db: LoopLabDb): Promise<void> {
  await db.activeSession.delete('active')
}

/**
 * Serialises writes (so the last change always wins) and lets the runner stop autosaving
 * before it clears the record on save or discard, so a late write cannot bring it back.
 */
export class Autosaver {
  private chain: Promise<void> = Promise.resolve()
  private closed = false
  lastError: string | null = null

  constructor(private db: LoopLabDb) {}

  save(state: RunnerState): Promise<void> {
    if (this.closed) return this.chain
    this.chain = this.chain
      .then(() => (this.closed ? undefined : saveActiveState(this.db, state)))
      .then(() => { this.lastError = null }, (e) => { this.lastError = e instanceof Error ? e.message : String(e) })
    return this.chain
  }

  /** Wait until every queued write has been stored. */
  flush(): Promise<void> {
    return this.chain
  }

  /** Stop autosaving: a write already running finishes, writes not yet started are dropped. */
  async close(): Promise<void> {
    this.closed = true
    await this.chain
  }
}
