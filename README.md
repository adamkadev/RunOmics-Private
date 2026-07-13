# RunOmics

A personal running dashboard that pulls your data from Garmin Connect and turns it into a self-hosted analytics app. Built with Next.js 16, TypeScript, and a Python sync pipeline.

## Features

- **Dashboard** - weekly volume, training load (CTL/ATL/TSB), streak, estimated VO₂max
- **Activity detail** - GPS route map with live-sync to HR, pace, and elevation charts
- **Analytics** - monthly trends: cadence, long runs, 80/20 easy–hard split, pace, HR
- **Calendar** - monthly grid view of all activities
- **Goals & PBs** - annual distance goal, race targets, official personal bests
- **All-time records** - best 1K/5K/10K/half/marathon detected from FIT files
- **Race predictor** - Riegel formula projections from your best efforts
- **Dark mode** - system preference + manual toggle

## Architecture

```
Garmin Connect API
       │
  scripts/sync.py          ← Python pipeline (garth + garmin-fit-sdk)
       │
  public/data/activities/  ← static data store committed to repo (one JSON file per year)
       │
  Next.js (SSG)            ← reads JSON at build time, no database
       │
  Vercel                   ← deploy & host
```

All data is stored as one JSON file per year under `public/data/activities/` and read at build time - no database, no API routes. A new Vercel deployment is triggered automatically after each push.

---

