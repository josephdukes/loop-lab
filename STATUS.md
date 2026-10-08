# Loop Lab: build status

## What stage 1 includes (spec section 12, stage 1)

- React + TypeScript + Vite static PWA. Dexie (IndexedDB), vite-plugin-pwa (Workbox), Vitest + fake-indexeddb. No chart library, no date library, no web fonts, no analytics, no runtime network requests.
- IndexedDB schema: all 11 stores from spec section 4 (drills, sessionTemplates, programs, programRuns, sessionLogs, drillLogs, matchLogs, blockReviews, weekFlags, settings, activeSession), createdAt/updatedAt, `crypto.randomUUID()` ids, integer schema version, ordered migration framework (`src/db/migrations.ts`).
- Settings single record with spec defaults (weeklyTarget 3, theme dark, timerSound true, timerVibrate true, backupReminderDays 14, summaryWeeks 4, contentVersion).
- Date helpers (`src/lib/dates.ts`): local YYYY-MM-DD dates, Monday-start weeks, date-only arithmetic. Tested including the week of Sunday 25 October 2026.
- Built-in content in one typed module `src/content/builtinContent.ts` (7 categories, 25 drills, 24 session templates, 7 programs P1-P7 with benchmarks, P2 benchmark overrides, guidance notes, match-day protocol, Block Review prompts, `CONTENT_VERSION = 1`).
- Seeding (`src/content/seed.ts`): first run adds everything; later runs add new built-ins and update unmodified ones; items with `modifiedByUser = true` are never overwritten; archived built-ins stay archived; nothing is written if nothing changed.
- App shell: dark high-contrast theme (near-black, white, orange accent #FF7A1A), light theme (switch on the Data screen), system font stack, bottom navigation (Home, Train, Progress, Matches, Data), placeholder screens with empty states, Home week-progress card and built-in content counts, loading and error states for database start-up.
- PWA: manifest (name and short_name "Loop Lab", standalone, dark colours, relative `start_url` and `scope`), generated icons 192, 512 and maskable (original orange ball with a loop arc), service worker that precaches the app shell, "Update ready: reload" toast that never reloads by itself.
- Persistent storage: `requestPersistentStorage()` in `src/lib/storage.ts` (not called anywhere yet; stage 2 calls it after the first saved session). Data screen shows persistence status and approximate storage used (feature-detected, fails quietly).
- Repo hygiene: `.gitignore`, `README.md`, scripts below.

## How to run, test, build

- `npm install`
- `npm run dev` : development server
- `npm test` : unit tests (Vitest)
- `npm run typecheck`
- `npm run build` : regenerates icons, typechecks, builds into `dist/`
- `npm run preview` : serves `dist/` locally (default http://localhost:4173)

## The hosting address: LOOP_LAB_BASE

The only place the site address is set is the environment variable `LOOP_LAB_BASE`, read in `vite.config.ts` when building. It is not a secret.

- Default `/` (site at the root of its own domain, for example a custom subdomain).
- GitHub Pages project site: `LOOP_LAB_BASE=/loop-lab/ npm run build` (use the real repository name).
- A missing leading or trailing slash is added automatically.
- Manifest `start_url` and `scope` are `./`, so they follow whatever base is used. Verified by building with base `loop-lab`: script, CSS and manifest links became `/loop-lab/...`.
- Joe has not chosen the final address (spec section 10 open decision). It must be fixed before installing on the phone, because local data is tied to the address.

## File layout

- `index.html`: page shell with a restrictive Content Security Policy meta tag.
- `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`
- `scripts/generate-icons.mjs`: writes `public/icons/*` (SVG source plus 192, 512 and maskable PNG) using sharp (dev dependency). Runs in `npm run build`.
- `src/main.tsx`, `src/App.tsx`, `src/appState.tsx` (start-up: open database, seed, load settings, theme), `src/styles.css`
- `src/db/`: `types.ts` (all record types), `db.ts` (Dexie class), `migrations.ts` (framework plus v1), `settings.ts`
- `src/content/`: `builtinContent.ts`, `seed.ts`
- `src/lib/`: `dates.ts`, `id.ts`, `storage.ts`, `weekProgress.ts`
- `src/pwa/registerSW.ts`: service worker registration and update callback
- `src/components/`: `BottomNav`, `EmptyState`, `UpdateToast`
- `src/screens/`: `Home`, `Data`, `Placeholders` (Train, Progress, Matches)
- Tests sit next to the code as `*.test.ts(x)`.

## Assumptions and deviations (labelled)

- ASSUMPTION S1: drill `category` stores the full category name from A.1 (for example "Push-to-Attack Transition"), mapping the short names in the A.2 tables ("Loop", "Push-to-Attack", "Pressure", "Serve/Receive", "Counter and Block", "Footwork", "Maintenance") to the seven A.1 names.
- ASSUMPTION S2: the A.2 "Minutes" column is stored as `defaultDurationMin`. "(10)", "(20)", "(30)" in the metric column is `defaultAttempts`.
- ASSUMPTION S3: `source` for pl-* drills: pl-warmup, pl-streak, pl-play11 and pl-third are "pressure"; pl-serve, pl-multiball, pl-shadow and sp-tactical are "holistic". The spec says "holistic or pressure" without saying which.
- ASSUMPTION S4: where the spec gives no cues or settings for a drill, the field is an empty string (nothing invented).
- ASSUMPTION S5: the 7 categories are a constant (`CATEGORIES`), not a database store (spec section 4 has no categories store).
- ASSUMPTION S6: the P1 programme's phase benchmarks live on the drills (as in the spec); each week's `goal` text mentions them. P2's per-slot targets are stored as `itemOverrides` on the slot, keyed by drill id, with a `benchmarkOverride` (and optional note).
- ASSUMPTION S7: the P2 "end-of-week-2 check (auto-shown from the data)" is app behaviour, not a stored field. It is mentioned in the P2 description and must be built in a later stage.
- ASSUMPTION S8: guidance notes are one text field, paragraphs separated by a blank line, so a later stage can show each paragraph as a card. P3's notes also carry the match-day protocol, the sparring rules and the two Block Review prompts.
- ASSUMPTION S9: P5 (repeating, 1 week) uses `cycleLengthWeeks = 1`. Session slot labels for P1, P2, P4, P6, P7 are "Session 1/2/3"; P3 uses "Session A/B/C"; P5 uses "Technique/Decisions/Match Feel". The spec does not name them.
- ASSUMPTION S10: IndexedDB cannot index booleans, so `archived`, `isBuiltIn`, `modifiedByUser` are plain fields, not indexes. The single-record stores use a `key` field ("settings", "active"), and `weekFlags` uses `weekStart` as its primary key.
- ASSUMPTION S11: `activeSession.state` is an open object. Stage 2 defines the runner's state shape.
- ASSUMPTION S12: `WeekFlag` also carries createdAt/updatedAt (the spec says all records have them).
- Seeding runs on every app start (cheap, writes nothing when nothing changed) rather than only when `contentVersion` changes. `contentVersion` in settings is updated after seeding.
- The Home screen buttons (Start a program, Start a session, Quick log, Log a match) are NOT present in stage 1; Home shows an empty-state card instead, because those flows are stage 2.
- The theme switch is on the Data screen for now; the full Settings screen is a later stage.
- Package versions installed are the current registry versions (Vite 8, React 19, TypeScript 7, Vitest 5, vite-plugin-pwa 2, Dexie 4).

## Known limitations

- Placeholder Train, Progress and Matches screens; no runner, logging, charts, export, backup, restore or Block Review yet.
- No real-browser or phone testing was possible in this environment (no browser available). The jsdom test renders the app shell, but layout, tap sizes and contrast have not been looked at in a real browser.
- The service worker has not been exercised in a browser; only its generation and its being served were checked.
- The CSP meta tag allows inline styles (`style-src 'unsafe-inline'`) because React uses inline style attributes later; scripts are restricted to the site's own files.
- Icon is generated by script; looked at as a PNG only, not on a real home screen.

## Verification results (stage 1)

- `npm run typecheck`: clean.
- `npm test`: 7 test files, 30 tests, all passing.
- `npm run build`: succeeds; 14 precache entries; manifest, `sw.js`, icons and index served correctly by `vite preview` (HTTP 200 with correct content types).
- External references in `dist/`: only well-known namespace strings (w3.org XML/SVG/MathML identifiers, not requests) and documentation links inside library error-message text (react.dev, Dexie's tinyurl and bit.ly, Workbox's bit.ly). None is fetched by the app.

## Manual checks that remain (on a real phone or desktop Chrome)

1. Open the built app and look at every tab in portrait and landscape; confirm nothing overflows and tap targets feel big enough.
2. Android Chrome: menu, Install app; confirm the name, icon (including the maskable shape) and full-screen launch.
3. Airplane mode after first load: app still opens.
4. Close and reopen: seeded content still present, theme choice remembered.
5. Update toast: build a second version, deploy over the first, confirm "Update ready: reload" appears and nothing reloads until Reload is tapped.
6. Browser network panel online and offline: no requests to other domains.
7. Data screen shows persistence and storage-used lines on the phone.

---

# Stage 2: core workflow (programs and runs, session runner, quick log, edit and delete with undo)

## What was built

- Pure logic in `src/lib` (tests reproduce the spec worked examples): session counting (3.2), weekly streak with rest weeks and the 25 Oct 2026 clock-change week (3.3/3.4), benchmark evaluation per log and for the board (3.6), program position, cycles, phases, "ready to move on", "repeat phase" and the ahead/on track/behind badge (3.7), and a pure runner reducer (`runnerState.ts`).
- Database services: `sessionService.ts` (save, edit, delete, restore), `programRuns.ts` (start, pause, resume, set position, status and cycle refresh), `activeSessionStore.ts` (autosave on every change, resume), `runView.ts`, `homeData.ts`, `startSession.ts`, `sessionDraft.ts`.
- Screens: Home (week progress, streak, club sessions, Next up with Start session, three buttons when no run, Quick log, Log a match, resume banner with confirmed discard, ready/repeat cards, Recent sessions), Train with Programs / Sessions / Drills (category chips on all three; program detail with weeks, drills, minutes, benchmarks, guidance cards, Start, Pause, Resume, Set position; Start now per template; searchable drill list and detail), full-screen Runner, Quick log / Edit log, All sessions, Session detail (Edit, Delete with confirmation and 8-second Undo).
- Not built (later stages): editors and builders, duplicate and reset, Guides, Progress charts, rest-week UI, match form, Block Review, export, backup banner, restore, summary text.

## New file layout

- `src/lib/`: sessionCounting, streak, benchmarks, programPosition, runnerState, format, slots, alerts, activeSessionStore, sessionService, sessionDraft, startSession, programRuns, programList, runView, homeData (+ tests)
- `src/hooks/`: useAsync, useWakeLock
- `src/nav.tsx` (state-based navigation and overlays), `src/undo.tsx` (Undo bar)
- `src/components/`: Stepper, MetricInput, DrillTimer, DrillFields, SummaryFields, ScaleButtons, DrillBrowser, Chips, ConfirmDialog, BenchmarkBadge, ScreenState
- `src/screens/`: Home (rewritten), Train, ProgramsTab, SessionsTab, DrillsTab, Runner, QuickLog, Sessions (All sessions + detail); `Placeholders.tsx` now only Progress and Matches
- `src/test/helpers.ts`; `appState.tsx` gained `dataVersion` / `notifyDataChanged`.

## Runner state shape (activeSession.state, `RunnerState` version 1)

`{ version, startedAt, date, kind, templateId?, templateName?, programRunId?, programWeek?, programCycle?, sessionLabel?, currentIndex, phase: 'drills'|'summary', drills: RunnerDrill[], summary: { effort|null, loopConfidence|null, notes, totalMinutes|null } }`.
`RunnerDrill`: `{ key, drillId, name, category, metricType, description, suggestedSettings, cues, plannedMinutes?, plannedAttempts?, target? (effective benchmark incl. slot override), templateNote?, settingsUsed, hits, attempts, streak (best), streakCurrent, scoreYou, scoreRobot, rating|null, manualMinutes|null, note, touched, skipped, timer: { totalSec, remainingSec, running, endsAt|null } }`.
Running timers store a wall-clock `endsAt`, so state is written only on real changes. On resume a running timer is paused at the time of the last save.

## Assumptions and deviations (labelled)

- S13: "Recent sessions" (last 5) on Home plus "All sessions"; each opens a detail with Edit and Delete.
- S14: the board and readiness ignore logs that do not count (attempts below minAttempts) rather than treating them as misses; fewer than N counting logs is "not met".
- S15: "Ready to move on?" and "repeat phase" use only logs from the run's own sessions, for the relevant week numbers and cycle. Sessions get an optional `programCycle` field (type extension, no migration).
- S16: a phase = consecutive weeks with the same title (P1: 1-3, 4-6, 7-9, 10-12). Since position follows completed sessions, the "repeat this phase" card appears when the run moves past a 3+ week phase whose benchmarks are not all met, and goes away after the next session. Suggestion only.
- S17: calendar badge counts sessions: calendar week c since startDate expects c x sessionsPerWeek done at its start and (c+1) x sessionsPerWeek at its end; below is "behind by N sessions", above is "ahead by N sessions". Includes the manual offset. Shown only for active runs.
- S18: one active run at a time; starting or resuming another pauses the first (confirmation on Start).
- S19: streak input: stepper counts the current run; "New best" copies it to the best streak; on save the larger of the two is stored.
- S20: total minutes prefill = timers' elapsed time; if no timer was used, planned minutes of drills with a result.
- S21: a drill is saved only if it has a result (attempts >= 1; streak/score touched; rating chosen; duration entered). A session with no results cannot be saved. Skipped drills are never saved.
- S22: persistent storage is requested when the session being saved is the first in the database.
- S23: "Start now" from Sessions is not attached to a run, and quick-logged sessions never attach to a run, so they do not advance a program.
- DEVIATION: `DrillLog.targetSnapshot` gained optional `minAttempts` so an edited log is re-evaluated against its original target.
- The stage 1 "Built-in content" counts moved into a collapsed section at the bottom of Home; the stage 1 App test now waits for the week card.
- Added dev dependencies `@testing-library/react` and `@testing-library/dom`.

## Limitations

- No browser Back button handling: Back in the installed app may leave the app. The runner autosaves, so Home offers Resume.
- Quick log has add/remove drills but no reordering (builders are stage 3).
- No Settings screen yet, so timer sound/vibrate can only be tested at their defaults (on).
- The timer beep only works if the timer was started by a tap (by design).

## Verification results (stage 2)

- `npm run typecheck`: clean. `npm test`: 16 files, 124 tests, all passing. `npm run build`: succeeds (14 precache entries).
- Tests include fake-indexeddb: save session, autosave then resume, delete then undo, run creation and position advance, set position, completion and cycle rollover; plus a jsdom Testing Library render of runner counters and a full UI flow (start, hit, leave, resume, save, delete, undo).
- A headless Chromium (/opt/pw-browsers, Playwright from Python) was run once at a 390x844 phone viewport: Home, program Start, Next up, runner, streak counters, summary and save were clicked through with no console errors and no requests outside localhost; screenshots viewed. This is NOT a real phone.

## Manual checks that remain (real Android Chrome)

1. Timer vibrates and beeps at zero.
2. Wake Lock keeps the screen on (headless Chromium only showed the "denied" notice).
3. Force-close mid-session, reopen: Resume restores state.
4. Tap sizes, landscape, readability at the table.
5. Past-dated quick log lands in the right week; delete and Undo within 8 seconds.
6. Start Pressure Loop plan: Home shows Week 1, Session 1.
7. Persistent-storage status in Data after the first saved session.

---

# Stage 3: libraries and builders, Progress, benchmark board, match log, Block Review

## What was built

- **Pure logic (src/lib, tested):** `progressData.ts` (range weeks, weekly bars, minutes, loop-confidence by week, time by category, per-drill series with benchmark line and met flags, y-axis domains, benchmark board using `evaluateBoard`), `chartText.ts` (the text summary shown under every chart), `matchStats.ts` (loops landed %, confidence trend, W/L by opponent style), `blockReview.ts` (window, previous window, comparison, save, list), `p2Check.ts` (end-of-week-2 check), `libraryRules.ts` (validation and blanks), `libraryService.ts` (duplicate, save, reset to original, archive/restore, delete rules), `matchService.ts` (save, validate, delete, restore for Undo), `weekFlags.ts` (rest weeks), `progressService.ts` (loader), `validation.ts`.
- **Train:** Drills, Sessions and Programs now have New, Edit, Duplicate, Reset to original (only when modified), Archive, Restore, Delete (custom only) and a Show archived toggle. New Guides sub-tab (Diagnosis, Between-ball routine, Match-day protocol). Editors: `DrillEditor`, `TemplateEditor` (session builder with Up/Down), `ProgramEditor` (weeks, sessions per week, repeat and cycle length, notes). Saved custom items appear in the libraries and start like built-ins.
- **Progress:** range filter (4 weeks, 12 weeks, All), streak (current and longest), weekly robot-session bars with target line and hatched rest weeks, training minutes per week, rest-week menu, per-drill trend with benchmark line and drill picker, benchmark board (icon plus text), time by category, loop-confidence trend. Each chart is inline SVG with a visible text summary and a designed empty state.
- **Matches:** list newest first, add/edit form with every matchLogs field, delete with confirmation and 8-second Undo, stats card, Block Review entry. Home "Log a match" opens the add form directly.
- **Block Review:** comparison cards (loops landed %, average match confidence, best Pressure Streak Game streak) against the previous equal-length window, the two static prompts, "Emphasis for next block" notes, saved as a blockReviews record, past reviews listed. Reachable from the Holistic program page, from Matches, and offered on Home in the last week of a cycle.
- **P2 check card** on the Pressure Loop program page and on Home.

## New and changed files

- New lib: progressData, chartText, matchStats, blockReview, p2Check, libraryRules, libraryService, matchService, weekFlags, progressService, validation (with tests; `progressService` is exercised by the Progress component tests).
- New components: `ItemActions`, `ShowArchived`, `EditorShell` (with `FormErrors`, `parseNumber`), `charts/` (`WeekBarsChart`, `TrendChart`, `CategoryMixChart`, `chartKit`).
- New screens: `Progress`, `Matches`, `MatchForm`, `BlockReview`, `P2CheckCard`, `GuidesTab`, `DrillEditor`, `TemplateEditor`, `ProgramEditor`; new `content/guides.ts`; `test/fixtures.ts`; `screens/Stage3.test.tsx`.
- Changed: `nav.tsx` (Guides sub-tab and five overlay kinds), `App.tsx`, `Home.tsx`, `DrillsTab`, `SessionsTab`, `ProgramsTab`, `Train`, `DrillBrowser`, `programList` (archived option), `format.ts` (`dayMonth`, `oneDecimal`), `db/types.ts`, `styles.css`.
- Removed: `screens/Placeholders.tsx`.

## Assumptions and deviations (labelled)

- S24: "Minutes per week" is the sum of `totalMinutes` of every saved session that week (robot and club).
- S25: Time by category uses each drill log's own `durationMin` only. Stage 2 saves `durationMin` from timers or the minutes box and does not fall back to planned minutes per drill, so neither does this chart. Drill results with no minutes are not counted, and the chart's text says how many.
- S26: The range filter applies to the weekly bars, minutes, drill trend, category mix and confidence trend. The streak and the benchmark board always use all data. "All" starts at the first session's week (at least 4 weeks, at most 104).
- S27: Rest weeks use the "menu" option of spec 3.4: tapping a bar selects that week, and a panel below has a week picker and a Mark/Remove rest week button. Long-press is NOT implemented.
- S28: A custom drill, session or program is deleted for good only if nothing references it: no drill log, no session log, no template that uses the drill, no program that uses the template, no program run. Otherwise it is archived. This is slightly stricter than the spec (logs only), to avoid dangling references. Built-ins can only be archived.
- S29: `BlockReview.programRunId` and `cycleNumber` are now optional in the type (no migration needed), so a review with no run is saved standalone.
- S30: Block Review applies to any program that repeats with a cycle of 2 or more weeks (the built-in Holistic program P3, and a duplicate of it; P5 with 1 week does not). If the run's current cycle has no sessions yet but the previous one does (the run has just rolled over), the previous cycle is reviewed. The window ends today. The Pressure Streak Game drill is found by `builtInKey = "pl-streak"`.
- S31: The P2 check finds the Pressure Loop program by `builtInKey = "P2"` (a duplicate is not treated as P2). It uses the most recent run of it, any status. "Second week done" means completed sessions plus the set-position offset reach 2 x sessionsPerWeek. Matches count from the run's start date. Latest confidence is the latest match's confidence, else the latest run session's loop confidence, and the card says which. Home shows the card for 14 days after the run's last session (my choice, so it does not stay forever); the program page shows it whenever the second week is done.
- S32: "Reset to original" clears `modifiedByUser` and re-runs the seed, which rewrites the item from `builtinContent`. The archived flag is kept.
- S33: Saving an edit to a built-in always sets `modifiedByUser = true`, even if nothing changed.
- S34: Benchmark validation: hits_attempts threshold above 0% and at most 100% (typed as a percent in the editor); minAttempts a whole number of 1 or more (hits_attempts only); streak a whole number of 1 or more; score_vs_robot a whole-number margin from 0 to 11; duration a whole number of minutes of 1 or more; rating a whole number from 1 to 5; sessions in a row a whole number of 1 or more. The benchmark's metric always follows the drill's metric.
- S35: Program validation requires every week to hold exactly `sessionsPerWeek` sessions (the position maths needs it); the builder resizes weeks when that number changes. Changing a slot's template drops that slot's per-drill overrides (P2-style targets), because they belong to one template.
- S36: Guides wording: the spec gives only the headings for the Between-ball routine (breath, towel, reset) and the four causes for Diagnosis. The sentences under them are mine. Match-day protocol text is the spec's A.5.
- S37: Match loop totals count only matches that have both loops attempted and landed; the form requires both or neither, and landed cannot exceed attempted.
- S38: Chart month labels use fixed three-letter names ("Sep") so axis labels have a predictable width.
- S39: The match confidence trend is per match (oldest to newest); the loop-confidence trend on Progress is the weekly average of session loop confidence.
- S40: Persistent storage is also requested after the first-ever saved match when no session exists yet.
- DEVIATION: Home's "Log a match" opens the add-match form (it previously went to the Matches tab).
- Not changed (as instructed): quick-logged and "Start now" sessions still do not advance a run, the behind-by-N unit, and the repeat-phase card lifetime.

## Limitations

- No browser Back button handling (as in stage 2). Editors are overlays; Close discards unsaved edits without asking.
- Chart tap targets: the bars are about 27 px wide at 12 weeks (narrower for "All"), below 48 px. The selected-week picker and the Mark/Remove button below the chart are the 48 px controls and work without tapping a bar.
- A drill trend with many points uses 8 px markers; points close together overlap.
- The program editor cannot edit a slot's per-drill benchmark overrides (built-in P2 keeps them), and the session builder cannot edit a template item's benchmark override; both are preserved when saving.
- Past Block Reviews are read-only (no edit or delete).
- The JS bundle is just over 500 kB before gzip (Vite prints a size warning, not an error).

## Verification results (stage 3)

- `npm run typecheck`: clean. `npm test`: 25 files, 206 tests, all passing (124 from stages 1-2, 82 new). `npm run build`: succeeds (14 precache entries).
- New tests cover: the 3.3 worked example through the weekly bar builder, the DST week of 25 Oct 2026, benchmark board worked examples (Drill A, I, L), time by category, drill series and y domains, match stats, Block Review window/comparison/save/standalone/rolled-over cycle, P2 check (pure and database), duplicate, edit-sets-modified, reset to original, archive/restore, delete rules, validation, match save/edit/delete/undo, rest-week flag writing and its effect on the streak, plus Testing Library tests for the drill editor, session builder, program builder, match form (including delete and Undo), Matches tab, Progress rest-week and board, Block Review, Guides, and library list actions.
- Headless Chromium (390x844 phone viewport, touch emulation, NOT a real phone) with 10 weeks of varied seeded data (32 sessions, 6 matches, a Holistic run, a finished Pressure Loop run, one rest week): Home, Progress (all charts, 4 weeks, 12 weeks, All, light theme), Matches, match form and its errors, Block Review (empty and with data, save), Drills, Sessions, Programs lists and details, all three editors, Guides, empty states. No console errors, no requests outside localhost.
- Seen and fixed: duplicate heading above the first chart; axis date labels colliding ("14 Sept28 Sept", fixed with three-letter months); a middle x label crowding the last label on the drill trend (now shown only if it clears both ends); the Matches "Log a match" button touching the stats card; chart text a little small (13 px now); markers crowding at 25 points (8 px); "loops 16/21" wording made explicit.

## Manual checks that remain (real Android Chrome)

1. Tap a weekly bar and the week picker on a touchscreen; confirm the selected-week panel is easy to use.
2. Date inputs (match form, Quick log) show the phone's date picker and format.
3. Charts readable outdoors and at the table in dark and light themes; no horizontal scrolling on any Progress card.
4. Delete a match and Undo within 8 seconds on the phone.
5. Rest week: mark a past week, check the Home streak changes accordingly.
6. Start the Pressure Loop plan, finish its second week, and see the check card on Home and on the program page.
7. Block Review from the Holistic program page after a few matches and sessions.

---

# Stage 4: export, summary, backup and restore (plus Settings and Help)

## What was built

- **CSV export** (spec 6): `drill_logs.csv`, `sessions.csv`, `matches.csv` with exactly the spec columns in order, UTF-8, CRLF, RFC 4180 quoting, TRUE/FALSE/blank, `success_rate_pct` and `loop_success_pct` to one decimal place, formula guard on text cells only (`=`, `+`, `@`, tab, CR get a leading single quote; numbers never do), program name from run then program, `session_start_time` and `start_time`/`end_time` as local HH:MM, optional inclusive date range, filenames `loop-lab-<kind>-YYYY-MM-DD.csv`.
- **Copy summary for Claude** (3.10) for 2, 4 or 8 weeks: exact first line, period, robot sessions per week vs target, total minutes, time by category, each benchmarked drill (latest, best, met or not), average effort and loop confidence per week, matches, up to 10 most recent notes cut to 200 characters. Under 6,000 characters by dropping the oldest notes first. Never contains opponent names or any match free text.
- **JSON backup**: `schemaVersion`, `appVersion`, `exportedAt` and all 11 stores at the top level of the file. Share sheet where `navigator.canShare({files})` says yes, otherwise download. `lastBackupAt` is set only after a download started or the share reported success; a cancelled share sheet records nothing.
- **Restore**: validation before anything is touched (size under 20 MB, JSON parses, `schemaVersion` not newer, required fields, string ids, real dates, known enum values, ranges for 1-5 ratings, duplicate ids, unknown fields ignored); the whole file is refused on any structural problem with a plain-English message that names the store, record and field and ends "Nothing was changed." Older files go through `migrateBackupData` (new optional `transformBackup` step on a migration). Preview (counts per store vs what is on the phone now, date range, exportedAt, appVersion), Merge (default) and Replace, one Dexie transaction for the whole write, then built-in content is seeded again.
- **Replace** needs a safety backup: `commitRestore(..., 'replace')` refuses to run without a `safetyBackup` callback, runs it before any data is touched and stops if it fails. The UI asks for explicit confirmation ("Download backup, then replace").
- **Backup banner** on Home (rule is a pure function, `backupBannerDue`), "Back up now" opens the Data tab, scrolls to and focuses the backup button, "Remind me later" hides it for 2 days.
- **Data screen** rewritten: status card (last backup, persistence, storage used, plain warning), Backup, Export (with date range and "Share all three"), Copy summary (2/4/8 weeks, clipboard with a select-the-text fallback), Restore (file picker, preview, mode choice, confirmation, result summary). Theme switch moved to Settings (not duplicated).
- **Settings and Help** screen (full-screen overlay, from Home's Settings button and the Data tab's "Settings and help" button): weekly target, theme, timer sound, timer vibration (with Test buttons), backup reminder (7, 14, 30, 60 days), summary length (2, 4, 8 weeks), install guide, "What is stored where", version info. Every change saves at once and the runner reads the setting live.

## New file layout

- `src/lib/export/`: `csv.ts` (writer and guard), `exportCsv.ts` (columns, three builders, filenames, range filter), `summary.ts`, `exportActions.ts` (loading, download and share of CSVs, summary text)
- `src/lib/backup/`: `stores.ts` (store list, keys, consistent read), `backupBuild.ts`, `backupActions.ts` (make and record a backup), `restoreSchema.ts` (field specs), `restoreValidate.ts`, `restoreCommit.ts` (Merge, Replace, atomic), `restoreRemap.ts` (built-in id matching), `backupBanner.ts`
- `src/lib/deliver.ts` (download, Web Share, clipboard), `src/lib/appInfo.ts` (`APP_VERSION`, `BACKUP_MAX_BYTES`)
- `src/screens/Data.tsx` plus `src/screens/data/` (`StorageCard`, `BackupCard`, `ExportCard`, `SummaryCard`, `RestoreCard`), `src/screens/Settings.tsx`
- `src/components/`: `ChoiceRow`, `Status`, `BackupBanner`
- `src/test/richData.ts`, `src/test/csvParse.ts`
- Changed: `appState.tsx` (`updateSetting`, `refreshSettings`, settings changes queued in order), `db/settings.ts` (updateSettings is one transaction), `db/migrations.ts` (`transformBackup`, `migrateBackupData`), `db/types.ts` (`Settings.backupSnoozedUntil`), `nav.tsx` (`settings` overlay, `openData`, `dataFocus`), `App.tsx`, `Home.tsx`, `lib/format.ts`, `styles.css`, `package.json` (version 0.4.0)

## Assumptions and deviations (labelled)

- S41: the activeSession (unfinished draft) is included in the backup file but NEVER restored. Merge leaves the phone's own draft alone; Replace wipes it along with everything else.
- S42: stores sit at the top level of the backup JSON (`{schemaVersion, appVersion, exportedAt, drills: [...], ...}`); single-record stores (`settings`, `activeSession`) are one-item lists.
- S43: Restore keeps only known fields of each record ("unknown extra fields ignored" means they are accepted and dropped). `restoreSchema.ts` must list every field of every record type; a test round-trips a full database to catch omissions.
- S44: built-in drills, sessions and programs get random ids on each phone, so a plain by-id Merge into a freshly installed app would create a second copy of every built-in. Merge therefore matches built-ins by `builtInKey`, gives the backup record the phone's own id and rewrites references to it. Extra beyond the spec; tested.
- S45: Merge rule extension: a built-in the user edited (`modifiedByUser`) beats a built-in that is still as shipped, whatever their dates (otherwise a newly installed app's fresh seed dates would beat the user's old edit). Otherwise the strictly newer `updatedAt` wins; ties leave the phone's copy.
- S46: Merge of the single settings record: newer `updatedAt` wins, but `lastBackupAt` is the later of the two. Replace sets `lastBackupAt` to the file's `exportedAt` (the data now equals the file) and clears any snooze. Merge does not change it otherwise.
- S47: the summary period is the N Monday-start weeks ending with the current week (the current week is partial), and the period line says so. Benchmarked drills: every non-archived drill with a benchmark is listed; latest and best are within the period; met or not follows the benchmark board rule over all history (like Progress). Notes are session notes and drill notes only; match notes and breakdown notes are left out so a name typed there cannot leak.
- S48: "data" for the banner rule means sessions, drill logs, matches, block reviews, rest-week flags, program runs, and drills/sessions/programs that are custom, edited or archived. Seeded or refreshed built-ins and settings do not count. "Older than" is strictly more than the reminder days (exactly 14 days is not older). No data at all means no banner.
- S49: "Remind me later" is stored as `settings.backupSnoozedUntil` (type extension, no migration). Changing the reminder interval clears it.
- S50: Replace also deletes the phone's activeSession and writes the file's settings (theme, target, and so on). The safety backup is always a download, never the share sheet, and it records `lastBackupAt` like any backup.
- S51: no UTF-8 BOM in the CSVs. The formula guard follows the spec list exactly, so a text cell starting with `-` is not prefixed (negative numbers are numbers and are never text).
- S52: weekly target limited to 1 to 14 in Settings; reminder choices 7, 14, 30, 60 days (a different restored value is shown too); summary length 2, 4, 8 (the Data screen's choice changes the same setting).
- S53: Replace and Merge both re-run the built-in seeding after the commit, outside the restore transaction. If seeding fails the restore stays done and the result says so (seeding also runs on every app start).
- DEVIATION: the stage 1 App test now opens Settings to reach the theme switch (it moved there).

## Limitations

- The share sheet, clipboard permission prompts, multiple-download prompt and Android download location were not tested on a real phone. In headless desktop Chromium `navigator.canShare` is absent, so only the download path ran for real; the share and clipboard-blocked paths are covered by jsdom tests with mocked browser APIs.
- Restoring reads the whole file into memory (limit 20 MB), so a very large backup on a low-memory phone could be slow.
- Restore previews counts but not a per-record diff; the result shows added, updated and unchanged afterwards.
- A saved backup of a very old format can only be migrated if its migration has a `transformBackup` step. There is only schema version 1 today, so no real file has needed it; the mechanism is tested with a fake version 2.
- The backup is one JSON file with no encryption. It contains opponent names. Treat it like the phone itself.

## Verification results (stage 4)

- `npm run typecheck`: clean. `npm test`: 31 files, 286 tests, all passing (206 from stages 1 to 3, 80 new). `npm run build`: succeeds (14 precache entries; the existing chunk-size warning remains).
- New tests: CSV columns and header text, quoting of comma, quote, newline and CR, formula guard (text prefixed, numbers not), TRUE/FALSE/blank, success rate, date range, summary items, limit and oldest-first trimming, no opponent names; backup contents, validation (every enum, bad ids and dates, duplicates, missing stores, corrupt JSON, over 20 MB, newer schema, unknown fields, older schema through a fake migration), backup then wipe then restore (Merge and Replace) with identical records, restore into a freshly seeded app without duplicate built-ins, Merge twice, Replace needing and ordering the safety backup, atomic rollback for a failure midway in both modes, seeding after restore, banner rule with a faked clock, share cancel not recording a backup, clipboard blocked, Settings saving and taking effect (runner timer beeps and vibrates by default and stops when turned off), Data screen flows.
- Real-browser round trip (headless Chromium, 390x844, touch, NOT a phone): seeded 32 sessions, 75 drill logs, 6 matches; exported the three CSVs and the JSON backup through the UI and captured the downloads; CSV headers and rows checked by an independent Python csv reader (CRLF, quoted notes with commas, quotes and newlines, `=` and `+` notes prefixed, TRUE/FALSE/blank, HH:MM times); copied the summary (2,903 characters) from the real clipboard; deleted the app's IndexedDB and reloaded (fresh built-in ids); restored through the file picker with Merge: record counts equal per store, sessions and matches deep-equal, drill logs point at the same drills, no duplicate built-ins; a second Merge changed nothing (0 added, 0 updated); corrupt and newer-format files refused with data unchanged; Replace with confirmation downloaded the safety backup first and ended with the same counts. No console errors apart from Playwright's blocked service worker; no requests outside localhost.
- Seen in screenshots and fixed: the 2 / 4 / 8 week and 7 / 14 / 30 / 60 day buttons wrapped their labels onto two lines (now numbers with the unit in the group label); selected choice was an outline only (added a check mark); the Home banner buttons were unequal widths (now full width); nested cards squeezed the restore tables (tighter padding); the Replace confirmation quoted a confusing "173 records" (now says what is deleted in plain words).

## Manual checks that remain (real Android Chrome)

1. Back up now opens the Android share sheet with the JSON attached, and sharing to Drive or email works; cancelling the sheet leaves "Last backup" unchanged.
2. Chrome's download prompt for "Share all three" when share-with-files is unsupported (it may ask to allow multiple downloads) and where the files land.
3. Copy summary pastes into a Claude chat; if Chrome blocks the clipboard the selected-text fallback is usable by long-press.
4. Choose backup file opens the phone's file picker and can reach Drive or Downloads.
5. Replace restore on the phone: the safety backup lands in Downloads before data is replaced.
6. Test sound and Test vibration buttons in Settings, and the runner timer respecting the toggles.
7. Backup banner after moving past the reminder days (or by choosing 7 days) and tapping Remind me later.
8. Clear Chrome's site data, reopen, restore the JSON: counts match (launch gate LG2).
9. A CSV from real use opened in Google Sheets: columns and the `'=` guard look right (LG5).

## Review fixes

Fixes for the independent review (findings 1 to 5 and 8) plus a README correction. Each has a regression test.

1. Merge duplicated drill logs after a session edit (Finding 1). `updateSession` (src/lib/sessionService.ts) now keeps drill-log ids stable: it reuses the id (and createdAt) of the existing log with the same drillId and order, then any unused log with the same drillId; new ids only for new rows; only removed rows are deleted. Merge (src/lib/backup/restoreCommit.ts) also skips incoming drill logs that are not local by id when the parent session exists locally with an updatedAt newer than or equal to the backup's copy. Tests: `Merging the OLDER backup after an edit (metric)`, `... (add-remove)`, `merging a backup made AFTER the edit twice adds nothing`, `hardening: even if local drill-log ids differ, ...` (backup.test.ts); `editing a session keeps drill-log ids stable, mints ids only for new rows and deletes only removed rows` (sessionService.test.ts).
2. Undo queue (Finding 2). src/undo.tsx holds a stack, each item with its own 8 s expiry; the button reads "Undo" or "Undo (n)" and restores the newest. Tests in src/undo.test.tsx: `two deletes within 8 s can both be undone...`, `each item has its own 8 s expiry...`, `uses a polite live region`.
3. Skip keeps entered data (Finding 3). src/lib/runnerState.ts: Skip only marks a drill skipped when it has no result (new `hasResult`). Tests: `Skip on a drill with entered data behaves as Next: keeps and records it`; the older recorded-drills test was updated.
4. Behind-on-target banner (Finding 4, spec 8). New src/lib/behindTarget.ts, wired through `loadHome` (`behindText`) and a Home card. Shown only when the week is not a rest week, robot sessions are below target, and it is Thursday or later (Monday-start week); text like "1 of 3 robot sessions this week, 4 days left (including today)". Tests in src/lib/behindTarget.test.ts (Mon, Wed, Thu, Sun, rest week, target met, clock-change week, loadHome). Existing screen tests that matched /robot sessions this week/ loosely were anchored, because they would otherwise break on Thursdays to Sundays.
5. Guides cut back to spec wording (Finding 5). src/content/guides.ts: Diagnosis = the four causes plus "Push-to-attack is a recognition skill."; Between-ball routine = Breath, Towel, Reset ("Used on every point."); Match-day protocol = A.5 text exactly. CONTENT_VERSION unchanged (guides are static, not seeded). Tests: `guides use only the spec wording (Finding 5)` (contentIntegrity.test.ts); Stage3 Guides test updated.
6. Time-zone-proof tests (Finding 8). deliver.test.ts and Stage4.test.tsx build dates with local constructors. No app change.
7. README.md: Node requirement corrected to 22.12 or newer.

Nothing here was tested on a real phone.
