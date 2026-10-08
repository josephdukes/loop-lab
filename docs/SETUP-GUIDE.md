# Loop Lab: Setup Guide

This guide takes you from "a folder of files on my computer" to "Loop Lab installed on my Android phone". You do everything on websites. You never need a command line, and you never need to install programming tools.

Nothing in this guide has been tried by me on your accounts or your phone. Where a screen on GitHub or 123-reg may look a little different from my description, the guide says so. If a screen does not match, stop and tell me what you see (a screenshot is ideal) and I will help.

## Words used in this guide

- **Repository** ("repo"): a folder of files stored on GitHub. Think of it as a shared drive folder that also remembers every change.
- **GitHub Pages**: a free GitHub feature that turns a repository into a public website.
- **GitHub Actions**: GitHub's robot. When you add files, it tests the app, builds it and publishes it to Pages. The instructions for the robot are in a file called `deploy.yml`.
- **Deploy**: publish the website.
- **DNS / CNAME record**: the address book of the internet. A CNAME record says "this name is really that other name". Only needed for Option B below.
- **Base path**: the part of the web address after the site name, such as `/loop-lab/`. The app is built for exactly one address.

---

## STOP AND DECIDE FIRST: choose the address before you install

**Your training data is stored inside the phone's browser and is tied to the exact web address. If the address changes later, the app opens empty.**

So:

1. Pick Option A or Option B now (below).
2. Finish all the setup, and check the app loads at that address.
3. Only then install it on your phone.
4. **Never change the address afterwards.** That includes renaming the repository, and switching from Option A to Option B later.

If the address ever must change, your data can move with you: in the old app open the **Data** tab and tap **Back up now**, then at the new address install the app and use **Restore from a backup** (details in Part 8).

### Option A: GitHub's own address (nothing extra to set up)

Your address will look like this:

`https://YOUR-GITHUB-USERNAME.github.io/loop-lab/`

(`YOUR-GITHUB-USERNAME` is the username you choose when you create your GitHub account. `loop-lab` is the repository name you give in Part 2.)

- Free, no domain needed, fastest to set up.
- The downside: the address belongs to GitHub's naming. If you ever leave GitHub or rename the repository, the address changes.

### Option B: your own subdomain, for example `loop.thechocdoc.co.uk`

- One extra setup step in 123-reg (your domain company) and one extra setting in GitHub.
- The upside: the address is yours and stays the same even if the hosting is ever moved.
- You should only pick this if you are happy to sign in to 123-reg and add one record.

**If you are not sure, pick Option A.** Moving from A to B later is possible, but it is a change of address, so it means a Backup and a Restore (Part 8).

Do Part 1 to Part 5 for both options. Option B adds Part 6 before you use the app.

---

## Part 1: Create a free GitHub account

(Skip if you already have one.)

1. On your computer, open a web browser and go to `github.com`.
2. Click **Sign up**.
3. Follow the screens: email, password, username. **Your username becomes part of the address in Option A**, so choose one you are happy with. It is lower case in the address.
4. GitHub emails you a code. Type it in to confirm your email.
5. If GitHub offers paid plans, choose the **Free** one.

## Part 2: Create the repository (the folder on GitHub)

