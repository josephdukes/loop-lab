// Connects the pure navigation model (navModel.ts) to the browser History API.
//
// The model is updated at once (so the screen changes at once); the real history entries catch up in order.
// Anything Joe does with the Back button arrives as a "popstate" event we did not expect, and is handled here:
//  - if a screen asked to intercept Back (unsaved changes, an open dialog, a drill picker), the move is undone
//    and that screen's handler runs instead;
//  - otherwise the model simply moves to the earlier entry.
// No URL is ever changed, and nothing here runs before the app starts.
import {
  arrivedAt, closeAllOverlays, createModel, currentState, goBack, HOME_STATE, pushState, replaceState, toTab, upTo,
  type HistoryCommand, type HistoryModel, type NavState, type Step,
} from './navModel'

const MARK = 'loopLabNav'
const GO_TIMEOUT_MS = 400

export interface BackInterceptor { run: () => void }

interface Expected { index: number; done: () => void }

export class NavController {
  private model: HistoryModel = createModel()
  private readonly interceptors: BackInterceptor[] = []
  private expected: Expected[] = []
  private queue: Promise<void> = Promise.resolve()
  private listener: ((s: NavState) => void) | null = null
  private attached = false
  /** Which history entry the browser is really on (the model can be ahead while moves are queued). */
  private browserIndex = 0

  constructor(private readonly win: Window) {}

  get state(): NavState { return currentState(this.model) }
  get index(): number { return this.model.index }

  /** Starts listening. The entry the page loaded on becomes entry 0 (Home), even after a reload. */
  attach(onChange: (s: NavState) => void): () => void {
    this.model = createModel()
    this.expected = []
    this.browserIndex = 0
    this.listener = onChange
    this.attached = true
    try { this.win.history.replaceState({ [MARK]: 0 }, '') } catch { /* history can be unavailable in odd embeds: the app still works without Back support */ }
    const onPop = (e: PopStateEvent) => this.onPop(e)
    this.win.addEventListener('popstate', onPop)
    onChange(this.state)
    return () => {
      this.win.removeEventListener('popstate', onPop)
      this.attached = false
      this.listener = null
    }
  }

  // --- navigation actions: each returns after updating the model; the browser history follows ---------------

  push(state: NavState) { this.apply(pushState(this.model, state)) }
  replace(state: NavState) { this.apply(replaceState(this.model, state)) }
  back(count = 1) { this.apply(goBack(this.model, count)) }
  closeAll() { this.apply(closeAllOverlays(this.model)) }
  up(target: NavState) { this.apply(upTo(this.model, target)) }
  tab(target: NavState) { this.apply(toTab(this.model, target)) }

  // --- Back interception --------------------------------------------------------------------------------------

  /** While registered, a Back press (or a Close tap routed through requestClose) calls `run` instead of leaving. The newest wins. */
  intercept(handler: BackInterceptor): () => void {
    this.interceptors.push(handler)
    return () => {
      const i = this.interceptors.indexOf(handler)
      if (i >= 0) this.interceptors.splice(i, 1)
    }
  }

  /** Runs the newest interceptor and returns true, or returns false if nothing wants to intercept. */
  runInterceptor(): boolean {
    const top = this.interceptors[this.interceptors.length - 1]
    if (!top) return false
    top.run()
    return true
  }

  // --- internals ------------------------------------------------------------------------------------------------

  private apply(step: Step) {
    if (step.model === this.model && step.commands.length === 0) return
    this.model = step.model
    this.listener?.(this.state)
    this.run(step.commands)
  }

  private run(commands: HistoryCommand[]) {
    if (!this.attached || commands.length === 0) return
    this.queue = this.queue.then(async () => {
      for (const c of commands) {
        try {
          if (c.type === 'push') { this.win.history.pushState({ [MARK]: c.index }, ''); this.browserIndex = c.index }
          else if (c.type === 'replace') this.win.history.replaceState({ [MARK]: c.index }, '')
          else await this.go(c.delta)
        } catch { /* ignore: the model is still right, only the browser entry is off */ }
      }
    })
  }

  /** Moves the real history by `delta` and waits until the browser says it has arrived. */
  private go(delta: number): Promise<void> {
    return new Promise((resolve) => {
      const target = this.browserIndex + delta
      const entry: Expected = { index: target, done: () => {} }
      const finish = () => { clearTimeout(timer); this.browserIndex = target; resolve() }
      const timer = setTimeout(() => {
        this.expected = this.expected.filter((e) => e !== entry)
        finish()
      }, GO_TIMEOUT_MS)
      entry.done = finish
      this.expected.push(entry)
      this.win.history.go(delta)
    })
  }

  private onPop(e: PopStateEvent) {
    const raw = (e.state as Record<string, unknown> | null)?.[MARK]
    const index = typeof raw === 'number' ? raw : -1

    // A move we asked for: let the queue continue.
    const i = this.expected.findIndex((x) => x.index === index)
    if (i >= 0) {
      const [hit] = this.expected.splice(i, 1)
      hit.done()
      return
    }

    // An entry from before this page load (we cannot show it): make it a fresh Home and carry on.
    if (index < 0 || index >= this.model.entries.length) {
      this.model = createModel()
      this.browserIndex = 0
      try { this.win.history.replaceState({ [MARK]: 0 }, '') } catch { /* ignore */ }
      this.listener?.(HOME_STATE)
      return
    }

    // The person pressed Back (or Forward). If a screen wants to intercept, undo the move and let it act.
    const moved = index - this.model.index
    if (moved < 0 && this.interceptors.length > 0) {
      const back = this.model.index
      this.expected.push({ index: back, done: () => { this.browserIndex = back } })
      this.win.history.go(-moved)
      this.runInterceptor()
      return
    }
    const next = arrivedAt(this.model, index)
    if (next) {
      this.browserIndex = index
      this.model = next
      this.listener?.(this.state)
    }
  }
}
