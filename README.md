# FirearmLog

Training, competition, and maintenance log for shooters. Local-first PWA — all data
stays on your own devices. Built with Vite + TypeScript + React.

**This folder is the GitHub repository root.** Michael's real data files are blocked
from ever being committed (see `.gitignore`).

## How publishing works

Every push to `main` triggers `.github/workflows/deploy.yml`, which installs
dependencies, **runs all tests (a failing test blocks publishing)**, builds the app,
and deploys it to GitHub Pages.

## One-time setup (Michael)

1. Install **GitHub Desktop** from https://desktop.github.com and sign in with your GitHub account.
2. In GitHub Desktop: **File → New Repository**. Name: `app`. Local Path: your
   `Claude Projects/FirearmLog` folder. Git ignore: None. License: None. Click **Create Repository**.
   (It adopts this existing `app` folder — nothing is moved.)
3. Click **Publish repository**. In that dialog, change the name to **FirearmLog**,
   UNCHECK "Keep this code private" (GitHub Pages needs a public repo on a free
   account — the app's code is public; your shooting data never goes to GitHub), then publish.
4. On github.com, open the new FirearmLog repo → **Settings → Pages** → under
   "Build and deployment", set **Source: GitHub Actions**.
5. Back in GitHub Desktop, click **Repository → Push** (or it may already be pushed).
   The robot builds for ~2 minutes. The app appears at
   `https://<your-username>.github.io/FirearmLog/`.

## Every update after that

Claude edits the files. Michael opens GitHub Desktop, types a one-line summary,
clicks **Commit to main**, then **Push origin**. Two minutes later the new build is live.

## Developer commands (run by the GitHub robot, not by Michael)

- `npm install` — get dependencies
- `npm test` — run the automated tests (plain Node, no dependencies needed)
- `npm run build` — type-check and build the production app
- `npm run verify-real -- ../pistol-tracker-sync.json` — local-only check of the
  importer against the real data file (the file never leaves this computer)
