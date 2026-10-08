# Loop Lab: User Guide

Loop Lab is a training log for your table tennis robot sessions. It holds your drill programs, times and records each session, shows whether you are training consistently, and makes your data easy to hand to Claude for coaching ideas.

Everything is stored on your phone. There is no account, no server and nothing sent anywhere unless you choose to back up, export or copy something.

This guide describes the app as it is built. I have not been able to test it on a real phone, so the checklist in `ACCEPTANCE-CHECKLIST.md` lists what you still need to try yourself. This guide has no screenshots; button names are given in **bold** exactly as they appear on screen.

## Contents

1. The five tabs
2. Home
3. Train (Programs, Sessions, Drills, Guides)
4. The session runner
5. Quick log, and editing or deleting a session
6. Progress
7. Matches and Block Review
8. Data (backup, restore, CSV, Copy summary for Claude)
9. Settings
10. How the numbers work: streaks, benchmarks, rest weeks, program position
11. Your own drills, sessions and programs
12. Recommended backup routine
13. What the app does not do

---

## 1. The five tabs

Along the bottom: **Home**, **Train**, **Progress**, **Matches**, **Data**. The session runner and the editors open full screen above these tabs. The phone's Back gesture closes the runner, an editor or Settings and returns you to where you came from.

The app uses a dark theme by default. You can switch to light in **Settings**.

## 2. Home

From top to bottom:

- **Unfinished session banner** (only if one exists): "You have an unfinished session", with **Resume** and **Discard**. A session is saved as you go, so if the app is closed or the phone dies mid-session you can pick up where you were. **Discard** asks you to confirm and cannot be undone.
- **Time to back up** banner (only when due): see section 12.
- **This week** card: how many robot sessions you have done this week against your target ("2 of 3 robot sessions this week"), your **current streak** in weeks with the longest ever in brackets, and **club sessions this week** (these are counted separately and do not count towards the robot target).
- **Next up** card if a program is running: the week and session, the session's name and total minutes, the drills with their targets, and a big **Start session** button. It also shows an "Ahead / On track / Behind" note (see section 10).
- If no program is running: "No program running", with **Start a program**, **Start a session** and **Quick log**.
- **Benchmarks hit: ready to move on?** and **Consider repeating this phase before moving on** cards when they apply. They are suggestions only; nothing is ever locked.
- **Last week of this block** card with **Open Block Review** near the end of a repeating program's cycle.
- **Quick log** and **Log a match** buttons.
- **Recent sessions** (the last five) and **All sessions**. Tap a session to see its detail, where you can **Edit** or **Delete** it.
- **Settings** at the top right.
- **Built-in content loaded** (collapsed): counts of categories, drills, session templates and programs.

## 3. Train

Four sub-tabs: **Programs**, **Sessions**, **Drills**, **Guides**. On the first three there is a row of category filter buttons (including All) and a **Show archived** button to reveal anything you have archived.

### Programs

A program is a list of weeks, each with a number of sessions. The built-in programs are:

1. Loop and Transition, 12 Weeks
2. Pressure Loop, 2 Weeks (post-league)
3. Holistic Phase 2, Rolling 4-Week Blocks
4. Counter-Attack and Block, 3 Weeks
5. All-Round Maintenance, 1 Week
6. Serve and Receive Focus, 2 Weeks
7. Footwork and Conditioning, 2 Weeks

Programs 4 to 7 are starter drafts written for the app (not from your earlier programs), so read them and edit them to suit you.

Tap a program to see its details: weeks, sessions, benchmarks and guidance notes. The buttons are:

- **Start** (or **Start again** if you have run it before). Starting asks you to confirm if another program is running; that one is paused, because only one program runs at a time.
- **Pause** and **Resume**.
- **Set position**: jump to any week and session. Choose the week, session (and cycle for repeating programs), then **Apply** or **Cancel**.
- **Edit**, **Duplicate**, **Reset to original** (only shown for a built-in you have edited), **Archive** / **Restore**, and **Delete** (only for your own programs, see section 11).
- **Open Block Review** on repeating programs.

After starting, the **Next up** card on Home shows what to do next.

### Sessions

The library of session templates (a session is an ordered list of drills with minutes). Each has **Start now**, plus **Edit**, **Duplicate** and the other actions above. **New session** builds your own.

Note: **Start now** runs a one-off session that is **not** attached to a program, so it does not move a program forward.

