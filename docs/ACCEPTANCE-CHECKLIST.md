# Loop Lab: Acceptance Checklist

Tick each box yourself when you have seen it work. Nothing here has been tested by the builder on a real phone.

How to read the tags:

- **(auto-tested)**: a unit test or script in the repository checks the logic. The tests run in the computer's test environment, and the GitHub robot runs `npm test` before every deploy, so a failing test stops a deploy. This is **not** the same as seeing it work on your phone. Where something also needs a real-phone look, the item says so.
- **(manual, phone)**: needs you, on your Android phone. No test can prove it.
- **(manual)**: needs you to look, but not necessarily on the phone.

Some scripts (`npm run audit:tap`, `audit:a11y`, `audit:layout`, `audit:offline`, `audit:back`) drive a desktop browser pretending to be a phone. They exist in the repository and have to be run by hand on a computer with the test browser installed. They are not run by the GitHub robot. They are a good sign, not a phone test.

## Install and offline

- [ ] 1. App loads at the final deployed address. (manual, phone)
- [ ] 2. App installs on Android Chrome as "Loop Lab" with the icon, and opens full screen. (manual, phone)
- [ ] 3. After first load, the app works with airplane mode on. (manual, phone) A desktop-browser check exists (`npm run audit:offline`), which does not replace this.
- [ ] 4. Built-in content is present: 7 categories, all Appendix A drills, session templates and 7 programs. (auto-tested: `seed.test.ts`, `contentIntegrity.test.ts`, `App.test.tsx`). Also look at Home > Built-in content loaded on your phone.
- [ ] 5. Closing and reopening the app keeps all data. (manual, phone) The database save-and-read logic is tested (`sessionService.test.ts`) but real storage on your phone is not.

## Core workflow

- [ ] 6. Starting the Pressure Loop plan makes Home show "Week 1, Session 1" as next up. (auto-tested: `sessionService.test.ts`, `Runner.test.tsx`)
- [ ] 7. Running a session: the timer counts down and vibrates, counters work for all five metric types, notes save, the summary form saves the session. (auto-tested for the counting, counters, notes and saving: `runnerState.test.ts`, `Runner.test.tsx`, `sessionService.test.ts`, `alerts.test.ts`, `Stage4.test.tsx`; **manual, phone** for the real vibration and beep at zero)
- [ ] 8. Force-closing the app mid-session and reopening offers Resume and restores state. (auto-tested for saving on every change and resuming: `sessionService.test.ts`, `Runner.test.tsx`; **manual, phone** for a real force-close)
- [ ] 9. Screen stays awake during the runner. (manual, phone)
- [ ] 10. Quick log of a past-dated session works and counts toward the right week. (auto-tested: `sessionService.test.ts`, `sessionCounting.test.ts`)
- [ ] 11. Editing a log works. Deleting a log works and Undo restores it. (auto-tested: `sessionService.test.ts`, `Runner.test.tsx`)
- [ ] 12. Program position advances by completed sessions, and "Set position" works. (auto-tested: `programPosition.test.ts`, `sessionService.test.ts`)

## Libraries, progress, matches

- [ ] 13. Create, edit and archive a custom drill with a custom description. (auto-tested: `Stage3.test.tsx`, `libraryService.test.ts`)
- [ ] 14. Build a custom session by picking and reordering drills. Build a custom program from sessions. (auto-tested: `Stage3.test.tsx`, `Stage5Back.test.tsx`; reordering uses Up and Down buttons, not dragging)
- [ ] 15. Duplicate a built-in drill, edit it, and "Reset to original" works on an edited built-in. (auto-tested: `libraryService.test.ts`, `Stage3.test.tsx`)
- [ ] 16. Streak and weekly bars match the worked example in the spec (3, 4, 2, 3, then 1: streak 1, longest 2). (auto-tested: `streak.test.ts`, `progressData.test.ts`)
- [ ] 17. Benchmark board matches the worked examples (Drill A 8/10 and 4/5; Drill I 65/72/74 and 72/68/75; Drill L 15/17 and 17/12). (auto-tested: `benchmarks.test.ts`, `progressData.test.ts`)
- [ ] 18. Marking a rest week leaves the streak unbroken. (auto-tested: `streak.test.ts`, `weekFlags.test.ts`, `Stage3.test.tsx`)
- [ ] 19. Add a match log. Loops landed % and confidence trend update. (auto-tested: `matchService.test.ts`, `matchStats.test.ts`, `Stage3.test.tsx`)
- [ ] 20. Block Review opens for the Holistic program and saves emphasis notes. (auto-tested: `blockReview.test.ts`, `Stage3.test.tsx`)

