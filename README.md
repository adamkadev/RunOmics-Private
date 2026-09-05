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
  RunOmics-data            ← private repository holding the real dataset
       │
  data/                    ← fetched before dev/build, outside public/
       │
  Next.js (SSG + ISR)      ← reads JSON server-side, no database
       │
  Vercel                   ← deploy & host
```

Activities are stored one JSON file per month under `data/activities/`. For personal
development, the canonical dataset is a separate private checkout selected with
`RUNOMICS_DATA_DIR`; the app and Python sync read and write that directory directly.
The app repository's own `data/` is only the default runtime/build workspace. It is
populated from the private repository during a personal deployment, or with a
deterministic demo dataset in an unconfigured clone. Both locations sit outside
`public/`, so the JSON dataset is never exposed as static files.

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

# Canonical local dataset (a sibling private checkout)
RUNOMICS_DATA_DIR=../runomics-data-adam/data

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

# Gemini API key for the AI-written verdicts on Today, Analytics and each
# activity (optional - without it every card falls back to its rules-based
# copy). Get one at https://aistudio.google.com/apikey
#
# Each surface picks its own model (free-tier quotas are counted per model, so
# the per-activity backfill runs on the lite model and never eats into the
# dashboard hero's budget). GEMINI_MODEL overrides all three at once, for when
# Google retires a model - check the live list first:
# https://generativelanguage.googleapis.com/v1beta/models
# GEMINI_API_KEY=...
# GEMINI_MODEL=
# GEMINI_COACH_MODEL= # optional coaching-specific override
```

> `.env.local` is gitignored. Never commit your secrets.

