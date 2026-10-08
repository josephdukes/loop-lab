# Loop Lab

A personal phone app for table tennis robot training. You plan drills and programs, run and log sessions, and see whether training is consistent. It is an installable web app (PWA) that keeps everything on your own phone. There is no server, no account and no tracking. The app only ever loads its own files.

Built with React, TypeScript, Vite, Dexie (the browser's IndexedDB database) and vite-plugin-pwa (offline support). There is no chart library, date library, web font or CDN.

## Run it while developing

1. Install Node.js (version 22.12 or newer), then in this folder run `npm install` once.
2. `npm run dev` starts a local copy and prints its address. Open that address in your browser.

## Build it for publishing

`npm run build` makes the finished site in the `dist/` folder. It also redraws the icons and checks the code for type errors.

The web address the site will live at is not hard-coded anywhere. Tell the build where it will live with the `LOOPLAB_BASE` setting:

- Default (no setting): `/loop-lab/`, which suits `https://<name>.github.io/loop-lab/`.
- Different folder: `LOOPLAB_BASE=/my-folder/ npm run build`
- Own subdomain (site at the root): `LOOPLAB_BASE=/ npm run build`

The leading and trailing slashes are added for you if missing. The install manifest (`start_url` and `scope`) follows this setting automatically. Pick the final address before you install on your phone and never change it afterwards, because the saved data is tied to the address. To check a build locally use `npm run preview`.

## Run the tests

`npm test` runs all the automated tests once. `npm run typecheck` checks types only. Database tests use a fake in-memory IndexedDB, so no browser is needed. Tests cannot prove install or offline use on a real phone; those need checking by hand on the phone.

## Project structure

- `index.html`: page shell, including a strict Content Security Policy.
- `vite.config.ts`: build settings, base path, PWA manifest and service worker.
- `scripts/generate-icons.mjs`: draws the original app icons into `public/icons/`.
- `src/db/`: database types (`types.ts`), the Dexie database (`db.ts`), numbered migrations (`migrations.ts`) and settings with defaults (`settings.ts`).
- `src/content/`: all built-in drills, session templates and programs (`builtinContent.ts`, with `CONTENT_VERSION`), the guide texts (`guides.ts`) and the seeding routine (`seed.ts`).
- `src/lib/`: date helpers (`dates.ts`), and logic for streaks, benchmarks, programs, export and backup.
- `src/components/`: reusable pieces such as bottom navigation, empty/loading/error states and the update toast.
- `src/screens/`: the Home, Train, Progress, Matches and Data screens.
- `src/pwa/`: service worker registration.
- Tests sit next to the code as `*.test.ts` or `*.test.tsx`.
- `STATUS.md`: detailed build notes, assumptions and deviations.

## Changing built-in content

Edit `src/content/builtinContent.ts` and increase `CONTENT_VERSION`. On next start the app adds new built-ins and updates ones you have not edited. Anything you edited yourself is never overwritten.

## Documentation

- [Setup guide](docs/SETUP-GUIDE.md): click-by-click steps to put the app on GitHub Pages and install it on an Android phone, including the optional own-subdomain address and what to do if something goes wrong.
- [User guide](docs/USER-GUIDE.md): every screen, how streaks, benchmarks, rest weeks and program position work, backup and restore, and what the app does not do.
- [Acceptance checklist](docs/ACCEPTANCE-CHECKLIST.md): the 34 acceptance items and 5 launch gates, tagged automatic or manual.
- [What you own and where](docs/OWNERSHIP.md): repository, hosting, domain, phone data and backups.

Publishing is done by `.github/workflows/deploy.yml`, which tests, builds and deploys to GitHub Pages on every push to `main`. Its comments explain how to build for a custom domain.
