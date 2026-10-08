// Pure navigation model that mirrors the browser history (spec 12 stage 5: Back button).
//
// Every entry in the browser history has a matching NavState here, so pressing Back simply moves
// `index` and shows the earlier state. Rules:
//  - Home is always entry 0 (the app's first screen). Back from Home leaves the app normally.
//  - A non-Home tab sits directly above Home (entry 1), so Back from Train, Progress, Matches or Data goes to Home.
//  - Screens opened on top (runner, Quick log, editors, forms, detail screens, Settings) push one entry each.
// Functions return the new model plus the browser commands that bring the real history in line.
// No DOM here, so all of it is unit tested.

export type TabId = 'home' | 'train' | 'progress' | 'matches' | 'data'
export type TrainSub = 'programs' | 'sessions' | 'drills' | 'guides'

export type RunnerInit =
  | { mode: 'template'; templateId: string }
  | { mode: 'run'; runId: string }
  | { mode: 'resume' }

export type Overlay =
  | { kind: 'runner'; init: RunnerInit }
  | { kind: 'quicklog'; sessionId?: string; templateId?: string }
  | { kind: 'allSessions' }
  | { kind: 'sessionDetail'; sessionId: string }
  | { kind: 'drillEditor'; drillId?: string }
  | { kind: 'templateEditor'; templateId?: string }
  | { kind: 'programEditor'; programId?: string }
  | { kind: 'matchForm'; matchId?: string }
  | { kind: 'blockReview'; runId?: string }
  | { kind: 'settings' }

export interface NavState {
  tab: TabId
  trainSub: TrainSub
  programId?: string
  drillId?: string
  /** Screens stacked above the tab, oldest first. The last one is on screen. */
  overlays: Overlay[]
  /** Set when another screen sends Joe to a specific action on the Data tab (the Home backup banner). */
  dataFocus?: 'backup'
}

export interface HistoryModel {
  entries: NavState[]
  index: number
}

export type HistoryCommand =
  | { type: 'push'; index: number; state: NavState }
  | { type: 'replace'; index: number; state: NavState }
  | { type: 'go'; delta: number }

export interface Step {
  model: HistoryModel
  commands: HistoryCommand[]
}

export const HOME_STATE: NavState = { tab: 'home', trainSub: 'programs', overlays: [] }

export function createModel(): HistoryModel {
  return { entries: [HOME_STATE], index: 0 }
}

export function currentState(m: HistoryModel): NavState {
  return m.entries[m.index]
}

export function topOverlay(s: NavState): Overlay | undefined {
  return s.overlays[s.overlays.length - 1]
}

/** The same screen ignoring the data focus hint. */
export function sameView(a: NavState, b: NavState): boolean {
  return a.tab === b.tab && a.trainSub === b.trainSub && a.programId === b.programId && a.drillId === b.drillId && a.overlays.length === b.overlays.length
    && a.overlays.every((o, i) => JSON.stringify(o) === JSON.stringify(b.overlays[i]))
}

function noChange(m: HistoryModel): Step {
  return { model: m, commands: [] }
}

/** A new entry on top of the current one (opening a screen). Anything "forward" of the current entry is dropped. */
export function pushState(m: HistoryModel, state: NavState): Step {
  const index = m.index + 1
  return { model: { entries: [...m.entries.slice(0, index), state], index }, commands: [{ type: 'push', index, state }] }
}

/** Changes the current entry without adding one (switching sub-tab, tab to tab). */
export function replaceState(m: HistoryModel, state: NavState): Step {
  const entries = m.entries.slice(0, m.index + 1)
  entries[m.index] = state
  return { model: { entries, index: m.index }, commands: [{ type: 'replace', index: m.index, state }] }
}

/** Goes back `count` entries (clamped to Home). The matching Back press in the browser. */
export function goBack(m: HistoryModel, count = 1): Step {
  const n = Math.min(Math.max(0, count), m.index)
  if (n === 0) return noChange(m)
  return { model: { entries: m.entries, index: m.index - n }, commands: [{ type: 'go', delta: -n }] }
}

/** Closes every screen stacked above the tab: back to the nearest entry that has none. */
export function closeAllOverlays(m: HistoryModel): Step {
  if (currentState(m).overlays.length === 0) return noChange(m)
  let j = m.index - 1
  while (j > 0 && m.entries[j].overlays.length > 0) j--
  return goBack(m, m.index - j)
}

/**
 * Moves "up" within a tab (for example from a program back to the program list). If the entry below is already
 * that screen it is a plain Back; otherwise the current entry is replaced, so Back never loops.
 */
export function upTo(m: HistoryModel, target: NavState): Step {
  if (m.index > 0 && sameView(m.entries[m.index - 1], target)) return goBack(m, 1)
  return replaceState(m, target)
}

/**
 * Switches to a tab. Home: unwind to entry 0. Another tab: it becomes entry 1 above Home, whatever was open before
 * is unwound first. `target` must have no overlays.
 */
export function toTab(m: HistoryModel, target: NavState): Step {
  if (target.tab === 'home') {
    if (m.index === 0) return sameView(m.entries[0], target) ? noChange(m) : replaceState(m, target)
    return goBack(m, m.index)
  }
  if (m.index === 0) return pushState(m, target)
  if (m.index === 1) return replaceState(m, target)
  const unwound = goBack(m, m.index - 1)
  const replaced = replaceState(unwound.model, target)
  return { model: replaced.model, commands: [...unwound.commands, ...replaced.commands] }
}

/** The browser moved to entry `index` (Back or Forward pressed by the person). Unknown entries leave the model alone. */
export function arrivedAt(m: HistoryModel, index: number): HistoryModel | null {
  if (!Number.isInteger(index) || index < 0 || index >= m.entries.length) return null
  return { entries: m.entries, index }
}