See [Configuration: goals, PBs, athlete profile](#goals-pbs-athlete-profile) below for the
hand-edited JSON files these features read from.

### 4. Run the initial sync

```bash
npx dotenv -e .env.local -- python3 scripts/sync.py
```

This fetches all running activities from Garmin Connect, downloads the FIT files,
parses them, and writes JSON directly into the selected private dataset. A typical
local layout is:

```text
parent/
  runomics-private/
  runomics-data-adam/
    data/
```

The same `RUNOMICS_DATA_DIR` must be used for sync, app, and coaching commands. No
copy through `public/data` or the app's root `data/` is needed. On first run this may
take several minutes depending on activity count.

Options:

```bash
npx dotenv -e .env.local -- python3 scripts/sync.py --limit 10
npx dotenv -e .env.local -- python3 scripts/sync.py --force
npx dotenv -e .env.local -- python3 scripts/sync.py --all-types
```

### 5. Start the dev server

```bash
RUNOMICS_DATA_DIR=../runomics-data-adam/data npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration: goals, PBs, athlete profile {#goals-pbs-athlete-profile}

Annual goals, official personal bests, and your athlete profile (HR zones, threshold
pace, etc.) are **not** in Firestore - they're hand-edited JSON files in the private
`RunOmics-data` repository, fetched into `data/` and read server-side. Editing one
takes effect on the next deploy.
(Upcoming races are the similar exception: synced from Garmin Connect into
`upcoming_races.json` by `scripts/sync_upcoming_races.py` - see that file's
docstring.)

```json
// data/goals.json
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
// data/pbs.json - official race times (chip time), take priority over
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
// data/athlete.json - training zones used across Analytics and Profile
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

## Adaptive coach

The optional coach keeps its reviewed prescriptions under the private `data/coaching/`
tree. Garmin-scheduled sessions under `data/planned_workouts/` remain a separate,
observed schedule signal; applying a coach proposal does not publish anything to
Garmin or trigger a deployment.

```text
data/coaching/
  current_plan.json
  coach_state.json
  decisions/index.json
  decisions/YYYY.json
  evaluations/index.json
  evaluations/YYYY-MM.json
```

Every command creates a private preview first. Review its structured decision and
diff, then apply that exact file:

```bash
npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5
npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5 --race "Harbor Lights 10K"
npm run coach -- evaluate --activity latest
npm run coach -- weekly-review
npm run coach -- --apply .coach-previews/<proposal>.json
```

With private-repository credentials configured, apply fetches the latest data into a
temporary workspace, rejects stale context or plan revisions, writes the coaching
files atomically, and pushes only the private data repository. For local work,
`RUNOMICS_DATA_DIR=../runomics-data-adam/data npm run coach -- ...` operates on the
canonical sibling checkout directly (equivalent to `--data-dir` with that path).
Missing coaching files are valid and leave the existing Plan, Today, and activity UI
unchanged. Demo data includes a deterministic fictional coaching lifecycle; it
never derives a personal plan from another athlete's Garmin data.

---

## Tests & quality

```bash
npm test               # Vitest: usecases, lib helpers, component tests (RTL), a11y smoke (axe-core)
npm run test:coverage  # same suite with a v8 coverage report (text + lcov)
npm run lint           # ESLint (next/core-web-vitals + TS)
npm run typecheck      # tsc --noEmit
npm run analyze        # production build with @next/bundle-analyzer treemaps
```

Each of these populates `data/` first through `npm run prepare:data` (an npm lifecycle
hook, and a no-op once the directory exists), so a fresh clone can lint, typecheck and
test straight after `npm ci` with no private-data configuration.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, a production-dependency
audit (`npm audit --omit=dev --audit-level=high`) and the build on every push/PR.

The improvement backlog lives in
[`docs/product-improvement-todolist.md`](docs/product-improvement-todolist.md).

### End-to-end tests

Playwright drives a real production build (`next build && next start`). No Firebase
project or secrets are needed: every page the current specs cover (dashboard,
activities list → detail, analytics, calendar, records, goals, map, shoes, plan) is
built from `data/*.json` - your real data locally, the generated demo dataset in CI.
Read-only, no risk of touching anything.

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
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_COACH_MODEL` | Optional: AI-written verdicts and preview-only coaching recommendations. The coaching model can be overridden independently |

> `GARMIN_SECRET` is only used locally by the sync script - it never runs on Vercel.

The scheduled workflows read their secrets from a **GitHub Environment** named
after the deployment's profile (GitHub → Settings → Environments), not from
repository secrets: `GARMIN_SECRET`, `RUNOMICS_DATA_REPO_URL`,
`RUNOMICS_DATA_REPO_TOKEN`, `APP_URL` (your deployed domain, no trailing slash),
`INTERNAL_NOTIFY_SECRET`, `VERCEL_DEPLOY_HOOK_URL` and the optional
`PRIVACY_ZONES` / `PRIVACY_RADIUS_M`, plus an environment *variable* `PROFILE`
holding the environment's own name. These are separate from the Vercel env vars
above, and `INTERNAL_NOTIFY_SECRET` must match on both sides.

That indirection is what lets one repository drive several deployments - one per
athlete, each with its own data repository, Firebase project, domain and UI
language. See [Running more than one deployment](docs/personal-deployments.md);
with a single profile it is just a place to keep the secrets.

### 4. Sync and deploy

The nightly `sync.yml` workflow does this on its own, once per profile in its
matrix: it hydrates a runner workspace from that profile's data repository, syncs
Garmin, pushes the changed files back and triggers the matching Vercel deploy hook. After a manual local sync, push the
result the same way:

```bash
node scripts/fetch_private_data.mjs data
RUNOMICS_DATA_DIR=data python3 scripts/sync.py
node scripts/push_private_data.mjs data
```

The source passed to `push_private_data.mjs` must be a complete hydrated dataset;
the command refuses a workspace that could erase existing coaching state.

Vercel picks up the redeploy within ~30 seconds. Nothing real is ever committed to
this repository.

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

### Coaching frequency and training history

`--days` specifies scheduling availability; `--runs-per-week` separately specifies
normal desired frequency and is required by bootstrap. The saved plan retains both
for subsequent reviews. Full weeks with fewer runs must explicitly explain the
recovery/taper/fatigue/illness/injury reason in their focus. Race runs count toward
frequency. `--reference-date YYYY-MM-DD` reproduces a historical context (for example,
`2026-09-05` for the Sep 6–Oct 3 block). `--context-out <path>` saves the
compact bootstrap context for inspection.

`CoachingContext.trainingHistory` is computed locally from the canonical activity
index, using UTC date-only ISO Monday–Sunday weeks. Missing weeks count as zero;
rolling averages require complete N-week calendar spans, including the current
partial week. Insufficient spans return zero. Peak-week runs refer to the highest
mileage week (earliest on ties). Typical peak frequency is mean runs/week in the
best 12-week mileage window, or all available weeks for shorter histories.
Recent 7/28-day windows include the reference date, exclude future records, and
weekly recent averages divide the 28-day totals by four. Gaps count consecutive
non-running days, including both edges of the recent window. Distances are rounded
to two decimals only after aggregation.

Explicit sport metadata excludes non-running activities; legacy canonical records
without sport retain their running classification. Sync now preserves Garmin sport
metadata. Only the compact historical summary is sent to Gemini, alongside the
existing compact recent 28-day activity details. History is evidence of previously
tolerated volume, never a mandatory immediate mileage target. Recent load sets the
starting point; progressive rebuilding depends on recovery and adaptation.

For a 10K primary target with an explicitly targeted 5K tune-up, bootstrap may
include one controlled 5K-specific session 7–10 days before the tune-up when
recovery and load permit. Any long run within three days afterward stays easy.
Normal desired frequency is not a taper quota: an explicitly targeted race must
not be preceded by three consecutive runs within its final four pre-race days.
Use fewer runs with an explicit taper reason when that produces better spacing.

Bootstrap accepts `--guidance-file <path>` for case-specific athlete instructions,
including accepted workouts to preserve and nonmandatory volume ranges. These
instructions reach Gemini separately from deterministic training-history facts.
A limited tune-up-specific session does not automatically make its week a cutback:
additional appropriate volume comes from easy running, never extra quality.

Race events may carry optional `courseContext.pacingNotes` and supplied
`paceProSplits` (segment distance and target seconds). Course-aware goals retain
`targetSeconds`; the derived pace is a whole-course average. The race effort uses
distance and course/effort notes rather than a rigid exact pace throughout.
Supplied splits are retained without inventing missing course data. Flat races
without course context retain their existing behavior. A targeted race-pacing
refinement can preserve every other workout and the race warmup/cooldown exactly.