1. Signed in at `github.com`, click the **+** at the top right, then **New repository**.
2. **Repository name**: type `loop-lab` (all lower case, with the hyphen). If you choose a different name, the app still works, but your Option A address uses that name instead.
3. **Description**: optional.
4. Choose **Public**. (GitHub Pages on a free account needs a public repository. It is safe here: the repository holds the app's code only. It does not hold your training data, which stays on your phone, and it holds no passwords or keys. If GitHub offers something different from what I describe for your account, tell me.)
5. Do **not** tick "Add a README file", "Add .gitignore" or "Choose a license". The project already has what it needs.
6. Click **Create repository**.

You will land on a nearly empty page with a box of instructions. Ignore the instructions.

## Part 3: Switch on GitHub Pages first (do this before uploading)

Doing this first stops the robot failing the first time it runs.

1. In your repository, click **Settings** (the row of tabs near the top; on a narrow window it may be under a **...** menu).
2. In the left-hand list, click **Pages**.
3. Find **Build and deployment**. Under **Source**, open the drop-down and choose **GitHub Actions**.
4. There is no Save button for this one; it saves when you choose it. If the page looks different, tell me what you see.

## Part 4: Upload the project files through the website

### What to upload, and what NOT to upload

The project folder on your computer is called `loop-lab`. Upload everything in it **except these three things**:

- **`node_modules`**: a huge folder of ready-made parts. GitHub's robot downloads its own copy. If this is uploaded the upload will fail or take forever. **Do not upload it.**
- **`dist`**: a built copy of the website. The robot builds a fresh one. **Do not upload it.**
- **`audit-output`** (and `dev-dist` or `coverage` if you have them): test pictures and leftovers. Not needed. **Do not upload them.**

**You do need these, and the build fails without them:** `package.json`, **`package-lock.json`**, `index.html`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and the folders `public`, `scripts`, `src` and `docs`.

About `.gitignore`: this is a small file that tells programmers' tools which things to leave out (it lists `node_modules` and `dist`). Its name starts with a dot, so on a Mac it is hidden in Finder (press **Command + Shift + .** to show hidden files; press it again to hide them). Upload it if you can see it. It is not essential when you upload by hand, because you are choosing the files yourself.

### The 100-file limit

GitHub's upload page accepts about **100 files at a time**. Loop Lab has roughly 185 files, so you upload in **four batches**. If you try too many at once GitHub shows a message such as "Yowza, that's a lot of files. Try again with fewer than 100 files." Nothing is harmed; just use smaller batches.

The tricky part is that dragging a folder keeps only that folder's own name. To put files into `src/lib` on GitHub, you drag a folder called `src` that contains `lib`. So for batches 2 to 4 you make a small temporary staging folder on your computer, as below.

**Before you start:** on your computer, make a new empty folder on your Desktop called `upload-staging`. This is only a temporary workspace. You can delete it afterwards. The originals are never moved.

### Batch 1: the top-level files and small folders

1. In your repository on GitHub, click **Add file**, then **Upload files**. (On an empty repository you may instead see a link called **uploading an existing file**. Click that.)
2. On your computer, open the `loop-lab` project folder.
3. Select these items (hold **Ctrl** on Windows or **Command** on Mac while clicking each):
   - the files: `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `README.md`, `STATUS.md`, and `.gitignore` if you can see it
   - the folders: `public`, `scripts`, `docs`
   - **Do not** select `src`, `node_modules`, `dist`, `audit-output`, `.github`.
4. Drag the selected items onto the GitHub page, onto the box that says "Drag files here".
5. Wait until every file name is listed and the progress finishes.
6. Scroll down to **Commit changes**. Leave the message as it is. Make sure **Commit directly to the main branch** is selected. Click **Commit changes**.

### Batch 2: `src/lib`

1. On your computer, inside `upload-staging`, create a folder named `src`.
2. Open the project's `src` folder, and **copy** (not move) the folder `lib` into `upload-staging/src/`. (Copy: select it, Ctrl+C or Command+C, open the target, Ctrl+V or Command+V.)
3. On GitHub, in your repository, click **Add file** then **Upload files**.
4. Drag the **`src` folder from `upload-staging`** onto the page. (Drag `src` itself, not `lib`.)
5. You should see names like `src/lib/...` listed. Click **Commit changes**.
6. On your computer, empty `upload-staging/src` (delete the copy of `lib` from the staging folder only).

### Batch 3: `src/components` and `src/screens`

Repeat Batch 2, but this time copy the folders `components` and `screens` from the project's `src` folder into `upload-staging/src/`. Drag the staging `src` folder to GitHub, **Commit changes**, then empty `upload-staging/src` again.

### Batch 4: the rest of `src`

Copy everything else that is inside the project's `src` folder into `upload-staging/src/`. That means the folders `content`, `db`, `hooks`, `pwa` and `test`, and the loose files directly inside `src`: `App.tsx`, `App.test.tsx`, `appState.tsx`, `main.tsx`, `nav.tsx`, `navContext.ts`, `styles.css`, `styles.contrast.test.ts`, `styles.motion.test.ts`, `undo.tsx`. (You have now covered all of `src`. If your copy has any extra file in `src` not listed here, include it too.) Drag the staging `src` folder to GitHub and **Commit changes**.

### Batch 5: the robot's instructions (`deploy.yml`)

This file lives in a hidden-looking folder called `.github/workflows`, which is easy to lose when dragging, so you create it by typing instead. **Doing this last is deliberate**: the robot starts the moment this file arrives, and by now all the other files are in place.

1. On your computer, open `loop-lab/.github/workflows/deploy.yml` in a plain text app (Notepad on Windows, TextEdit on Mac in plain-text mode). If you cannot see the `.github` folder, on a Mac press **Command + Shift + .** in Finder; on Windows it is normally visible. Select all the text (Ctrl+A or Command+A) and copy it (Ctrl+C or Command+C).
2. On GitHub, in your repository, click **Add file**, then **Create new file**.
3. In the name box at the top, type exactly: `.github/workflows/deploy.yml`. Typing a `/` makes GitHub create a folder. By the time you finish typing, you should see `.github` / `workflows` / then the file name box.
4. Click in the large text area and paste (Ctrl+V or Command+V).
5. Click **Commit changes...**, then **Commit changes** in the box that appears (leave "Commit directly to the main branch" selected).

### Check the upload

Click the **Code** tab. You should see folders `.github`, `docs`, `public`, `scripts`, `src` and the files `package.json`, `package-lock.json`, `index.html`, and the rest. Click into `src`: you should see `components`, `content`, `db`, `hooks`, `lib`, `pwa`, `screens`, `test` plus the loose files. There must be **no** `node_modules` and **no** `dist` folder. If anything is missing, the robot's test step will fail (Part 5), and the error message will tell you; upload the missing file via **Add file > Upload files**, drag it from inside the matching folder using the staging method, and commit again.

## Part 5: Watch the first deploy and find the live address

1. Click the **Actions** tab at the top of your repository.
2. You should see a run called **Deploy to GitHub Pages** (named after your last commit). A yellow circle means it is working; a green tick means done; a red cross means failed.
3. Click the run's name to open it. You will see two boxes, **build** and **deploy**. The first run usually takes a few minutes.
4. When both are green, the **deploy** box shows the address of your site. You can also find it in **Settings > Pages**, in the box at the top that says "Your site is live at ...".
5. Click that address. The Loop Lab Home screen should appear.

For **Option A** this address is your final address: `https://YOUR-GITHUB-USERNAME.github.io/loop-lab/`. Write it down. **Do Part 7 now.**

For **Option B**, do not install yet. Continue to Part 6.

If a red cross appears, go to "If something goes wrong" (Part 9).

---

## Part 6 (Option B only): Your own subdomain

You will tell the app "I live at the root of my own address", point your domain at GitHub, and tell GitHub the name. Order matters.

### 6a. Tell the build to use the root address

1. In your GitHub repository, click **Settings**.
2. In the left list, click **Secrets and variables**, then **Actions**.
3. Click the **Variables** tab (not "Secrets").
4. Click **New repository variable**.
5. **Name**: `LOOPLAB_BASE` (exactly, capital letters).
6. **Value**: `/` (a single forward slash).
7. Click **Add variable**.

This is not a secret; it is just a setting. Nothing sensitive is stored anywhere in this project.

### 6b. Tell GitHub your subdomain name

1. Go to **Settings > Pages**.
2. Find the **Custom domain** box. Type the full name, for example `loop.thechocdoc.co.uk`, and click **Save**.
3. GitHub may show a red or yellow message such as "DNS check unsuccessful" or "Domain does not resolve". That is normal until 6c is done.
4. Look at what GitHub shows you on this page, or in the help link next to it. GitHub's own help page "Managing a custom domain for your GitHub Pages site" explains the record to add for a subdomain.

### 6c. Add the CNAME record in 123-reg

**Important: I am not giving you the record's value from memory.** Copy the exact values GitHub shows or documents at the moment you do this. As a general shape only, a subdomain record has three parts, and you should check each against GitHub:

- **Type**: CNAME
- **Name / Host**: the subdomain part only (the "loop" of `loop.thechocdoc.co.uk`)
- **Points to / Value / Destination**: the address GitHub tells you to point at (for a project like this it is based on your GitHub username, not on the repository name)

The click path in 123-reg, in general terms (123-reg changes its screens from time to time, so **if yours looks different, tell me what you see**):

1. Go to `123-reg.co.uk` and sign in.
2. Open your account's list of domains and choose `thechocdoc.co.uk`.
3. Look for **Manage DNS** (it may be called "DNS settings", "Advanced DNS" or similar).
4. Look for an option to **add a new record**. Choose the type **CNAME**.
5. Type the name and the target exactly as in the box above, then save.
6. Do not delete or change any other records (they may run your website or email).

DNS changes can take anything from a few minutes to many hours to take effect.

### 6d. Switch on HTTPS and re-run the deploy

1. Back in GitHub, **Settings > Pages**. Wait until the custom domain shows a green tick or "DNS check successful". You can refresh the page every few minutes.
2. Tick **Enforce HTTPS**. (If it is greyed out, wait: GitHub is still getting the security certificate. It can take up to about a day.) The app **must** use HTTPS or phone Chrome will not offer to install it.
3. Go to the **Actions** tab. Click **Deploy to GitHub Pages** in the left list, click **Run workflow**, then the green **Run workflow** button. This rebuilds the app with the setting from 6a. Wait for the green tick.
4. In a new browser tab open your subdomain, for example `https://loop.thechocdoc.co.uk/`. Loop Lab Home should appear.

Your final address is that subdomain. Write it down. Then do Part 7.

*Optional extra safety, not required:* GitHub has a "Verified domains" setting under your account's **Settings > Pages** that stops other people claiming your domain. You can set it up later.

---

## Part 7: Install on your Android phone (do this only after the address is final)

1. On your Android phone open **Chrome**. (Use Chrome, not the Samsung browser or Firefox.)
2. Type the final address into the address bar and open it. Loop Lab Home should appear.
3. Tap the **three dots** at the top right of Chrome.
4. Tap **Install app**. On some phones it says **Add to Home screen** instead; use whichever you see.
5. Tap **Install** (or **Add**) to confirm.
6. Find **Loop Lab** on your home screen, and open it from there. It opens full screen, like any other app.

The app also explains this in **Home > Settings > Install on your phone**.

**Check that offline works:** open the app once with signal, close it, switch on airplane mode, then open it again. It should load and work. (I have not been able to test this on a phone; this is your check.)

After installing, make a first backup soon (see the User Guide). You are also meant to do one **test restore** to prove backups work (launch gate LG2 in the Acceptance Checklist).

---

## Part 8: If the address ever has to change

Hopefully never. But if it does (for example you move from Option A to Option B):

1. In the **old** installed app: open the **Data** tab, tap **Back up now**, and send the file to Google Drive or your email. Confirm you can open the file from there.
2. Set up the new address (Parts 6 and 7) and install the app from it. It will be empty.
3. In the new app: **Data > Choose backup file**, pick the file, check the preview, choose **Merge** and tap **Merge backup into this phone**.
4. Check your sessions and matches are there. Only then uninstall the old one.

## Part 9: If something goes wrong

**The deploy shows a red cross.**
Click the failed run, then click the red **build** box, then click the step with the red cross to read the message. The usual causes:
- *"Get Pages site failed" or "Not Found"*: Pages is not switched on. Go to **Settings > Pages** and set Source to **GitHub Actions** (Part 3). Then go to the **Actions** tab, open the failed run and click **Re-run all jobs**.
- *"npm ci can only install with an existing package-lock.json"* or "Missing: ... from lock file": `package-lock.json` was not uploaded, or was uploaded damaged. Upload it again from the project folder (Batch 1) and commit.
- *"Cannot find module" or a test or build fails naming a file*: a file did not upload. The message names the file or folder. Upload the missing piece (Part 4 staging method) and commit; the robot runs again by itself.
- Something about permissions: check **Settings > Actions > General > Workflow permissions** has not been locked down by an organisation setting, and tell me what the message says.

**The page shows "404 - There isn't a GitHub Pages site here".**
The deploy has not finished or never ran. Check the **Actions** tab for a green tick. Check **Settings > Pages** says "Your site is live at ...". Make sure the address you typed matches exactly, including the final `/` and lower-case letters. For Option A the repository name is part of the address.

**A blank (white or black) page, or the page loads but nothing appears.**
This is almost always a **base path mismatch**: the app was built for one address but is being opened at another. Examples: you chose Option B but the `LOOPLAB_BASE` variable (Part 6a) was not set when the app was built, or the variable has a typo, or you set it but did not re-run the workflow. Fix: check the variable's name and value (`LOOPLAB_BASE`, `/`), then re-run the workflow (**Actions > Deploy to GitHub Pages > Run workflow**), wait for the green tick, then reload the page in Chrome. If you have not installed the app yet and the old blank page keeps appearing, close all Chrome tabs showing it and open the address again. Do **not** clear Chrome's site data if the app already holds training data you want to keep.
The opposite also happens: you set the variable for Option B, but you are opening the `github.io/loop-lab/` address. That address will no longer work after you move to a custom domain.

**It worked on the computer but Chrome on the phone offers no "Install app".**
Check you are on the final address, using Chrome, over `https://`. Look in the three-dot menu for **Add to Home screen**. If you opened the address from inside another app's built-in browser, copy the address and open it in Chrome itself.

**The app opens empty after I changed something.**
You are probably at a different address from the one you used before. Open the old address (installed app icon or bookmark). If your data is there, make a **Backup**, then follow Part 8.

**After an update the app looks old.**
This is by design: the app never refreshes by itself in the middle of a session. When a new version is ready you see a bar saying **Update ready: reload**. Tap **Reload** when you are between sessions.

**Anything else.**
Tell me what the screen says, exactly, and where you were in this guide.

---

## Part 10: Updating the app later

Anyone who changes files in the repository (or uploads replacements through **Add file > Upload files**, committing to `main`) causes the robot to test, build and publish again. Your installed app then shows **Update ready: reload**. Your data is not touched by updates. The address does not change.
