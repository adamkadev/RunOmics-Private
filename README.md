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
- **Race page** - the next race: Garmin's prediction against your target and best, its 12-week trend, and even splits at both times
- **Explore** - quartier coverage on the Activities map (Districts layer), a loop-route generator for unexplored quartiers (flat and traffic-free on a reps day), GPX export, the quartiers each run pushed forward, and a push when one passes 90 %
- **Dark mode** - system preference + manual toggle

## Architecture

```
Garmin Personal API · Garmin Connect (garth, optional)
       │
  scripts/sync.py          ← Python pipeline (Personal API + garth + garmin-fit-sdk)
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

# Python dependencies - hash-locked; to change one, edit scripts/requirements.in
# and recompile with the pip-compile command in its header
pip install -r scripts/requirements.txt
```

### 2. Create your Garmin Personal API key

The sync reads your runs through Garmin's **Personal API**, with a key you create
yourself, on [Garmin Connect's Personal API page](https://connect.garmin.com/app/settings/personalApiToken): accept the terms and
create a key. Garmin shows it once; copy it as
`GARMIN_PERSONAL_API_KEY`. Choose the longest lifetime offered (a year at most)
and diary its renewal: an expired key fails the night with a message saying so
(with `GARMIN_SECRET` also set, garth reads the runs meanwhile and the night is
reported as a partial one), and a new key from the same page is all it takes.

The key reads the activity list, each run's detail and FIT file, its time in HR
zones, the daily resting HR and your zones, LTHR, age, fitness age and weight.
`scripts/diagnostics/probe_personal_api.py` lists what it reaches for your
account.

#### Optional: the garth token, for what only Garmin Connect serves

Each run's shoe, the Garmin calendar (planned workouts, races), training status,
race predictions, VO2max and threshold history, and pushing a coaching plan to
the watch are only on Garmin Connect's private API, which the sync reaches with
[garth](https://github.com/matin/garth) and a `GARMIN_SECRET`:

```bash
python scripts/get_secret.py
```

It prompts for your Garmin Connect email and password and prints the string.
Without it the sync still reads every run through the key, and carries VO2max
on from each run's FIT reading (within 0.1 of Connect's); the other pages keep
what they last showed. With it, a failed garth sign-in no longer stops the
night - the runs sync and the night is reported as a partial one.

> **Note on garth's deprecation**: garth is [no longer maintained](https://github.com/matin/garth/discussions/222)
> because Garmin keeps breaking its *login* flow, and since March 2026
> `get_secret.py` can no longer mint a token at all. A token minted before keeps
> working until its OAuth1 token expires (about a year); nothing can replace it
> after that, which is why the runs moved to the Personal API key.
>
> `npm run coach:garmin-auth` reports what is knowable: whether a token exchange
> succeeds right now, and when the OAuth2 tokens minted from your OAuth1 token
> expire. It cannot tell you when the OAuth1 token itself dies - Garmin does not
> return an expiry and garth records none.

### 3. Configure environment variables

Create a `.env.local` file at the root:

```env
# Garmin Personal API key (https://connect.garmin.com/app/settings/personalApiToken) - used only by
# scripts/sync.py, never on Vercel
GARMIN_PERSONAL_API_KEY=GCDC_...
# Optional: garth token (from get_secret.py) for gear, the calendar and Connect's metrics
# GARMIN_SECRET=eyJ...

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

# Google account granted the "owner" custom claim by `npm run set-owner-claim`.
# NOTE: this is provisioning input only. Both the UI gate and the Firestore
# security rules (firestore.rules at the repo root) authorize on the claim
# itself, never on this email, so changing it here grants nothing until the
# script is re-run. Deploy rule changes with
# `firebase deploy --only firestore:rules`.
NEXT_PUBLIC_OWNER_EMAIL=you@example.com

# Shared secret for the internal cron endpoints (PR/shoe-wear/overreaching checks, weekly reminder)
INTERNAL_NOTIFY_SECRET=any-random-string

# UI language: 'en' (default) or 'fr'. Picked at build time.
NEXT_PUBLIC_LOCALE=en

# Optional: the IANA time zone "today" is read in (e.g. Europe/Luxembourg), on
# the server that prerenders a page and in the browser that shows it. Unset,
# each uses its own local date. An unknown zone fails the build.
# NEXT_PUBLIC_TIME_ZONE=Europe/Luxembourg

# Gemini API keys (optional). Get them at https://aistudio.google.com/apikey.
#
# GEMINI_API_KEY writes the verdicts and insight cards on Today, the shoes and
# each activity - without it every card falls back to its rules-based copy.
# GEMINI_COACH_API_KEY is used only by the adaptive coach - a local CLI
# (`npm run coach`) for now - from a separate Google project: coaching never
# falls back to GEMINI_API_KEY and GEMINI_API_KEY never falls back to it, so the
# two free-tier quotas stay independent. Nothing deployed reads the coach key,
# so it goes in .env.local only, not into Vercel or GitHub Actions.
#
# Free-tier quotas are counted per model, so there are two pools: the read
# surfaces draw from the Flash pool, and the per-activity verdict backfill from
# the Flash Lite pool, which never eats into the dashboard hero's budget.
# GEMINI_MODEL replaces whichever pool is being drawn from, for when Google
# retires a model - check the live list first:
# https://generativelanguage.googleapis.com/v1beta/models
# GEMINI_API_KEY=...          # general AI surfaces
# GEMINI_COACH_API_KEY=...    # adaptive coaching only, separate project
# GEMINI_MODEL=
# GEMINI_COACH_MODEL= # optional coaching-specific override

# OpenRouteService key (optional) for Explore's route generator, server-side
# only. Free "Standard" plan at https://account.heigit.org: 2000 directions a
# day, 40 a minute. Without it the generator says it isn't set up.
# ORS_API_KEY=...
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
npx dotenv -e .env.local -- python3 scripts/sync.py --quick
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

The optional coach runs locally, from the CLI (`npm run coach`), and keeps its reviewed
prescriptions under the private `data/coaching/` tree. Every coaching generation reads
`GEMINI_COACH_API_KEY` and nothing else: without it the command fails rather than
borrowing the general `GEMINI_API_KEY` quota. Nothing deployed calls it, so the key stays
in `.env.local` and is needed neither on Vercel nor in GitHub Actions.
Garmin-scheduled sessions under `data/planned_workouts/` remain a separate,
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

The coach reads the notes and tags written in the app from Firestore `activityNotes`, live,
at the moment it builds its context - there is no sync step and nothing lands on disk. That
read needs the Firebase **Admin** credentials, and `.env.local` points at the dev project,
where those notes are not. Put the production admin trio (`FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) in a gitignored `.env.prod`; `npm run coach`
layers it over `.env.local`, and dotenv gives the first `-e` file precedence for a key it
defines, so `.env.prod` need hold only those three and everything else still comes from
`.env.local`. Without that file dotenv carries on, and the coach prints a warning that it is
building the plan without notes - which is the whole failure mode, because a plan built
blind looks exactly like one built with the tags the athlete wrote. There was a separate
`coach:prod` for this and it only ever meant the plain command was the degraded one. The
coaching path only ever reads that collection, but the service account itself is not
read-only, so treat `.env.prod` as the production credential it is.

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
npm run verify         # what CI's verify job runs: private-data check, lint, typecheck, import cycles, tests
npm run test:rules     # firestore.rules against the Firestore emulator (needs Java 21)
npm run validate:data  # the dataset against the Python -> app data contract
```

`npm run build` runs `validate:data` after fetching the dataset. A dataset that
would crash a page (an activity without an id or a date, a goals year without
`targets`) fails the build, so the deployment already live keeps serving; anything
the app tolerates, such as an activity type it does not know yet, is printed as a
warning and never fails it. The rules live in
`src/infrastructure/contracts/dataContract.ts`.

Most commits go straight to `main`, where CI only reports after the push. A
pre-push hook runs `npm run verify` (and the Python suite, when `pytest` is
installed) before a push to `main`, and leaves every other branch alone. Enable it
once per clone with `git config core.hooksPath .githooks`; `git push --no-verify`
skips it.

Each of these populates `data/` first through `npm run prepare:data` (an npm lifecycle
hook, and a no-op once the directory exists), so a fresh clone can lint, typecheck and
test straight after `npm ci` with no private-data configuration.

CI (`.github/workflows/ci.yml`) runs a production-dependency audit
(`npm audit --omit=dev --audit-level=high`), lint, typecheck and the Vitest suite on every
push/PR, plus the Python suite (`pytest scripts/tests/`) as a separate job. It does **not**
run `next build`. The production build is exercised by the E2E workflow
(`.github/workflows/e2e.yml`), which runs `npm run test:e2e` — Playwright's `webServer`
runs `e2e:build` (`next build`) and serves it with `e2e:start`. So a change that only
breaks the build fails E2E, not CI. E2E runs on pushes to main and on demand, not on pull
requests (a run is about 3 minutes): run it on a branch from Actions → E2E → Run workflow
before merging a change that could break the build.

### End-to-end tests

Playwright drives a real production build (`next build && next start`). No Firebase
project or secrets are needed: every page the current specs cover (dashboard,
activities list → detail, analytics, calendar, records, goals, map, shoes, plan) is
built from the generated demo dataset. Read-only, no risk of touching anything.

**Running:**

```bash
npm run test:e2e    # regenerates the demo dataset, builds, starts, runs the specs in e2e/
```

The suite has its own dataset. `npm run e2e:data` wipes and regenerates `.e2e-data/`
before every build, and `.env.e2e` points `RUNOMICS_DATA_DIR` at it, so a local run and a
CI run see exactly the same data. Without that, `.env.local` selected a real athlete
checkout for the build while CI generated demo data - the same specs, two different
datasets. `scripts/prepare-e2e-data.mjs` ignores `RUNOMICS_DATA_DIR` entirely and only
ever writes to `.e2e-data/`, so no configured workspace can be reset by accident; the
`prepare-data` run that follows then sees a populated explicit workspace and leaves it
alone, exactly as it would a real one. `.e2e-data/` is gitignored.

`.env.e2e` also carries the non-secret Firebase client config (still needed for the app
to boot, even though these specs don't exercise sign-in-gated flows) and pins `PORT` to
3100, so a dev server on 3000 does not collide with the suite's own.

The first e2e batch covers read-only golden paths. Sign-in-gated flows (Settings,
activity notes editing) aren't covered yet - Google's OAuth popup isn't something
Playwright can drive without a test-only auth bypass, which is its own follow-up.

### Monitoring

`GET /api/internal/health` (authenticated with `x-internal-secret`) reports the
last synced activity date and flags the data as `stale` after 7 days without
one - point any uptime monitor at it to catch a silently broken Garmin sync.
Its `integrations` field says which server integrations the deployment has
credentials for (`firebaseAdmin`, `gemini`, `syncButton`), by name only, and
the nightly sync warns when one the post-sync checks need is missing.

Errors on a phone are reported to `/api/client-errors`, scrubbed of coordinates,
and listed under Settings → Diagnostics; see
[Client error reports](docs/security-and-build.md#client-error-reports).

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

`vercel.json` runs the server functions in Paris (`cdg1`), next to the Firestore databases
(`eur3`, Belgium and the Netherlands) and a few milliseconds from OpenRouteService (Heidelberg).
Vercel's default, Washington (`iad1`), put about 150 ms on every request that is not a cached page.
A deployment whose Firestore is elsewhere should pick the Vercel region nearest to it.

### 3. Set environment variables

In your Vercel project → **Settings** → **Environment Variables**, add every variable
from your `.env.local` *except* `GARMIN_PERSONAL_API_KEY`, `GARMIN_SECRET` and `GEMINI_COACH_API_KEY`:

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Route maps |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side notification dedup state and push notifications |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side auth, activity notes, push notification tokens |
| `NEXT_PUBLIC_OWNER_EMAIL` | Which account `npm run set-owner-claim` grants the `owner` claim to - not itself an authorization check |
| `INTERNAL_NOTIFY_SECRET` | Authenticates the GitHub Actions cron calls to `/api/internal/*` |
| `NEXT_PUBLIC_LOCALE` | UI language, `en` (default) or `fr` — applied at build time |
| `NEXT_PUBLIC_TIME_ZONE` | Optional: the athlete's IANA time zone (e.g. `Europe/Luxembourg`), so a page prerendered on Vercel's UTC clock and the browser agree on which day it is - see [Date handling](docs/interface.md#date-handling) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional: the AI-written verdicts and insight cards - Today, run verdicts, PB celebration, shoe verdicts |
| `ORS_API_KEY` | Optional: Explore's route generator (OpenRouteService loops) - see [Explore](docs/interface.md#explore) |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | The private data repository the build clones; a fine-grained token with Contents: Read only |
| `RUNOMICS_DATA_SOURCE` | Optional: `github` reads that repository at run time, so a sync shows without a rebuild - see [Reading the data at run time](docs/data-and-sync.md#reading-the-data-at-run-time) |

> `GARMIN_PERSONAL_API_KEY` and `GARMIN_SECRET` are only used by the sync script - neither runs on Vercel.
> `GEMINI_COACH_API_KEY` / `GEMINI_COACH_MODEL` are the same: the adaptive coach is a local
> CLI (`npm run coach`) for now, so nothing deployed reads them. Add them here only if a
> server-side coaching route ever ships. No workflow runs a coaching generation either, so
> they belong in no GitHub Environment yet. See
> [AI insight generation](docs/coaching-and-metrics.md#ai-insight-generation) for the full split.

The scheduled workflows read their secrets from a **GitHub Environment** named
after the deployment's profile (GitHub → Settings → Environments), not from
repository secrets: `GARMIN_PERSONAL_API_KEY` (and optionally `GARMIN_SECRET`), `RUNOMICS_DATA_REPO_URL`,
`RUNOMICS_DATA_REPO_TOKEN`, `APP_URL` (your deployed domain, no trailing slash),
`INTERNAL_NOTIFY_SECRET` and `VERCEL_DEPLOY_HOOK_URL`, plus an environment
*variable* `PROFILE` holding the environment's own name, and `DATA_SOURCE=github`
once that deployment reads its data at run time. These are separate from the Vercel env vars
above, and `INTERNAL_NOTIFY_SECRET` must match on both sides.

That indirection is what lets one repository drive several deployments - one per
athlete, each with its own data repository, Firebase project, domain and UI
language; with a single profile it is just a place to keep the secrets.

### 4. Sync and deploy

The nightly `sync.yml` workflow does this on its own, once per profile in its
matrix: it hydrates a runner workspace from that profile's data repository, syncs
Garmin, pushes the changed files back and triggers the matching Vercel deploy hook.

The app's Sync button runs the same workflow with `quick`: the new runs come
through the Personal API key alone, with no WARP and no garth sign-in, then the
push, the deploy and the post-sync checks as usual. Their shoes, the calendar and
Connect's metrics wait for the nightly sync, which asks Connect for every shoe it
has not answered yet, however old the run. A profile without a key syncs in full.

After a manual local sync, push the result the same way:

```bash
node scripts/fetch_private_data.mjs data
RUNOMICS_DATA_DIR=data python3 scripts/sync.py
node scripts/push_private_data.mjs data
```

The source passed to `push_private_data.mjs` must be a complete hydrated dataset;
the command refuses a workspace that could erase existing coaching state. The
fetch is what makes the push safe: it records the commit the workspace came
from, and the push refuses if the data repository has moved on since.

Vercel picks up the redeploy within ~30 seconds. Nothing real is ever committed to
this repository.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, SSG) |
| Language | TypeScript 7 (`tsc`), with the TypeScript 6 API for typescript-eslint and Next until 7.1 ships one |
| Styling | Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org/) |
| Maps | [MapLibre GL](https://maplibre.org/) + [MapTiler](https://www.maptiler.com/) |
| Icons | [Lucide](https://lucide.dev/) |
| Dark mode | [next-themes](https://github.com/pacocoursey/next-themes) |
| Garmin data | Garmin's Personal API, and [garth](https://github.com/matin/garth) for what only Connect serves |
| FIT parsing | [garmin-fit-sdk](https://pypi.org/project/garmin-fit-sdk/) |

### Map styles

The basemaps are RunOmics' own, kept in the repo: `src/map/styles/runomics-light.json` and
`runomics-dark.json`, built from MapTiler's Dataviz styles (`dataviz-v4`, `dataviz-v4-dark`) in greys
only, so the athlete's accent-coloured runs are the one colour on a map. The colours come from
`MAP_STYLE_COLORS` in `src/lib/themeTokens.ts`. The MapTiler API cannot save a style, so after a
MapTiler update (or a colour change) rebuild them by hand and commit the result:

```bash
MAPTILER_KEY=your_maptiler_key npm run map:styles
```

The script matches layers by pattern, fails if a colour with a hue is left in a visible layer, and
writes `{key}` in place of the key; `maptilerStyle()` in `src/lib/maptiler.ts` fills it in at run time
and names places in the app's language.

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

---

## Implementation notes

The source tree carries no explanatory comments: naming and structure are meant to
carry *what* the code does. This section is where the *why* lives — the constraints,
external-API quirks, and deliberate decisions that the code cannot state about itself.
Read it before changing behaviour in the areas it covers.

- [Data and sync](docs/data-and-sync.md): Private data and the sync pipeline, Reading the data at run time, Garmin write path (coaching sync), Garmin-sourced series, Official race results.
- [Coaching and metrics](docs/coaching-and-metrics.md): Coaching model, The Plan's single workout shape, Training metrics, AI insight generation.
- [Interface](docs/interface.md): Charts, Colour system, Maps, Explore, Share card, Platform and browser workarounds, Internationalisation, Date handling.
- [Security, build and tests](docs/security-and-build.md): Owner authorization, Content Security Policy, Build configuration, Test configuration, End-to-end and screenshot runs, Service worker.