### Drills

Searchable library (type a name or description). Tap a drill to see its description, suggested robot settings, cues, benchmark (if any) and recent results. **New drill** builds your own.

### Guides

Three short cards: Diagnosis, Between-ball routine and Match-day protocol. The Match-day protocol comes from your Holistic program. The Diagnosis and Between-ball routine wording was written for the app from short headings in the plan, so adjust your own notes if you disagree with it.

## 4. The session runner

Start it from **Start session** on Home, or **Start now** on a template. It is a full-screen view designed for a phone propped up at the table.

- At the top: the session title (such as "Week 3, Session 2"), "Drill 2 of 5", a row of progress dots, and two buttons: **Leave** (closes the runner but keeps the session so you can **Resume** from Home) and **Discard** (asks to confirm, then deletes it).
- The screen is asked to stay awake while the runner is open. If your phone refuses or cannot do this, a small notice says so; then you may need to lengthen your phone's screen timeout.
- Each drill card shows the name, category, description, **Suggested settings**, **Cues**, the target or benchmark, and a countdown timer.
- **Timer**: **Start timer** (or **Resume timer**), **Pause**, and **+1 minute**. When it reaches zero the phone beeps and vibrates if your phone allows it and the options are on in Settings. Sound only works if the timer was started by tapping.
- **Robot settings used**: prefilled from the suggestion; edit it to what you really used.
- **Minutes for this drill (optional)** and **Note for this drill (optional)**.
- The result input depends on the drill's metric (each drill has one main metric):
  - **Hits out of attempts**: **Hit** adds one hit and one attempt, **Miss** adds one attempt. Or use the **Hits** and **Attempts** counters with -1 and +1 buttons. Hits can never be more than attempts.
  - **Best streak**: the **Current run** counter, and **New best**, which copies the current run into "Best streak so far".
  - **Score vs robot**: two counters, **Me** and **Robot**.
  - **Duration**: type **Minutes** or use the timer above.
  - **Rating**: five buttons, 1 to 5.
- Footer buttons: **Previous**, **Skip**, **Next** (becomes **Finish** on the last drill), and **Finish early** (always allowed).
- **Summary** ("Finish session"): **Effort** (1 to 5), **Loop confidence** (1 to 5), **Total minutes** (prefilled from the timers, or from the planned minutes if you used no timers; you can edit it) and **Session notes**. Buttons: **Back to drills** and **Save session**.
- A drill is only saved if it has a result. Skipped drills are not saved. If no drill has a result you cannot save and the app tells you so.
- Saving takes you back to Home. If it was the very first session, the app also asks the browser to protect your storage (a request, not a guarantee).
- If the session was started from a program, it is attached to that program and moves your position forward.

## 5. Quick log, and editing or deleting a session

**Quick log** (a button on Home, and on Progress when it is empty) is for sessions you did without the app, or past sessions.

1. Choose **Pick drills myself**, or tap a session template under "Or start from a template".
2. Set the **Date** (today or earlier; it cannot be in the future) and the **Kind**: **Robot session** or **Club session**.
3. For each drill enter the result, minutes and notes the same way as in the runner. Use **Add a drill** to add more, and **Up**, **Down** and **Remove** to reorder or remove.
4. Fill in the **Session** card (effort, loop confidence, total minutes, notes) and tap **Save session**.

A quick-logged session counts towards the correct week of its date. It does **not** move a program forward (only sessions started from a running program do).

To change any past session: Home > tap it in Recent sessions (or **All sessions**) > **Edit** > **Save changes**. To remove it: **Delete session**, confirm **Delete**, and you have **8 seconds** to tap **Undo**. Editing a log keeps its original target, so changing a benchmark later never rewrites history.

## 6. Progress

At the top, **Range** buttons: **4 weeks**, **12 weeks**, **All**. They apply to the charts. The streak and the benchmark board always use all your data. Every chart has a text summary underneath it.

- **Current streak** and **longest streak**.
- **Robot sessions per week**: bars for each week with your target as a line. Rest weeks are hatched. Tap a bar, or use the **Selected week (Monday to Sunday)** picker below, and then **Mark as rest week** or **Remove rest week**.
- **Training minutes per week**.
- **Drill trend**: choose a drill; a line chart of its main result over time with the benchmark line.
- **Benchmark board**: every drill with a benchmark, with latest, best and met or not met (shown with an icon and words, not colour alone).
- **Time by category**: from the minutes recorded on each drill (drills with no minutes are not counted, and the chart says how many).
- **Average loop confidence per week**.

