# Loop Lab: What you own and where

## What you own

| What | Where it lives | Who controls it | Cost |
|---|---|---|---|
| The app's code and these documents | Your **GitHub repository** (for example `YOUR-USERNAME/loop-lab`) on github.com | You, through your GitHub account and password | Free |
| The published website | **GitHub Pages**, switched on in the repository's Settings > Pages. GitHub's robot (GitHub Actions) rebuilds and publishes it from the repository | You, through the same account | Free (the repository is public; see below) |
| Your web address, Option A | `https://YOUR-USERNAME.github.io/loop-lab/`, part of the GitHub account and repository name | You, but only while the account name and repository name stay the same | Free |
| Your web address, Option B (only if you chose it) | A subdomain such as `loop.thechocdoc.co.uk`, defined by one **CNAME record** in the **DNS settings at 123-reg**, plus the **Custom domain** setting in GitHub Pages | You, through your 123-reg account and your GitHub account | The domain you already own; no extra charge is part of this project |
| Your training data | The **browser storage on your phone** (inside Chrome, for the app's address). Sessions, matches, your own drills and programs, and settings | You, on that phone only | Free |
| Your backup files | `loop-lab-backup-YYYY-MM-DD.json`, wherever you put them (see below) | You | Free |
| Exported CSV files | Wherever you save or send them | You | Free |

Prices of anything outside this project (such as any 123-reg renewal fees) are not stated here; check with 123-reg.

## What the repository contains, and what it does not

The repository is public because free GitHub Pages needs that. It holds the app's code, its built-in drill and program content, and these documents. It does **not** hold your training data, your opponents' names, your backups, or any password or key. There are none to hold: the app has no secrets.

## What is NOT used

- **No Supabase.** No database in the cloud.
- **No Brevo.** No email service.
- **No servers** that you run or pay for. GitHub serves the files, the phone does everything else.
- **No accounts in the app**, no logins.
- **No secrets of any kind**: no API keys, passwords or tokens in the code, the repository settings or the workflow. (The one repository setting you may add for Option B, `LOOPLAB_BASE`, is just the path `/`.)
- **No analytics, tracking, ads, third-party scripts, fonts or CDNs.** After it has loaded, the app only ever reads its own files.
- **No cloud sync.** The data exists on your phone and in whatever backup files you make.

## What this means in practice

- If you **lose the phone, clear Chrome's site data, or uninstall the app, your data is gone** unless you have a backup file somewhere else. There is no cloud copy to recover from.
- If the **web address changes**, the installed app starts empty (the data is tied to the address). Back up first and restore at the new address (SETUP-GUIDE, Part 8).
- If you **lose access to your GitHub account**, the live app keeps working on your phone (it is stored there for offline use), but you could not publish updates. Keep the account's recovery options up to date.
- If you **stop using GitHub Pages**, with Option B you can point the same subdomain somewhere else and the address stays the same. With Option A the address would change.

## Where to keep backups

Make a backup about every 2 weeks (Data tab > **Back up now**). Put the file in at least one place that is not the phone:

1. **Google Drive** (use the share sheet, then choose Drive), in a folder such as "Loop Lab backups". Best option: it is off the phone and easy to find.
2. **Email to yourself** (use the share sheet, then Gmail). Good second copy; the subject line can be the file name.
3. Optionally a copy on your computer.

The backup file contains your opponents' names and your notes. Do not share it publicly. Keep a few older files rather than overwriting the last one: dated filenames make this easy.