## Export and backup

- [ ] 21. The three CSVs have exactly the columns in the spec, and open correctly in Google Sheets. (auto-tested for the columns: `exportCsv.test.ts`; **manual** for opening in Google Sheets)
- [ ] 22. A note beginning with `=` exports with the leading quote and does not become a formula. (auto-tested for the quote: `exportCsv.test.ts`; **manual** to see it in Google Sheets)
- [ ] 23. "Copy summary for Claude" produces text under about 6,000 characters containing every required item, and it pastes into Claude. (auto-tested for contents and length: `summary.test.ts`, `Stage4.test.tsx`; **manual, phone** for the real clipboard and pasting into Claude)
- [ ] 24. Backup, then wipe site data, then restore gives identical record counts. (auto-tested for backup, wipe the database and restore: `backup.test.ts`; **manual, phone** for clearing Chrome's real site data. This is launch gate LG2.)
- [ ] 25. Merge-restoring the same backup twice creates no duplicates. (auto-tested: `backup.test.ts`)
- [ ] 26. Corrupt JSON and a backup with a newer schema version are both refused with a clear message and no data changed. (auto-tested: `backup.test.ts`, `Stage4.test.tsx`)
- [ ] 27. Replace-restore forces a safety backup first. (manual; also auto-tested for the order of steps: `backup.test.ts`, `Stage4.test.tsx`. Check on your phone that the safety backup file lands in Downloads before the replace happens.)
- [ ] 28. The share sheet opens with the backup file attached. (manual, phone)
- [ ] 29. The backup banner appears when the last backup is older than the reminder period. (auto-tested: `backupBanner.test.ts`, `Stage4.test.tsx`)

## Quality

- [ ] 30. Tap targets, contrast and text sizes meet the spec (48 px targets, AA contrast, 16 px inputs). Landscape works. (auto-tested for contrast: `styles.contrast.test.ts`; scripts for tap size, accessibility and layout in portrait and landscape in a desktop browser: `npm run audit:tap`, `audit:a11y`, `audit:layout`; **manual, phone** for how it really feels at the table, in both orientations. One known exception: the weekly bars on Progress are narrower than 48 px, and the week picker below them is the full-size control.)
- [ ] 31. Every screen has working empty and error states. (auto-tested: `Stage5.test.tsx` and the Stage 3 and 4 tests, which check empty states and error messages; take a look yourself on a fresh install)
- [ ] 32. All unit tests pass: week and clock-change bucketing, streak, benchmark evaluation, CSV escaping, import validation, migrations, summary builder. (auto-tested: `npm test` runs them all; the GitHub robot runs it before every deploy, so a green deploy means they passed)
- [ ] 33. The browser network panel shows no requests to other domains, online or offline. (auto-tested in a desktop browser by `npm run audit:offline`, which fails on any outside request; **manual** to look at the network panel in Chrome on a computer if you want to see it yourself)
- [ ] 34. README, setup guide, user guide and this checklist are delivered. (manual: check that `README.md`, `docs/SETUP-GUIDE.md`, `docs/USER-GUIDE.md` and this file are in the repository)

## Launch gates

All five must be true before you rely on the app. All are manual.

- [ ] LG1. Final address chosen and fixed. (manual) Written down here: ______________________
- [ ] LG2. A backup and restore round trip completed on your phone. (manual, phone)
- [ ] LG3. Install and offline use verified on your phone. (manual, phone)
- [ ] LG4. First real backup saved somewhere off the phone (Google Drive or email). (manual, phone)
- [ ] LG5. A CSV from real use was uploaded to Claude and read correctly. (manual, phone)

## Notes

- Items where "manual, phone" appears are the ones most likely to surprise us, because desktop test browsers differ from Android Chrome (share sheet, clipboard, vibration, keep-awake, install, offline).
- If any item fails, note what you saw and tell me. Do not change your address or clear Chrome data to try to fix it before making a backup.