## 7. Matches and Block Review

**Matches** lists your matches newest first. **Log a match** (here, or on Home) opens the form:

**Date**, **Competition** (League, Club, Friendly), **Opponent (kept on this phone only)**, **Opponent style** (Hitter, Chopper, Blocker, Looper, Other), **Result** (Win or Loss), **Games score** (for example 3-1), **Serve faced**, **Loops attempted** and **Loops landed** (enter both or neither), **Confidence** (1 to 5), **Cue used**, a box for where the push-to-attack decision broke down (against what serve, spin and score), and **Notes**. **Save match**. Tap a match in the list to edit; **Delete match** asks to confirm and has an 8-second **Undo**.

The **Stats** card shows loops landed percentage, the confidence trend and results by opponent style.

**Block Review** compares your current four-week block (or the last 28 days if there is no program) with the one before: loops landed in matches, average match confidence and your best **Pressure Streak Game** streak, plus two prompts from the Holistic program. Type **Emphasis for next block** and **Save block review**. Past reviews are listed and are read-only. It is available on the Holistic program page, from Matches, and from a reminder on Home in the last week of a block.

There is also an end-of-week-2 check card for the Pressure Loop plan on its program page, and on Home for 14 days after you finish its sessions.

## 8. Data

The **Data** tab has these cards, top to bottom, and a **Settings and help** button.

### Where your data lives

Your **last backup** date, whether the browser has agreed to protect your storage, how much space is used, and a warning: **clearing Chrome's site data for this app, or uninstalling it, deletes everything for good unless you have a backup saved somewhere else.**

### Backup (JSON)

**Back up now** makes one file, `loop-lab-backup-YYYY-MM-DD.json`, holding everything: sessions, matches, your drills and programs and settings.

- If your phone supports it, the button says **Back up now (share)** and opens the phone's share sheet so you can send the file straight to Google Drive or email. There is also **Save a copy to this phone instead**.
- Otherwise it says **Back up now (download)** and saves into the phone's Downloads. You then move or send it yourself.
- The "Last backup" date is only recorded once the file was actually saved or shared. If you cancel the share sheet, nothing is recorded.

### Export spreadsheets (CSV)

Three files you can open in Google Sheets or upload to Claude. Optional **From date** and **To date** limit the rows. Buttons: **Drill logs CSV**, **Sessions CSV**, **Matches CSV**, and **Share all three** (one share sheet if the phone allows, otherwise three downloads; Chrome may ask to allow multiple downloads).

- `loop-lab-drill-logs-YYYY-MM-DD.csv`: one row per drill done (date, drill, category, result, hits, attempts, success rate, target, whether the benchmark was met, notes).
- `loop-lab-sessions-YYYY-MM-DD.csv`: one row per session (date, times, total minutes, kind, program, effort, loop confidence, notes).
- `loop-lab-matches-YYYY-MM-DD.csv`: one row per match, **including opponent names**, loops and notes.

If a note starts with `=`, `+`, `@`, a tab or a line break, the file adds a single quote at the start so a spreadsheet cannot treat it as a formula. You may therefore see a leading `'` in such notes.

To use a CSV with Claude: in a chat with Claude, attach the file(s) (or open them and paste the contents), then ask something like "Here is my table tennis robot training data. What patterns do you see and what should I focus on next?"

### Copy summary for Claude

A plain-text digest. Choose the **Period (weeks)**: 2, 4 or 8 (the default is 4, and it is the same setting as in Settings). Tap **Copy summary for Claude**, then open a chat with Claude, press and hold in the message box and choose **Paste**. It starts with "Table tennis robot training log summary. Please suggest where I should focus next." and contains: the period; robot sessions per week against target; total minutes; time by category; each benchmarked drill with latest, best and met or not; average effort and loop confidence per week; match counts, wins and losses, loops landed percentage and average confidence; and up to the 10 most recent notes (each cut to 200 characters). It stays under about 6,000 characters. **It leaves out opponent names and all match notes.** The period is whole Monday-to-Sunday weeks ending with the current (partial) week.

If Chrome blocks copying, the text appears selected in a box: press and hold on it and choose **Copy**.

### Restore from a backup

