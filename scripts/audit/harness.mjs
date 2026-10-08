// Shared helpers for the browser audits (tap targets, accessibility, layout, offline, back button).
// Dev-only: nothing here is shipped in the app. Needs `npm run build` first (the audits test dist/ through `vite preview`).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT_DIR = process.env.AUDIT_OUT || join(ROOT, 'audit-output')
mkdirSync(OUT_DIR, { recursive: true })

export const VIEWPORTS = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
  narrow: { width: 320, height: 640 },
}

/** Starts `vite preview` on a free port and resolves with { url, stop }. */
export async function startPreview({ port = 4173 + Math.floor(Math.random() * 500), dir } = {}) {
  if (!existsSync(join(dir || join(ROOT, 'dist'), 'index.html'))) throw new Error('dist/ not found: run `npm run build` first')
  const args = [join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1']
  if (dir) args.push('--outDir', dir)
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  const url = `http://127.0.0.1:${port}/`
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url); if (r.ok) return { url, stop: () => child.kill() } } catch { /* not up yet */ }
    if (child.exitCode !== null) throw new Error('vite preview exited: ' + log)
    await new Promise((r) => setTimeout(r, 100))
  }
  child.kill()
  throw new Error('vite preview did not start: ' + log)
}

export function launch() {
  return chromium.launch({ args: ['--no-sandbox'] })
}

/**
 * A fresh browser context (own IndexedDB) like a phone. Requests to any host other than the preview server are recorded
 * and aborted: the app must never need them.
 */
export async function newContext(browser, { url, viewport, reducedMotion = 'no-preference', serviceWorkers = 'block', axe = false }) {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion, serviceWorkers, acceptDownloads: true,
  })
  context.external = []
  const origin = new URL(url).origin
  await context.route('**/*', (route) => {
    const u = route.request().url()
    // A route can already be handled when a state's own page.route() takes the same request: ignore that race.
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue().catch(() => {})
    context.external.push(u)
    return route.abort().catch(() => {})
  })
  if (axe) await context.addInitScript({ path: join(ROOT, 'node_modules/axe-core/axe.min.js') })
  return context
}

/** Opens the app and waits until Home has drawn. */
export async function openApp(page, url) {
  await page.goto(url)
  await page.getByRole('heading', { name: 'Home', level: 1 }).waitFor()
}