## Setup

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11
- A [MapTiler](https://www.maptiler.com/) account (free tier works)
- A Garmin Connect account

### 1. Clone and install

```bash
git clone https://github.com/adamkadev/RunOmics
cd RunOmics

# Frontend dependencies
npm install

# Python dependencies
pip install -r scripts/requirements.txt
```

### 2. Generate your Garmin secret

The sync script authenticates with Garmin Connect using [garth](https://github.com/matin/garth), which stores an OAuth token as a base64 string.

```bash
python scripts/get_secret.py
```

This will prompt for your Garmin Connect email and password, then print a `GARMIN_SECRET` string. Copy it - you'll need it as an environment variable.

> **Note on garth's deprecation**: garth is [no longer maintained](https://github.com/matin/garth/discussions/222)
> because Garmin keeps breaking its *login* flow. This project only uses that flow
> here, once, to mint the token - `sync.py` merely loads and refreshes the existing
> OAuth token, which continues to work (the underlying OAuth1 token lasts ~1 year).
> No migration is planned while this holds: the community alternatives are
> browser-automation or TLS-impersonation workarounds in an ongoing cat-and-mouse
> game, i.e. no more future-proof than staying put. If `get_secret.py` stops
> working when your token expires, check that discussion for the current
> workaround before switching libraries.

### 3. Configure environment variables

Create a `.env.local` file at the root:

```env
# Garmin Connect auth token (from get_secret.py) - used only by scripts/sync.py, never on Vercel
GARMIN_SECRET=eyJ...

# MapTiler API key (for route maps)
NEXT_PUBLIC_MAPTILER_TOKEN=your_maptiler_key

# Firebase Admin (server-side: notification dedup state in Firestore, push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase client SDK (browser: auth, push notification tokens, activity notes)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...

# Google account allowed to sign in and edit notes/settings (everyone else is read-only)
# NOTE: this only gates the UI. The actual write authorization is enforced by
# the Firestore security rules (firestore.rules at the repo root) - keep the
# email there in sync with this one, and deploy rule changes with
# `firebase deploy --only firestore:rules`.
NEXT_PUBLIC_OWNER_EMAIL=you@example.com

# Shared secret for the internal cron endpoints (PR/shoe-wear/overreaching checks, weekly reminder)
INTERNAL_NOTIFY_SECRET=any-random-string

# UI language: 'en' (default) or 'fr'. Picked at build time.
NEXT_PUBLIC_LOCALE=en
```

> `.env.local` is gitignored. Never commit your secrets.

See [Configuration: goals, PBs, athlete profile](#goals-pbs-athlete-profile) below for the
hand-edited JSON files these features read from.

### 4. Run the initial sync

```bash
python scripts/sync.py
```

This fetches all your running activities from Garmin Connect, downloads the FIT files, parses them, and writes the per-year files under `public/data/activities/`. On first run this may take several minutes depending on your activity count.

Options:

```bash
python scripts/sync.py --limit 10     # sync only the last 10 new activities
python scripts/sync.py --force        # re-sync all activities
python scripts/sync.py --all-types    # include non-running activities
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration: goals, PBs, athlete profile {#goals-pbs-athlete-profile}

Annual goals, official personal bests, and your athlete profile (HR zones, threshold
pace, etc.) are **not** in Firestore - they're hand-edited JSON files committed to the
repo, read server-side at build time. Editing one takes effect on the next deploy
(push to `main`, or wait for the daily Garmin sync to push its own commit).
(Upcoming races are the similar exception: synced from Garmin Connect into
`public/data/upcoming_races.json` by `scripts/sync_upcoming_races.py` - see that
file's docstring.)

```json
// public/data/goals.json
{
  "years": [
    {
      "year": 2026,
      "annualDistanceKm": 1500,
      "targets": [
        { "distance": "5K",            "target": "20:00" },
        { "distance": "10K",           "target": "40:00" },
        { "distance": "Half-Marathon", "target": "1:45:00" },
        { "distance": "Marathon",      "target": null }
      ]
    }
  ]
}
```

`target` is `"mm:ss"` or `"h:mm:ss"` (`null` = no target set).

```json
// public/data/pbs.json - official race times (chip time), take priority over
// auto-detected best efforts in the Records section
{
  "years": [
    {
      "year": 2025,
      "entries": [
        { "distance": "5K",            "time": "20:38",   "activityId": "20526043740" },
        { "distance": "Half-Marathon", "time": "1:37:39", "activityId": "22904920506" }
      ]
    }
  ]
}
```

Valid `distance` values: `"1K"`, `"5K"`, `"10K"`, `"Half-Marathon"`, `"Marathon"`.
`activityId` links the card to the activity detail page (optional).

```json
// public/data/athlete.json - training zones used across Analytics and Profile
{
  "displayName": "Adam",
  "thresholdPowerWatts": null,
  "lthrBpm": 177,
  "thresholdPaceSecPerKm": 254,
  "hrZoneBoundsBpm": [142, 158, 168, 177],
  "restingHrBpm": 64,
  "maxHrBpm": 185,
  "vmaKmh": 16,
  "lastUpdate": "2026-07-13T17:22:27Z"
}
```

`lthrBpm`, `thresholdPaceSecPerKm`, `hrZoneBoundsBpm`, `restingHrBpm`, `maxHrBpm`,
`vmaKmh` and `lastUpdate` are fetched from Garmin Connect and merged in automatically
by every `scripts/sync.py` run (see `scripts/garmin/athlete.py`) - existing values are
preserved if a field can't be fetched, and `maxHrBpm` only ever ratchets up.
`displayName` and `thresholdPowerWatts` have no Garmin equivalent and are edited by
hand. Set any field to `null` to clear it (the app falls back to a population-average
default where one exists, e.g. training load).

### `public/events/` - Race photos

Drop a photo named `{activityId}.jpg` (or `.png`, `.webp`) into `public/events/` and it will appear as the cover image on the PB card for that activity.

---

## Tests & quality

```bash
npm test               # Vitest: usecases, lib helpers, component tests (RTL), a11y smoke (axe-core)
npm run test:coverage  # same suite with a v8 coverage report (text + lcov)
npm run lint           # ESLint (next/core-web-vitals + TS)
npx tsc --noEmit       # typecheck
npm run analyze        # production build with @next/bundle-analyzer treemaps
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, a production-dependency
audit (`npm audit --omit=dev --audit-level=high`) and the build on every push/PR.

The improvement backlog lives in
[`docs/product-improvement-todolist.md`](docs/product-improvement-todolist.md).

### End-to-end tests

Playwright drives a real production build (`next build && next start`). No Firebase
project or secrets are needed: every page the current specs cover (dashboard,
activities list → detail, analytics, calendar, records, goals, map, shoes, plan) is
built from the real, committed `public/data/*.json` files - read-only, no risk of
touching anything.

**Running:**

```bash
npm run test:e2e    # builds, starts, and runs the Playwright specs in e2e/
```

`.env.e2e` carries the non-secret Firebase client config (still needed for the app
to boot, even though these specs don't exercise sign-in-gated flows).

The first e2e batch covers read-only golden paths. Sign-in-gated flows (Settings,
activity notes editing) aren't covered yet - Google's OAuth popup isn't something
Playwright can drive without a test-only auth bypass, which is its own follow-up.

### Monitoring

`GET /api/internal/health` (authenticated with `x-internal-secret`) reports the
last synced activity date and flags the data as `stale` after 7 days without
one - point any uptime monitor at it to catch a silently broken Garmin sync.

---

## Reprocessing

If you update the FIT parser (e.g. after adding new metrics), reprocess all activities from the cached FIT files without re-downloading from Garmin:

```bash
python scripts/reprocess.py
```

---

## Deploying to Vercel

### 1. Push your repo to GitHub

```bash
git add .
git commit -m "initial setup"
git push
```

### 2. Import the project on Vercel

Go to [vercel.com/new](https://vercel.com/new), import your GitHub repo, and keep the default Next.js settings.

### 3. Set environment variables

In your Vercel project → **Settings** → **Environment Variables**, add every variable
from your `.env.local` *except* `GARMIN_SECRET`:

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Route maps |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side notification dedup state and push notifications |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side auth, activity notes, push notification tokens |
| `NEXT_PUBLIC_OWNER_EMAIL` | Restricts settings/notes editing to your Google account |
| `INTERNAL_NOTIFY_SECRET` | Authenticates the GitHub Actions cron calls to `/api/internal/*` |
| `NEXT_PUBLIC_LOCALE` | UI language, `en` (default) or `fr` — applied at build time |

> `GARMIN_SECRET` is only used locally by the sync script - it never runs on Vercel.

For the scheduled GitHub Actions (`sync.yml`, `weekly-reminder.yml`) to reach those
internal endpoints, also add `APP_URL` (your deployed domain) and
`INTERNAL_NOTIFY_SECRET` as **repository secrets** under GitHub → Settings →
Secrets and variables → Actions - separate from the Vercel env vars above.

### 4. Sync and deploy

After each sync, commit the updated data file and push:

```bash
python scripts/sync.py
git add public/data/activities/
git commit -m "sync: $(date +%Y-%m-%d)"
git push
```

Vercel picks up the new commit and redeploys within ~30 seconds.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, SSG) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org/) |
| Maps | [MapLibre GL](https://maplibre.org/) + [MapTiler](https://www.maptiler.com/) |
| Icons | [Lucide](https://lucide.dev/) |
| Dark mode | [next-themes](https://github.com/pacocoursey/next-themes) |
| Garmin auth | [garth](https://github.com/matin/garth) |
| FIT parsing | [garmin-fit-sdk](https://pypi.org/project/garmin-fit-sdk/) |