1. **Choose backup file**, then pick your `.json` backup (from Downloads, Google Drive and so on).
2. The app checks the file before touching anything. It refuses a file that is damaged, not a Loop Lab backup, over 20 MB, or made by a *newer* version of the app, and tells you in plain English. In every refusal, **nothing is changed**.
3. If it is fine you see a **preview**: when it was backed up, the app version, the date range, and a table of record counts in the file against what is on the phone now.
4. Choose how to restore:
   - **Merge (recommended)**: adds anything missing and updates anything where the backup has a newer copy. **Nothing is deleted.** Restoring the same file twice changes nothing the second time. Built-in drills are matched by their identity so you do not get duplicate copies. Tap **Merge backup into this phone**.
   - **Replace**: deletes everything on the phone first so it ends up exactly like the backup. Tap **Replace my data...**. The app asks you to confirm, and **first downloads a backup of your current data** ("Download backup, then replace"). If that safety backup fails, nothing is replaced.
5. A result card shows how many records were added, updated and unchanged.

Use Merge for everyday restores and for setting up a new phone. Use Replace only when you want the phone to match the file exactly. An unfinished session draft in a backup is never restored.

## 9. Settings

Open it with **Settings** on Home or **Settings and help** on Data. Changes save the moment you make them.

- **Weekly target (robot sessions)**: 1 to 14, default 3.
- **Theme**: Dark or Light.
- **Timer sound** and **Timer vibration**: On or Off, with **Test sound** and **Test vibration** buttons. A phone or browser that cannot do these stays silent.
- **Remind me to back up after (days)**: 7, 14, 30 or 60.
- **Summary length (weeks)**: 2, 4 or 8.
- **Install on your phone**: the install steps.
- **What is stored where**, and the app, data and content versions.

## 10. How the numbers work

### What counts as a session

A **robot** session counts towards the weekly target if it has at least one drill logged. A **club** session never counts towards the robot target; it is shown separately as "club sessions this week". Weeks run Monday to Sunday by your phone's calendar, and the clock change in October and March does not shift anything.

### Streaks (with the worked example)

Your streak is the number of completed weeks in a row (counting back from last week) where you reached your target. The current week adds 1 only if it has already reached the target; a current week that has not yet reached it does **not** break the streak. Rest weeks are skipped. Home and Progress also show the longest streak ever.

Example with a target of 3. Weeks, oldest to newest: **3, 4, 2, 3**, then this week with **1** so far.

- Last week (3) met the target. The week before (2) did not, which ended the run. So the streak is **1**.
- This week has only 1 session, but it is not finished, so it does not break anything.
- If this week gets to 3 sessions, the streak becomes **2**.
- The longest streak ever is **2** (the first two weeks, 3 and 4).

### Rest weeks

For illness, holiday or being away: **Progress** > tap the week's bar (or use the week picker) > **Mark as rest week**. It is hatched on the chart and ignored by the streak: it neither breaks nor adds to it. **Remove rest week** undoes it. Note: the app uses tapping or the week picker; there is no long-press.

### Benchmarks

A benchmark is a target on a drill, such as "80% with at least 10 attempts". When you save a drill result, the app records the target at that moment and whether you met it, so editing a target later never changes past results. The Benchmark board looks at the latest N results of a drill, where N is the "sessions in a row" setting, and it is met only if **all** N meet the target. A result with fewer attempts than the minimum is ignored; it does not count as a miss.

Worked examples from the built-in drills:

- **Pure Repetition Loop** (Drill A): 80% with at least 10 attempts. **8/10** meets it. **4/5** is also 80% but does not count, because it has fewer than 10 attempts.
- **Traffic Light** (Drill I): 70% with at least 20 attempts, in **two sessions in a row**. Results 65%, 72%, 74%: **met** (the last two are both at least 70%). Results 72%, 68%, 75%: **not met** (the last two are 68% and 75%).
- **Survival Sets** (Drill L): a streak of at least 15, in two sessions in a row. Results 15, 17: **met**. Results 17, 12: **not met**.

A program can also give a drill a different target in one session (the Pressure Loop plan uses a streak target of 8 in week 1 and 12 in week 2).

A benchmark never locks anything. When every benchmarked drill in your current week meets its target, Home shows "Benchmarks hit: ready to move on?". If you have moved past a phase that ran for three or more weeks without meeting all its benchmarks, Home shows "Consider repeating this phase before moving on". You decide.

### Program position