/** Seeded with a bit of everything, written straight into IndexedDB the way the app would (dev-only helper). */
export async function seed(page, { dataset, theme }) {
  await page.evaluate(async ({ dataset, theme }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('loop-lab'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const db = await open()
    const all = (store) => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const putAll = (store, rows) => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      for (const row of rows) tx.objectStore(store).put(row)
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })

    // Theme lives in the settings record.
    const [settings] = await all('settings')
    settings.theme = theme
    await putAll('settings', [settings])
    if (dataset === 'empty') { db.close(); return }

    const iso = (d) => d.toISOString()
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(18, 30, 0, 0); return d }
    const id = () => crypto.randomUUID()
    const stamp = { createdAt: iso(new Date()), updatedAt: iso(new Date()) }

    const drills = await all('drills')
    const templates = await all('sessionTemplates')
    const programs = await all('programs')
    const drillByKey = (k) => drills.find((d) => d.builtInKey === k)
    const tplByKey = (k) => templates.find((t) => t.builtInKey === k)
    const progByKey = (k) => programs.find((p) => p.builtInKey === k)

    const p3 = progByKey('P3')
    const run = { id: id(), programId: p3.id, startDate: ymd(daysAgo(26)), status: 'active', manualOffsetSessions: 0, cycleNumber: 1, ...stamp }
    const runs = [run]

    const sessions = []
    const logs = []
    const addSession = (daysBack, tplKey, kind, extra = {}) => {
      const tpl = tplByKey(tplKey)
      const d = daysAgo(daysBack)
      const s = { id: id(), date: ymd(d), startedAt: iso(d), endedAt: iso(new Date(d.getTime() + 40 * 60000)), totalMinutes: 40 + (daysBack % 7), kind, templateId: tpl.id, templateNameSnapshot: tpl.name, effort: 2 + (daysBack % 4), loopConfidence: 2 + (daysBack % 3), notes: daysBack % 3 === 0 ? 'Felt rushed on the third ball.' : '', ...extra, ...stamp }
      sessions.push(s)
      tpl.items.forEach((it, i) => {
        const dr = drills.find((x) => x.id === it.drillId)
        const l = { id: id(), sessionId: s.id, order: i + 1, drillId: dr.id, drillNameSnapshot: dr.name, categorySnapshot: dr.category, metricType: dr.metricType, durationMin: it.durationMin ?? dr.defaultDurationMin ?? 10, ...stamp }
        if (dr.metricType === 'hits_attempts') { l.attempts = 20; l.hits = 10 + ((daysBack + i) % 8); if (dr.benchmark) { l.targetSnapshot = { value: dr.benchmark.threshold, description: dr.benchmark.description, minAttempts: dr.benchmark.minAttempts }; l.benchmarkMet = l.hits / l.attempts >= dr.benchmark.threshold } }
        else if (dr.metricType === 'streak') l.streak = 5 + (daysBack % 9)
        else if (dr.metricType === 'score_vs_robot') { l.scoreYou = 11; l.scoreRobot = 4 + (daysBack % 7) }
        else if (dr.metricType === 'rating') l.rating = 2 + ((daysBack + i) % 4)
        logs.push(l)
      })
      return s
    }
    // Holistic run sessions (attached to the run), more robot sessions, club sessions, over ten weeks.
    const holistic = ['T-hol-A', 'T-hol-B', 'T-hol-C']
    for (let i = 0; i < 5; i++) addSession(24 - i * 3, holistic[i % 3], 'robot', { programRunId: run.id, programWeek: 1 + Math.floor(i / 3), programCycle: 1, sessionLabel: ['Session A', 'Session B', 'Session C'][i % 3] })
    for (let w = 0; w < 10; w++) {
      const n = w === 4 ? 0 : 1 + (w % 3)
      for (let k = 0; k < n; k++) addSession(w * 7 + 2 + k * 2 + 30, ['T-orig-p1', 'T-orig-p3', 'T-mt-1'][(w + k) % 3], 'robot')
      if (w % 3 === 0) addSession(w * 7 + 5 + 30, 'T-club', 'club')
    }

    const matchBase = { competition: 'league', opponentStyle: 'chopper', gamesScore: '3-1', serveFaced: 'short backspin', cueUsed: 'let the ball drop', breakdownNote: 'Pushed long at 9-9.', notes: '', ...stamp }
    const matches = [3, 10, 17, 24, 31, 45].map((n, i) => ({ id: id(), date: ymd(daysAgo(n)), result: i % 3 === 1 ? 'L' : 'W', opponent: 'A. Player', loopsAttempted: 12 + i * 2, loopsLanded: 7 + i * 2, confidence: 2 + (i % 4), ...matchBase, opponentStyle: ['chopper', 'hitter', 'looper', 'blocker', 'other', 'chopper'][i] }))

    const monday = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x) }
    const weekFlags = [{ weekStart: monday(daysAgo(37)), isRest: true, ...stamp }]
    const reviews = [{ id: id(), programRunId: run.id, cycleNumber: 1, date: ymd(daysAgo(2)), windowStart: ymd(daysAgo(30)), windowEnd: ymd(daysAgo(2)), emphasisNotes: 'More pressure on the third ball.', ...stamp }]

    const custom = { id: id(), name: 'My custom wrist drill', category: 'Footwork and Conditioning', description: 'A custom drill.', metricType: 'hits_attempts', defaultAttempts: 20, defaultDurationMin: 10, suggestedSettings: 'slow', cues: 'relax', benchmark: { metricType: 'hits_attempts', threshold: 0.7, minAttempts: 10, consecutiveSessions: 2, description: '70% twice' }, source: 'custom', isBuiltIn: false, modifiedByUser: false, archived: false, ...stamp }
    const archived = { ...custom, id: id(), name: 'Old archived drill', archived: true, benchmark: undefined }
    const edited = { ...drillByKey('orig-A'), modifiedByUser: true, description: 'My edited description of the pure repetition loop.' }

    await putAll('programRuns', runs); await putAll('sessionLogs', sessions); await putAll('drillLogs', logs)
    await putAll('matchLogs', matches); await putAll('weekFlags', weekFlags); await putAll('blockReviews', reviews)
    await putAll('drills', [custom, archived, edited])
    db.close()
  }, { dataset, theme })
}

/** The standard audit page: opens the app, seeds, reloads so the app starts from the seeded data. */
export async function preparedPage(browser, { url, viewport, theme = 'dark', dataset = 'rich', reducedMotion, axe, serviceWorkers, rootFontPx }) {
  const context = await newContext(browser, { url, viewport, reducedMotion, axe, serviceWorkers })
  // Large text: the root font size set the way a phone's font-size setting would (rem units follow it).
  if (rootFontPx) await context.addInitScript((px) => { const s = document.createElement('style'); s.textContent = `html { font-size: ${px}px !important }`; document.documentElement.appendChild(s) }, rootFontPx)
  const page = await context.newPage()
  page.problems = []
  page.setDefaultTimeout(6000)
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') page.problems.push('console: ' + m.text()) })
  await openApp(page, url)
  await seed(page, { dataset, theme })
  await page.reload()
  await page.getByRole('heading', { name: 'Home', level: 1 }).waitFor()
  return { context, page }
}

export function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