Position follows **sessions completed in your run of the program**, not the calendar, so a missed week never skips or locks anything.

Example: the 12-week program has 3 sessions per week (36 in total). You have completed **7** sessions in your run. That is 2 full weeks plus 1 session, so you are at **Week 3, Session 2**, and Next up says "Week 3, Session 2".

The calendar only adds the badge: **On track**, **Ahead by N sessions** or **Behind by N sessions**, comparing your completed sessions with how many the calendar would expect by now. **Set position** moves you to any week and session, and the badge takes this into account.

Repeating programs (Holistic and All-Round Maintenance) go round again: after the last week the run starts the next cycle. Deleting a session that was attached to a run moves your position back; **Undo** puts it forward again.

## 11. Your own drills, sessions and programs

- **New drill** (Train > Drills): Name, Category, Description, Metric type, **Default attempts** (for hits-out-of-attempts) and **Default minutes**, **Suggested robot settings**, **Cues**, and an optional benchmark (a target number, a minimum attempts where relevant, and how many sessions in a row). Tap **Save drill**.
- **New session** (Train > Sessions): Name, **Robot session** or **Club session**, then **Add a drill** and for each drill its **Minutes** and **Note (optional)**. Use **Up** and **Down** to reorder, **Remove** to take one out. Tap **Save session**. There is no drag-to-reorder.
- **New program** (Train > Programs): Name, Category, Description, **Sessions per week**, **Repeat** (and **Cycle length in weeks**), then for each week a **Title**, an optional **Goal** and, for each session slot, a name and which session template it uses. **Add a week** adds more. Every week must have exactly the number of sessions per week. **Guidance notes** appear as cards; separate them with a blank line. Tap **Save program**.
- **Duplicate** copies any built-in or custom item so you can change it safely.
- **Editing a built-in** keeps your version; app updates will never overwrite an item you edited. **Reset to original** (shown only on an edited built-in, with a confirmation) puts the shipped version back.
- **Archive** hides an item; **Show archived** then **Restore** brings it back. Built-ins can only be archived, never deleted. **Delete** (your own items only) removes it for good only if nothing refers to it (no logs, sessions or programs); otherwise it archives instead. Past logs always keep the drill's name and category as they were.
- The program builder does not edit per-drill benchmark overrides, and the session builder cannot either; these are preserved if you edit a built-in that has them.

## 12. Recommended backup routine

Your phone holds the only copy of your data. A phone can be lost, wiped or have its browser data cleared.

**Every 2 weeks of training (and always before changing phone, clearing Chrome data, or changing the app's address):**

1. Open **Data** and tap **Back up now**.
2. Send the file to **Google Drive** or **email it to yourself** (the share sheet offers both). If you only get a download, open your phone's Files or Downloads and share it from there.
3. Check the file arrived off the phone. A backup that stays only on the phone is not much protection.

The app reminds you: on Home the **Time to back up** banner appears when your last backup is older than your reminder setting (14 days by default) **and** you have logged something since. It has **Back up now** (takes you to the Data tab) and **Remind me later** (hides it for 2 days).

Once, early on, do a test: back up, then follow section 8 to check the preview shows the right counts. Use Merge, which cannot lose anything. (Acceptance launch gate LG2 asks for a full wipe-and-restore test.)

The backup contains opponent names. Treat the file like you treat the phone.

## 13. What the app does not do

- **No push reminders.** It cannot notify you when closed. The only reminders are banners inside the app (unfinished session, backup due). A web app cannot do this reliably without an outside service.
- **No sync between devices.** One phone, one copy. To change phone, back up and restore.
- **No in-app AI or coaching.** Claude is outside the app: you copy a summary or upload a CSV into a chat yourself.
- **No accounts, no cloud storage, no sharing with other people.**
- **No CSV import.** You can export CSVs; only JSON backups can be restored.
- **No video and no robot control.** It does not connect to the Omega Power Pong; you set the robot yourself.
- **No iPhone install.** It should open in iPhone Safari, but installing it on an iPhone is not supported.
- **No long-press and no drag-and-drop.** Rest weeks use tap or the week picker; reordering uses **Up** and **Down**.
- **No automatic updates mid-session.** New versions wait until you tap **Reload** on the "Update ready" bar.
- **Not tested on a real phone yet by the builder.** Install, offline use, keep-awake, vibration, the share sheet and clipboard all need your own checking (see the Acceptance Checklist).
