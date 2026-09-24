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
>
> `npm run coach:garmin-auth` reports what is knowable: whether a token exchange
> succeeds right now, and when the OAuth2 tokens minted from your OAuth1 token
> expire. It cannot tell you when the OAuth1 token itself dies - Garmin does not
> return an expiry and garth records none - so the honest answer is that a
> working exchange today is the only evidence there is. Run it before a long
> trip rather than discovering the failure through a silent nightly sync.

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

# Gemini API keys (optional). Get them at https://aistudio.google.com/apikey.
#
# GEMINI_API_KEY writes the verdicts and insight cards on Today, Analytics and
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
npm run verify         # what CI's verify job runs: private-data check, lint, typecheck, tests
npm run test:rules     # firestore.rules against the Firestore emulator (needs Java 21)
```

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
breaks the build fails E2E, not CI.

The improvement backlog lives in
[`docs/product-improvement-todolist.md`](docs/product-improvement-todolist.md).

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
from your `.env.local` *except* `GARMIN_SECRET` and `GEMINI_COACH_API_KEY`:

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Route maps |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side notification dedup state and push notifications |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side auth, activity notes, push notification tokens |
| `NEXT_PUBLIC_OWNER_EMAIL` | Which account `npm run set-owner-claim` grants the `owner` claim to - not itself an authorization check |
| `INTERNAL_NOTIFY_SECRET` | Authenticates the GitHub Actions cron calls to `/api/internal/*` |
| `NEXT_PUBLIC_LOCALE` | UI language, `en` (default) or `fr` — applied at build time |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional: the AI-written verdicts and insight cards - Today, Week Purpose, Season, Analytics, run verdicts, PB celebration, shoe verdicts |

> `GARMIN_SECRET` is only used locally by the sync script - it never runs on Vercel.
> `GEMINI_COACH_API_KEY` / `GEMINI_COACH_MODEL` are the same: the adaptive coach is a local
> CLI (`npm run coach`) for now, so nothing deployed reads them. Add them here only if a
> server-side coaching route ever ships. No workflow runs a coaching generation either, so
> they belong in no GitHub Environment yet. See
> [AI insight generation](#ai-insight-generation) for the full split.

The scheduled workflows read their secrets from a **GitHub Environment** named
after the deployment's profile (GitHub → Settings → Environments), not from
repository secrets: `GARMIN_SECRET`, `RUNOMICS_DATA_REPO_URL`,
`RUNOMICS_DATA_REPO_TOKEN`, `APP_URL` (your deployed domain, no trailing slash),
`INTERNAL_NOTIFY_SECRET`, `VERCEL_DEPLOY_HOOK_URL`, `PRIVACY_ZONES` /
`PRIVACY_RADIUS_M` (required: the sync refuses to write a GPS route without
them) and the optional but recommended `PRIVACY_SALT`, plus an environment
*variable* `PROFILE` holding the environment's own name. These are separate from the Vercel env vars
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
the command refuses a workspace that could erase existing coaching state. The
fetch is what makes the push safe: it records the commit the workspace came
from, and the push refuses if the data repository has moved on since - see
[Concurrent writes](docs/personal-deployments.md#concurrent-writes-to-a-data-repository).

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

---

## Implementation notes

The source tree carries no explanatory comments: naming and structure are meant to
carry *what* the code does. This section is where the *why* lives — the constraints,
external-API quirks, and deliberate decisions that the code cannot state about itself.
Read it before changing behaviour in the areas it covers.

### Private data and the sync pipeline

**`data/` sits at the repository root, deliberately outside `public/`.** Everything
under `public/` is served as a static asset, so a dataset there would put real
Garmin-derived data back on the open web.

**`scripts/prepare-data.mjs` only ever fills a gap.** If `data/activities/index.json`
already exists it is a no-op, so it can never clobber a dataset fetched or synced
earlier. Absent, with `RUNOMICS_DATA_REPO_URL` set, it fetches the private data repo
and fails loudly on any error — never silently falling back to demo data for what is
supposed to be a real personal deployment. Absent and unconfigured, it generates the
deterministic demo dataset. An explicit `RUNOMICS_DATA_DIR` is authoritative and is
never populated here; it must already hold a complete activity dataset.

**`RUNOMICS_DATA_REPO_TOKEN` never touches argv, the clone URL, `.git/config`, or an
error message.** It reaches `git` only through `GIT_ASKPASS`, a helper git invokes as
its own subprocess which reads the token from *its* inherited environment — environment
variables are not visible via `ps` the way argv is. The helper file itself contains only
the env var *name*, never the value, and lives in a temp dir removed in `finally`.
Anything git prints on failure is redacted before an `Error` is ever constructed, so a
caller that logs the exception (Vercel or GitHub Actions build logs, an uncaught-exception
handler) cannot leak the token indirectly. `GIT_ASKPASS` requires an HTTPS remote, so
`RUNOMICS_DATA_REPO_URL` must be `https://…`, never `git@`/`ssh://`.

**Optimistic concurrency guards the data repository.** Pushing is a wholesale
replacement — `rm -rf data/` then copy — so it is only ever safe against the exact commit
the workspace was hydrated from. `fetch_private_data.mjs` records that commit;
`push_private_data.mjs` refuses to push if the remote has moved. Without this, the
nightly sync (minutes between its fetch and its push) silently deletes whatever landed
in that window — this is how a manually committed `coaching/garmin-sync.json` was once
lost. There is no automatic merge: the caller re-fetches and retries, the only way to be
sure a concurrent commit is preserved rather than guessed at.

The marker deliberately lives **next to** the data directory, never inside it: `data/`
is copied verbatim into the private repository, so a base-revision file under it would
become persisted user data and be pushed back as part of the dataset. For a workspace at
`<dir>/data` the marker is `<dir>/.data.base-revision.json`, so it travels with the
workspace across processes (GitHub Actions fetches in one step and pushes in another)
and is discarded with the workspace's temporary root. Only the commit SHA is recorded,
never the token; the URL is recorded to catch a workspace being pushed at a different
repository than it came from, where comparing SHAs would be meaningless.

`push_private_data.mjs` duplicates `fetch_private_data.mjs`'s small token helper rather
than sharing a module, on purpose — each script stays independently readable and
auditable.

The concurrency check runs *before* the workspace replaces the clone's `data/`, so a
refusal leaves both the clone and the remote untouched.

`scripts/loadPalette.mjs` stages `src/lib/<entry>.ts` for use from plain Node. Every
module it is asked to load must be alias-free (`./x`, never `@/x`), and dependencies
must be listed before the modules that import them.

The concurrency check runs *before* the workspace replaces the clone's `data/`, so a
refusal leaves both the clone and the remote untouched.

`scripts/loadPalette.mjs` stages `src/lib/<entry>.ts` for use from plain Node. Every
module it is asked to load must be alias-free (`./x`, never `@/x`), and dependencies
must be listed before the modules that import them.

### Garmin write path (coaching sync)

**The sync state is the only thing that authorises a mutation.** A Garmin workout absent
from it was created by someone else — by hand, by Garmin Suggested Workouts, by another
service — and is never touched. It holds Garmin ids for one athlete, so it lives in that
athlete's private workspace (`RUNOMICS_DATA_DIR`), never in this repository.

- `scheduled` is the only complete state. `workout_created` records a create that
  succeeded while its scheduling failed; it exists so the next run retries the schedule
  against the workout already on Garmin instead of creating a second copy.
- State is returned after **every** operation, including a failed one, for the same reason.
- The content hash covers the Garmin payload and the scheduled date — what was pushed,
  not what the coach wrote. A prescription edit that changes neither (a provenance field,
  a revision bump) leaves Garmin alone.
- Only future `prescribed`/`adjusted` sessions are syncable, and the window never reaches
  back before today, so a sync can never rewrite Garmin history. Past entries are never
  deletion candidates either.
- `keep` and `skip` both leave Garmin untouched but mean opposite things — `keep` is
  already synchronised and unchanged, `skip` is deliberately excluded — and stay distinct
  so a preview says which of the two a missing write was.
- The plan computation is pure: no I/O, Garmin reached only through the operations
  returned, so a preview and the apply that follows compute the same plan.
- After the writes, Garmin is read back: every workout the run claims to have created
  must exist, on the date it was scheduled for.
- `GarminWorkoutGateway` deliberately exposes no bulk or list-wide operation — every
  mutation names exactly one workout or one calendar entry.

**Payload mapping quirks.** Garmin stores a pace target as speed in m/s, so the conversion
inverts: the *faster* bound of a `paceSecPerKm` range (the smaller number of seconds)
becomes the *higher* speed. Garmin orders the pair low-to-high, so the slower pace lands
in `targetValueOne` and the faster in `targetValueTwo`. Garmin has no dedicated strides
step, so strides ride on `interval`, which preserves their repetition count, duration and
form cues where the plain `other` bucket would lose them. One target per step: a
prescription carrying both pace and heart rate keeps pace as the executed target and
preserves the HR bound in the step description. A segment with no pace and no HR target
maps to Garmin's explicit `no.target`, never to an invented range. Garmin's estimates are
only ever the prescription's own totals — an absent total stays absent and Garmin computes
its own.

**Races are never pushed as structured workouts.** The race is already on the Garmin
calendar as an event (RunOmics reads those events from Garmin in the first place), so a
workout on the same date would only duplicate it. A **course-aware** race has a second
reason: it is paced on the watch by the athlete's own PacePro strategy, so its race effort
must reach Garmin with no pace target — a structured range over the same kilometres would
compete with PacePro rather than support it. Only the full-distance effort is stripped;
warmup and cooldown keep their easy ranges, which PacePro does not cover. The coach
normally strips that target already; the check at the Garmin boundary is the guarantee, so
no future plan revision can push a constant race pace onto a PacePro course by accident.

**`PythonGarminGateway` does not authenticate.** The authenticated Garmin session lives in
Python (`scripts/garmin/client.py`, the one the whole sync pipeline already uses), so the
gateway runs `scripts/garmin/sync_bridge.py` as a long-lived child and speaks
newline-delimited JSON to it. `GARMIN_SECRET` is inherited by the child from the
environment and is never read, logged, or passed on the command line.

Isolation guards keep shared code free of one athlete's ids: nothing under `src/` or
`scripts/` may name a real Garmin workout, schedule entry, or coaching plan, and no
default may point the mapping file at this repository.

### Coaching model

**The macrocycle is the whole journey toward the primary target race.** Rolling adaptive
blocks live inside it: a new block moves `block.startDate` forward, but the journey — and
so "week X of Y" — carries on from where training toward that target actually began. A
macrocycle is restarted only when the primary target itself changes. `macrocycleStartDate`
is carried across replans and kept on the *state* as well as the plan, because a plan is
replaced whenever a new block is generated. It is absent on plans written before the field
existed; readers fall back to the current block's start.

The four macrocycle phases (base 45% / build 35% / peak / race week) are configured at
macrocycle level and are deliberately **not** read from the rolling block's `TrainingWeek`
entries: a week's focus describes that one generated week, while these phases span the
whole journey.

**Plan weeks are Monday to Sunday, with a short first week.** A block starts on
`planningStartDate` — the reference date, or the day after when a race was completed that day
— which is whatever weekday the athlete happened to bootstrap on. Laying weeks out as seven
days from there gave the plan its own private calendar: a block bootstrapped the day after a
Saturday race ran Sunday to Saturday, so a Sunday long run landed in the *next* plan week
while the app, whose `startOfWeek` and `isoWeekNumber` are both ISO, showed it as the last day
of the current one. Every plan week then straddled two weeks of the planner it is rendered in.

`isoWeekWindows()` lays the block out instead: the first window runs from the planning start
to the coming Sunday, every later one is a full Monday-to-Sunday week, and the last is clipped
at the horizon, which is usually a race date. The 28-day horizon is unchanged — a mid-week
start simply adds a short lead-in, so a block spans four windows when it starts on a Monday
and five otherwise, which is why the bootstrap schema, its parser and `parseCoachingPlan` all
cap weeks at `MAX_BOOTSTRAP_WEEKS`. The windows are handed to the model as explicit
startDate/endDate pairs rather than a count, and the boundaries it returns are checked against
them, because a week count alone is exactly what let the old private calendar through.

A planning start that is itself a Sunday gets a one-day first week. That is deliberate: it
keeps the post-race recovery day that motivated the `planningStartDate` shift without bending
the calendar for every week after it.

**Week numbering counts windows, not elapsed days.** `weekWindowIndex()` finds a week by its
start date in the block's own layout; dividing days-since-block-start by seven silently
mis-numbers every week once the first one is short.

**Two drafts that compare equal ignoring identity and lifecycle fields are the same
prescription restated**, so the stored one keeps its id, revision and provenance rather
than being bumped as if the athlete had been given something new.

**Derived session numbers never guess.** A value is either computed from what the
prescription actually states or it is not shown. A segment's duration is stated outright or
implied by a distance at a stated pace (its midpoint); a distance with no pace is neither.
One segment that can be neither timed nor paced makes the total a guess, so no duration is
offered at all. `estimated` is true as soon as any part came from distance and pace, and
the UI marks such a value with `~`. Only the bookends may be left open: a warm-up given as
"2 km" is run at whatever pace the rest of the session leaves it, and `bookends()` splits
that remainder exactly the way it does for a parsed Garmin session — one shared rule, not
two that drift.

**Garmin sync status is silent when healthy.** Coach workouts are expected to reach
Garmin, so only a state the athlete must act on earns a line on the Plan page: today that
means Garmin holding a session that no longer matches the prescription. The full sync state
is still kept for idempotency and diagnostics.

### Official race results

**A certified result and a Garmin activity are two different measurements of the same
effort, and the certified one is the performance.** `data/race_results.json` is an optional
hand-maintained overlay keyed by `activityId`; the activity JSON stays exactly as the device
recorded it. Race courses are measured along the shortest legal line, so GPS almost always
over-reads them: Escher recorded 5.25 km in 21:50 for a certified 5.00 km in 21:32. Deriving
a time from that over-read — rescaling GPS distance against device time — invents a race the
athlete never ran, so nothing does it. Precedence is resolved in `resolvePerformance` before
any prompt is built, never left to the model: the coaching context carries the resolved
`performance` alongside the untouched `garminMeasured`, because load, HR and training effect
still come from the device. Without an overlay entry an activity resolves to its Garmin
figures and behaves exactly as it did before.

**The overlay also decides which times may claim a record.** A device best effort is a
rolling window over an over-read track, so on a certified course it reports a split the
athlete did not run: Escher banked a 5k best effort of 1237.6 s against a standing 20:38 PB.
Both round to 1238, `getAllActivities` returns newest first, and a stable sort therefore put
the newer activity at rank 1 — a PR badge for a race actually run in 21:32. The guard in
`getQualifiedEffortsByActivityId` only skips the record holder's own entry, so it could not
catch this. `creditedEffortSeconds` now credits an activity with its certified time whenever
an official result matches the effort distance, which removes the tie at its source. Ranking is
otherwise left alone on purpose: a device best effort that no certified result contradicts
is a real effort, so a training run may legitimately hold rank 1 over a slower race PB. What
an official PB does not do is lend its badge to a device number, because the Best Efforts
card takes its time from `bestEfforts` and its badge from the qualified efforts: pinning
rank 1 to the holding activity rendered the certified 20:42 record as `5K 20:38 · PR`. An
official record is therefore represented on the Official Result card, beside the time it was
actually set with, and the holding activity earns no device badge for that distance. The
raw device best efforts still render on the activity page as a device statistic; only the
credited seconds change. A placing is stored with the field size it came from, because 28th
of 188 and 982nd of 11036 are not the same result; `topPercentile` rounds the pair up so the
displayed share of the field is never better than the one actually finished.

**The run verdict reads the certified result too.** `effortStanding` compared device best
efforts directly, so Escher's over-read 20:37.6 outranked the standing 20:42 and the card
announced a benchmark for a race run in 21:32. It now credits the same `creditedEffortSeconds`
the records path uses — one resolver, in the domain, rather than a second precedence rule — and
the verdict facts carry the resolved performance, so the prompt states 5.00 km in 21:32 at
4:18/km with its placing. The certified fields only enter the facts when an official result
exists, which keeps the hash of every ordinary run byte-identical: adding the overlay
invalidates the races it describes and nothing else. A corrected chip time or placing moves the
hash again, so a verdict written from a superseded result stops being served.

**Race laps are not intervals.** `sessionExecution` reads `interval_active` splits and
describes repetitions, so a race of plain auto-lap splits resolved to `null` and the coach
never saw the pacing. `raceExecution` reads the real `lap` splits instead and reports the
progression and its trend, computed here rather than left to the model to derive from an
array. Laps shorter than a full lap are reported separately: a closing part-lap has a
per-km pace but comparing it with a full kilometre would read as a collapse that never
happened.

### The Plan's single workout shape

The Plan has exactly one workout presentation (`PlannedWorkoutRow` and
`PlannedWorkoutSheet`) and it must not care where a session came from. A Garmin planned
workout, a coach prescription, and a coach prescription already synchronised to Garmin are
the same thing to an athlete looking at their week, so all three are normalised through
`planWorkoutView` and rendered identically.

The coach stays the source of truth for what was prescribed; Garmin stays sync and
read-back data that can *enrich* it — a time of day it was scheduled at, or an alert when
the two have drifted apart. Neither owns a view. Where coaching has a session for a day,
the Garmin planned workout is not a second row: it is the same session read back. That
pairing is only unambiguous when the day holds a single prescription.

A single continuous block returns no structure bar — the row and the sheet's chips already
state its distance, duration and pace, and one full-height bar repeating them is noise.

**How a week gets named**, in order: a week that is over *and* rated by the watch takes
Garmin's own verdict outright (a reading of what happened beats any intent, and updates the
moment Garmin revises it); a week not over yet but covered by a Garmin Coach plan takes the
plan's phase name (a fact from Garmin, not a guess); a week not over with no known phase
falls back to a plain "this/upcoming week", because judging a week on the load logged so far
always reads low against a full 8-week typical and would fabricate a "recovery week"; a week
over, unrated and phaseless takes our TRIMP load level. Nothing invents a mesocycle position
("3 of 4") — only what Garmin itself states.

Where a boundary falls mid-week, the phase or status covering the most days wins, ties going
to the one the week ends on, since that is the reading still standing. Days the watch
declined to rate are left out.

### Training metrics

- **Distance totals round once.** `sumDistanceKm` rounds the sum, not the parts — this is
  what keeps Progress, Goals and Analytics from disagreeing by a kilometre.
- **Easy/hard split** has one implementation, accepting anything carrying `hrZones`
  (`Activity` or the lighter `ActivitySummary`), so Today, Plan and Activities cannot diverge.
- **Plan progress is counted the way Garmin Connect counts it**: whole calendar weeks over
  the plan's own start-to-end span. It deliberately does not measure the phase ranges (Garmin
  publishes phases only from BUILD onward, so the base weeks that open a plan are absent and
  the count would start weeks late), and does not divide a day span by 7 (a plan starting
  mid-week belongs to the week it falls in, so both ends snap to their Monday). Null when
  there is no dated plan.
- **Aerobic decoupling (Pa:HR)** returns null whenever the number would mislead: interval
  sessions where pace is meant to swing, runs too short to drift, or too few clean samples.
- **Riegel predictions** are damped by VO₂max trend, but only *half* the VO₂max change is
  reflected — VO₂max is not perfectly linear with race time. The reference point is found by
  date, not by counting entries back: the series is sampled monthly and a sample is missing
  for any month with no reading, so its index says nothing about how long ago it was.
- **Load risk.** Foster monotony = mean(daily load, 7d) / stdev(daily load, 7d), null when
  undefined. Strain has no direction of its own and inherits the worse of ACWR/monotony.
  Garmin's own verdict on its ratio beats re-testing the number against our generic
  thresholds, because the watch grades against a band it personalises per athlete;
  unrecognised phrasing falls back to ours.
- **Load balance gauges** are each anchored on their own target band (the middle half,
  25–75). The buckets differ by an order of magnitude, so a shared axis would squash the
  small ones flat; anchoring per gauge makes "inside the range" mean the same visual thing
  across all three. Outside the band the value compresses asymptotically, so an extreme
  reading pins near the end rather than running off it.
- **Taper projections hold today's load flat.** That is an assumption, not a plan, and the
  UI has to say so — the honest answer to "what will my form be" depends on training that
  has not happened yet.
- **`typePaceZone` omits Sprint, Anaerobic and Race** on purpose: those efforts are
  prescribed per-interval or by the race itself, and quoting a single steady range for them
  would be wrong rather than merely vague.
- **Route similarity uses coverage of the smaller trace, not Jaccard**: the same loop with an
  extra out-and-back tacked on is still the same route, and Jaccard would score it as a
  different one.
- **Run verdicts look strictly backwards**, so a verdict stays true forever: a faster run next
  month cannot turn today's copy into a lie, and the cached insight never has to be redone.
- **Alert use-cases return `[]` on their first call** (`GetNewPrs`, `GetNewActivities`,
  `GetShoeWearAlerts`, `GetOverreachingAlerts`, `GetStaleSyncAlert`) — there is nothing to
  compare against yet, so the first call only bootstraps the stored state.
- **`QueryActivities` maps down to `ActivitySummary`** so neither the SSR page nor the
  paginated API response ever ships per-sample arrays to the client. `activitySummary()` drops
  the route, sample and split arrays that make up most of an activity's weight; anything
  crossing the server/client boundary for a list row or card should go through it first.
- **`raceDistances` lives in the domain**, not beside its use case, because the charts need
  the kilometre table at render time and importing it from the use case would drag the
  `fs`-backed repository into the client bundle.

### Garmin-sourced series

Several repositories exist only to read what the Python sync writes, and each carries a
caveat worth knowing:

- **Athlete history** entries exist only for days a value actually moved — a change log, not
  a daily reading. Same for **threshold history**, where either field can be absent from a day.
- **Training status**: days before the watch had enough history come back as `no_status` with
  no ratio. They are not a reading, and returning one would make the app show a status Garmin
  itself declined to give.
- **VO₂max history** is Garmin's own series and keeps the decimal the per-activity readings
  round away — the difference between a trend line and a staircase. The per-activity readings
  are the fallback until `vo2max_history.json` has been synced. The four-week daily view is
  anchored on the freshest sample rather than on today, so a lagging sync does not empty the
  chart.
- **Garmin race predictions** are a daily Firstbeat series recomputed from VO₂max and recent
  training — "is my race potential moving?" — distinct from `GetRacePredictions`, which derives
  a single current estimate per distance from our records via Riegel. They are charted as
  pace, not finish time, so all four distances share one readable axis; a marathon estimate is
  eight times a 5 km one and would flatten the short distances into a line.
- **Training load balance** target bounds are personalised by the watch from the athlete's own
  history; there is no local equivalent.
- **Garmin Coach plans** publish no base phase, so the plan's own first day is earlier than
  its first phase (which starts at BUILD).
- **Weather** on an activity is Open-Meteo conditions at the middle of the run, distinct from
  `avgTemperature`, which is what the watch's wrist sensor read.
- **Planned-workout times of day are coarse only** — the exact scheduled minute of a future run
  is never persisted or served.
- **Splits** come from two different FIT messages. A structured workout carries `split_mesgs`
  with the interval types (`interval_warmup`/`interval_active`/`interval_rest`/
  `interval_recovery`/`interval_cooldown`), and those stay the primary source, each interval
  keeping its own `lap_mesgs` as expandable sub-laps. An ordinary run or a race has no interval
  splits at all, only `lap_mesgs` — the watch's own kilometre (or manual) laps — so those become
  splits of type `lap`, with no sub-laps. Nothing is ever synthesised from GPS samples: a lap
  with no duration or no distance is dropped, and a single lap is only the activity total
  restated, so it is not a split either. Lap splits are execution data for display only; they
  never feed activity-type inference, session-execution analysis, or an official race distance.

### AI insight generation

**The adaptive coach bills its own Google project.** It reads `GEMINI_COACH_API_KEY`
and never falls back to `GEMINI_API_KEY`: a fallback would silently spend the general AI
surfaces' free-tier quota on a coaching generation, merging two quotas that are kept apart
on purpose. The key is therefore *passed into* the shared transport rather than read from
the environment by it — a transport that picked its own key would quietly merge them again.
Credential resolution stays with each adapter, alongside its domain-specific validation.
There is no fallback in either direction: neither key ever stands in for the other.

**Where each key has to exist** follows from where its code runs:

| | `GEMINI_API_KEY` | `GEMINI_COACH_API_KEY` |
|---|---|---|
| What it powers | The deployed AI surfaces — Today, Week Purpose, Season, Analytics, run verdicts, PB celebration, shoe verdicts | The adaptive coaching CLI (`npm run coach`), which runs locally today |
| `.env.local` | yes | yes |
| Vercel | **yes** — the surfaces are server-rendered and the cron routes call Gemini | **no** — nothing deployed calls the coach |
| GitHub Actions | not directly: the workflows only `curl` the deployed `/api/internal/*` routes, which use the deployment's own key | **no** — no workflow runs a coaching generation |

The coach stays local on purpose for now: its output is reviewed before anything is applied.
Add `GEMINI_COACH_API_KEY` to Vercel only if a server-side coaching route ever ships, and to
GitHub Actions only if a workflow ever automates a coaching generation. Until then it would
be an unused secret in two more places.

**Every surface goes through one budget gate,** so none can bypass it. Spend is reserved
*before* the request and counted whatever the outcome: a 429, a timeout and a rejected
candidate all consume the same quota as a usable answer, so counting successes only would
drift under real usage. The ledger lives in Firestore and survives across cron runs — the
daily ceiling is shared by every invocation, not by every process.

**Timing.** The invocation is capped at 300s (`maxDuration`; Hobby plan with Fluid Compute,
confirmed on this deployment 2026-08-05). `RUN_BUDGET_MS` is 280s of that — the whole
invocation's wall clock, with the remaining 20s covering cold start and the final response
write. `CALL_COST_MS` (a call's own timeout plus the Firestore write) is held back from the
budget so the deadline is checked against the whole cost of a call, not just the pacing wait
before it; otherwise a call reserved just inside the ceiling runs past it, Vercel kills the
invocation, and the partial result the caller had already earned becomes a 504.

`CALL_TIMEOUT_MS` is 30s. Gemini 3.x cannot turn thinking off (2.5's `thinkingBudget: 0` does
not apply to this family), `'low'` is the floor, and it still spends real tokens on a
schema-constrained answer: a French one measured 23s live at 360 thinking tokens, where 15s
was aborting calls that would have succeeded seconds later.

**A transient failure moves to the next model, not the next surface.** 429 and 404 mean that
model is done for the day, and the pool exists so the work can continue — but the loop used to
abandon the item and carry that recovery only as far as the *next* item's `reserve()`. With one
verdict pending, a single Google-side 503 therefore wasted an entire pass; two passes in a row
went that way before a run verdict finally landed. `generateFromPool()` now retries the same
request on a different pool member, up to three attempts, for anything transient (500, 503) or
closed (429, 404). Copy the validator rejected is not retried: that is the documented
reject-and-requeue path, and spending a second model on it would buy nothing. Failing to
reserve at all is reported separately from a model failing, because only the former means the
caller should stop looping.

**Model pool.** A model answering 429 has spent its day; one answering 404 has been retired
out from under us. Both mean stop asking and take the next in the pool. `reserve()` returning
null is ambiguous on its own — spent for the day, or out of this invocation's clock — so the
daily ledger is read back to let a stuck verdict name which. `GEMINI_MODEL` replaces the
*pool*, not the request, so what gets counted stays what gets called; overriding at the
transport layer would bill one model's ledger for another's call.

**Two pools, sized from the demand.** Free-tier quotas are per model, and Flash and Flash Lite
are not in the same league: Flash allows 20 requests a day, Lite 500. `MODEL_POOL` carries the
surfaces a reader actually looks at — `today`, the week purpose, the season headline, the four
analytics tabs, a PB celebration, a shoe verdict or two, and the verdicts for runs that just
landed — which is about 8 calls a night and 14 at its worst. The five passes per night do not
multiply that: once a surface's hash matches, the pass reports `unchanged` and spends nothing.
Three Flash models give it 54, so it still runs at 2.6x its worst night after one of them is
retired out from under us.

`BACKFILL_POOL` carries the per-activity verdict queue, whose demand is not the one run a day
but the whole eligible history at once: any change to `runHistory` or the verdict facts moves
every hash, and the 90-day horizon plus the record holders is around 100 verdicts. Two Lite
models give it 996. What actually caps a pass there is the invocation clock rather than the
quota — `reserve()` stops handing out models 33s before the 280s ceiling, and at Lite's 5s
spacing that is roughly 24 verdicts, which is what `DEFAULT_RUN_VERDICTS_PER_RUN` is set to.
Five passes clear the 100 with room to spare. The pools share one ledger and one spender, so a
verdict backfill can never starve the dashboard even when it is churning through a rebuild.

**Ordering.** Verdicts for runs that just landed are written before any other surface — behind
the other ten, the one insight the athlete is waiting for is the first thing the quota or the
clock drops. The rest is priority order, tail last, since what one run cuts off the next picks
up. `?limit=0` reports the backlog without spending; an *absent* `?limit=` must not collapse
into that, because the cron and every `workflow_dispatch` omit the param and `Number(null)` is
0 — hence the explicit null check before any numeric conversion. `?all=1` lifts the recency
horizon for a manual pass over the archive after a reprocess; the daily cron never sends it.

**Variety is a prompt problem, not a model problem.** A run verdict has several angles open to
it — how the effort held together, the comparison against past runs of the same type, the
conditions, what the plan asked for. The baseline comparison used to be ranked above all of
them, and since `baselineLine()` is supplied for any run with three same-type peers inside 90
days, it was supplied essentially always: a block of similar easy runs collapsed onto one
sentence, "Xs/km quicker at the same heart rate", however the copy was worded. The instruction
now lists the angles and tells the model to pick what this run makes the most of instead of
defaulting to the one that is always there.

`avoidClause()` is the other half, and it is fed the previous *verdicts* — headline and body
both — not the headlines alone. Headlines were already varied while the bodies underneath them
repeated, which is what an avoid list over headlines cannot see.

**A repeat is rejected, not requested.** The avoid list is an instruction, and a Flash Lite
model under schema-constrained output does not reliably follow it: two verdicts in one batch
came back under the identical headline, the second having been shown the first in full. So
`repeatsEarlierVerdict()` compares the candidate against what this request already wrote — on
a key that ignores casing, surrounding space and end punctuation — and a match is pushed to
`failures` before anything is saved, which leaves the run in the queue for the next pass exactly
as an over-length headline does. The check is on the headline alone: that is the repeat actually
observed, and matching bodies by substring would reject copy that merely shares a clause.

**The phrasing history is one shared document, not per activity.** `written` only accumulates
across the two `writeVerdicts()` passes of a single request, so on its own it let a backfill
spread over the night's five passes repeat itself between them. The per-activity
`recentHeadlines` cannot close that: each run owns its own document, and `writeVerdicts()`
passes `previous = null`, so every verdict's document holds nothing but its own headline.
`verdictPhrasing_<locale>` holds the last ten verdicts instead, read once at the top of a
request and written back after both batches, so the avoid list and the duplicate check both
span passes and nights. Entries that are not a headline and a body are dropped on read rather
than fed to a prompt, and every failure path returns an empty history: a missing document, an
unconfigured project, a read that throws or times out. Variety is worth a Firestore read, never
a failed generation.

**Staleness and the grace window.** An insight is keyed on every fact it was written from, and
some of those move on their own overnight (days since the last run, the rolling week, Garmin's
nightly race predictions). On exact-match reads alone the copy would blank itself at midnight
and stay blank all day whenever a generation pass failed. So a stale insight is still served
for 48h — *provided* its **guard** still holds. The guard hashes the facts the copy is rendered
*beside* and must never contradict:

- **Today's hero**: the tone badge and the "session done" checkbox. A `go` line under a red
  badge, or "that was the window to use it" before the athlete has run, contradicts the card
  around it.
- **Season headline**: the bullet tones in order. Copy can outlive a drifted figure, but not a
  list that changed shape or flipped sign under it — that pairs "you are gaining" with a caution
  colour, or drops a bullet off the end.
- **Shoe verdict**: the wear status. A pair drifting a few km deeper into the same status reads
  the same; one that has crossed into "replace" cannot keep yesterday's "they have a block left
  in them" under a red badge.

A document written before its surface had a guard cannot be checked and is not served; the next
generation stores one and it heals itself.

**One document per read, never a collection scan.** A static build pre-renders a few hundred
pages, and each reads the one document its surface owns. Batching them behind a module-level
promise looked cheaper and was not: `next build` generates pages across several worker
processes, each with its own module instance, so the "read every document once" promise was
kept once *per worker per build* — and Query Insights recorded 163 executions of an unbounded
`collection("aiInsights").get()`, about 360 documents each, roughly 59k reads against a 50k/day
free tier. A direct `doc(id).get()` costs one read per page instead of the whole collection per
worker, and correctness no longer depends on memory being shared by processes that do not share
it. `listCachedHashes` needs the hash rather than mere presence — an entry written from facts
that have since changed is one the pages already ignore, so the backfill must pick it up again
rather than skip it forever — and scopes itself to a document-ID range over the surface prefix,
since document IDs are `<surface>_<locale>` and already indexed. The locale sits at the end, so
the range covers every locale's copy of a surface; with one locale configured that is the same
set of documents.

**Revalidation.** Pages rendering these surfaces are static (ISR, `revalidate = 3600`) and built
at deploy time — before this route ever runs, since the deploy must be live before the sync
workflow calls it. Left alone, a fresh insight would sit correct in Firestore for up to an hour
while every page served the pre-generation snapshot; revalidating on a successful write is what
makes it appear on the next request.

**Output validation rejects rather than repairs** — a rejected candidate just stays in the
backfill queue for the next pass. Some models drop French typography under constrained JSON
output (seen from `gemini-3.5-flash-lite`). A dropped elision ("L effort" for "L'effort") is
unambiguous, since those function words always contract before a vowel. Accent restoration is
not — "seance"/"séance" cannot be told apart by regex — but French of any length virtually
always contains an accented letter, so a total absence past 40 characters is a strong signal
the model dropped diacritics.

Failures are reported, never swallowed: this runs unattended from a GitHub Actions cron, where
a silent null looks identical whether the quota ran out, the model was retired, or the copy came
back too long. The same reasoning covers `/api/internal/*` generally — every throw is logged with
the route name and returned as a 500 the workflow run can surface, and the guard rate-limits
*before* checking the shared secret so failed auth attempts are throttled too.

Thinking models put reasoning parts alongside the answer and not always last, so the response
parser takes the first part that actually carries text.

Insight surfaces are keyed per **analytics tab**, not per chart: one paragraph per theme is four
cached documents, where one per chart and window would be dozens regenerated on every sync. Run
verdicts are gated by `deservesVerdict` — generating one for every run ever synced spends the
day's quota on pages nobody opens. A run that already has a cached verdict keeps it either way.

### Charts and windowing

**Every windowed chart shares one point budget** — 12 points for a year, 6 for six months, one
per week for four weeks — so they all read at the same density as the Fitness group's load chart.
`sampleForRange` groups into equal index-buckets and averages each numeric field; non-numeric
fields (date, label, status) come from the bucket's last point so ticks and tooltips stay
meaningful. `decimals` defaults to 2 because the same series carry whole-number loads (CTL ~50)
and small fractional ones (stride length ~1.2 m, efficiency ~0.95), and rounding everything to an
integer would flatten the fractional ones. Charts that aggregate the whole window rather than
plotting it (the zone donut) opt out with `sample={false}`.

**Axis labels.** A phone-width chart card carries about six labels before they collide: the plot
is ~270px inside the card and a short month label ("juil.") is ~30px at the 11px tick size. For
wide windows, ticks are placed on **month starts** — spacing them evenly through the array lands
them on whatever week happens to fall there, giving "4 Aug · 29 Sep · 24 Nov", dates that mark
nothing and cannot be scanned as a calendar. `windowDateAxis` blanks the non-tick labels rather
than letting Recharts thin the categories, which is why `interval={0}` is needed on the dense
weekly chart: left to its own interval Recharts picks a subset of the 52 points first, and a year
window can land on nothing but blanked ones.

**Weeks with no running are absent from a weekly series**, so a categorical axis draws a
three-week break as a single step and the curve joins across it as if training never stopped.
`fillWeeklyGaps` inserts explicit blank weeks — for a volume chart a week at 0 km is a reading,
not a missing value, and usually the most informative one on the chart. Only the interior is
filled: before the first week there is no history to claim, and after the last there is nothing
recorded yet.

Other chart decisions worth keeping:

- The last point of a weekly volume curve is a week still being run, so the dip into it is not a
  real drop and is marked as "so far" rather than left to imply a finished week.
- The average line is deliberately unlabelled: an inline "avg 41 km" sits exactly where the most
  recent weeks are and collides with the curve on a phone. The footnote names the line and the
  reading gives the number.
- `WeeklyVolumeChart` needs a wider right margin than its siblings — their ticks are three-letter
  months, its are "27 juil." on the window's last point, half of which hangs off the card at 4w.
- HR trend uses the easy/hard pair (`hrEasy` red300 / `hr` red500) rather than two reds, which
  were indistinguishable in dark mode. Lower easy-run HR for the same effort reads as improving
  fitness, so "down" is positive there.
- The training-status ribbon gives segments narrower than a few percent a sliver of width, so a
  one-day flip into overreaching stays visible instead of collapsing to nothing.
- `trendDots` marks every point: at 4–12 values per window each reading is worth marking, and a
  bare line hides where the actual measurements are.
- **`ChartFigure` is required for accessibility.** Recharts renders plain SVG with no semantics,
  so a screen reader announces nothing or reads scattered tick/tooltip nodes piecemeal. It exposes
  the chart as a single `img`-role element with one summarising sentence (the WCAG text-alternative
  pattern) and hides the SVG itself from assistive tech.

### Colour system

`lib/palette` is the one place raw hex literals may exist. `lib/themeTokens` holds anything a
stylesheet can reach, so it stays accent- and theme-aware; `lib/colors` holds the semantic sets
CSS cannot reach — Recharts and inline SVG (which need real strings in attributes), MapLibre paint
properties, and the share-card canvas.

**What follows the accent picker and what does not.** Form (TSB), weekly volume and the long-run
bar come from `useAccentUiColor()` — they are the "this is your headline number" marks. Everything
in `CHART_COLORS` is categorical or semantic and stays put. Readiness tone, pace-route, heat-route
and temperature ramps are all deliberately accent-independent: how often a stretch was run, or how
hot it was, is a property of the data, not a theme choice, so the map must not repaint when the
accent changes. Brand tints (season headline, race footer) stay emerald so they remain the brand's
voice rather than the athlete's chosen tint.

- `useAccentUiColor()` is for marks that must repaint with accent-coloured chrome around them.
  `useAccentChartColor()` is its multi-series variant: red-adjacent accents that would collide with
  Fitness/Fatigue/HR fall back to brand emerald. The picker's own swatch hue is neither.
- Three HR-zone ramps exist because they answer different questions against different backdrops.
  Z4 orange500 and Z5 red500 collapse into one hue at donut-slice size on the near-black canvas, so
  the dark ramp lifts them apart. The Athlete card's headline zones sit a step more saturated
  because they are small text on a near-opaque tile rather than filled chart marks.
- Training *status* and training *plan phase* have separate ramps on purpose: one is a reading of
  what happened, the other is intent.
- `BOOT_COLORS` serves surfaces that render before, or entirely without, `globals.css` — the PWA
  launch screens and the root error boundary — so they carry their own deep-navy scheme.
- The iOS `theme-color` meta tag and `accent.ts` read `PAGE_BACKGROUNDS` from `themeTokens`, the
  same table `globals.css` was generated from, so the status bar can never drift from the canvas.
- `statusColors` is for statuses with universal meaning (success, in-progress, pending, warning,
  danger). Accent-coloured elements — nav, CTAs, progress bars — stay in accent.
- Elevation uses `roRust` rather than stone-500, which read as grey in the categorical set.

### Maps

**The heat layer counts frequency per grid cell but renders the original, unsnapped GPS trace,**
so the line follows the real road instead of zig-zagging between grid nodes, matching the
single-activity map. A route splits into a new feature only where it crosses into a cell with a
different count, so colour and width follow real density instead of alternating between overlapping
"rare" and "frequent" copies of the same street. Counting dedups within a route first, so a slow,
densely-sampled stretch of one run cannot inflate its own count. The grid is shared with route
matching (similar runs, personal segments) so "same street" means the same thing everywhere — it
only bins, and never moves a coordinate.

Breakpoints are spaced **geometrically** (a log scale). Run frequency is heavily right-skewed — a
handful of home streets are run 100+ times while most stretches are run once or twice — so a linear
scale would pin almost everything at the cool end.

World-view bubbles scale radius with `sqrt(count)`, because humans read bubble charts by **area**: a
zone with 4× the runs should look 4× the weight, not 4× the diameter. A floor keeps single-route
zones tappable, and markers are added smallest-first so busier zones stack on top instead of being
buried under one-off bubbles.

### Share card

The canvas cannot read CSS variables, so the card names its own surfaces. It is painted in three
inks: the athlete's accent (passed as an r/g/b triple, since it can be a custom colour the palette
never sees) plus `paper` and `ink` for the white and black washes that build the glass. Alphas stay
inline at the call site — they are composition, not colour.

- The start dot is always green; the finish dot is the accent, unless the accent sits within a
  distance of 90 in RGB space of the green start, where it flips to red — the start/finish convention
  Strava and Garmin use.
**MapLibre's worker is served from `public/`, not from the bundle.** MapLibre 6 is ESM-only and
no longer inlines its web worker: it spawns `maplibre-gl-worker.mjs` as a module worker, resolving
that name against `import.meta.url`. Bundled into a Turbopack chunk, that resolves to a path under
`/_next/static/` which the bundler never emits, Next answers with its HTML 404 page, and the worker
dies on strict MIME checking - leaving a map container with no canvas and no error anyone would
connect to the map. So `npm run maplibre:worker` copies `maplibre-gl-worker.mjs` and the
`maplibre-gl-shared.mjs` it imports out of `node_modules` into `public/maplibre/` (a `prebuild`,
`predev` and `e2e:build` step, so they cannot drift from the installed version, and gitignored
because they are build output), and `loadMapLibre()` in `lib/maplibre` points `setWorkerUrl()` at
them. Every map goes through that one loader so the worker URL is set exactly once, before the
first `Map` is constructed.

The cost is a second copy of the shared module - the main thread has its own inside the bundle -
which is what an ESM-only library spawning a module worker requires.

**A map that cannot render is invisible to the test suite.** `.env.e2e` carries no
`NEXT_PUBLIC_MAPTILER_TOKEN`, and both map components return before constructing a `Map` without
one, so nothing in the E2E run ever instantiated MapLibre; the map specs assert the page shell
because the shell is all they could reach. That is how the worker breakage above shipped. The
canvas spec in `map.spec.ts` closes it: given a token it waits for the worker request, the style
request and an attached `canvas.maplibregl-canvas`, and it skips when no token is set, so CI
behaves as before until a token is added as a secret.

- Only the **basemap** is rendered through MapLibre; the trace is painted on afterwards in the
  athlete's accent. That is what makes changing accent free — the cached render does not depend on it.
- Before the basemap arrives, `projectRoute` frames the trace the way MapLibre's `fitBounds` will, so
  the trace barely moves when the map lands; afterwards `map.project()` is used, which is exact by
  construction. The `route` design opens up top and bottom padding so the trace sits between the title
  and the stats panel rather than running full-bleed under both; square thumbnails stay symmetric.
- Route thinning always keeps the last point so the finish marker stays put, and is deterministic so
  every caller thins alike.
- The light-mode accent needs a deeper tone to survive the pale backdrops, but not the same deepening
  `ACCENT_SWATCHES_LIGHT` applies: nature and silver sit one step brighter so the route line does not
  go muddy against the map design.
- Export is a 1080px-wide story frame — the resolution Instagram, Strava and Garmin expect.
- Clipboard copy must construct the `ClipboardItem` synchronously with a pending promise to keep
  Safari's user-gesture check.
- Reverse-geocode results are cached in `sessionStorage` so re-opening a card does not re-hit the
  geocoder. MapTiler sometimes resolves a cluster centre to a small commune or street rather than the
  town, and it expects an ISO 639-1 code where `t.locale` may be a fuller tag.

### Platform and browser workarounds

- **`useScrollLock`.** In a regular browser tab, plain `overflow: hidden` does not stop iOS Safari's
  touch-driven rubber-band scroll of the page underneath, and that residual scroll triggers the
  browser toolbar's show/hide animation — which drags every `position: fixed` element (the bottom tab
  bar) along with it. There, the body is pinned at its current scroll offset. In a standalone PWA there
  is no dynamic toolbar to fight, and pinning actively breaks layout: `top: -scrollY` + `bottom: 0`
  inflates the body taller than the viewport once scrolled, and portalled fixed sheets end up sized
  against that inflated box, leaving a gap under the sheet and shifting the tab bar (both intermittent,
  since they need `scrollY > 0`). A plain `overflow: hidden` lock, paired with the global
  `overscroll-behavior-y: none`, is enough there.
- **`FullscreenChromeContext`.** The global bottom tab bar and a fullscreen map overlay are both
  `position: fixed` siblings at different points in the tree. In practice — confirmed on-device and in
  headless Chromium — the tab bar can still paint and receive taps on top of a higher-z-index fullscreen
  overlay. Rather than fight that stacking behaviour, fullscreen views ask the tab bar to hide itself.
- **`fileExport`.** iOS PWAs in standalone mode have no downloads UI: a blob download either fails
  silently or opens an awkward preview, so the native share sheet is used there instead.
- **`useFocusTrap`** marks everything else on the page `inert` for the dialog's lifetime, cycles Tab
  within it, and restores focus on close. Attach the ref to the dialog panel, not the scrim.
- **`useDragToDismiss`** binds to the drag handle, not the whole sheet, so scrollable content keeps
  native scrolling. Past the threshold the sheet finishes sliding off under a real CSS transition
  before `onDismiss` fires, instead of vanishing when the finger lifts.
- **Service worker** registers in production only — a SW serving cached pages during development would
  mask live code changes. It also owns the update flow: a waiting version offers a banner, posts
  `SKIP_WAITING`, and reloads once the new worker takes control; otherwise users keep the old version
  until they close every tab.
- **`color-mix` alpha variants** are used for token tints (Safari 16.2+). Plan cells are
  foreground-tinted rather than a fixed white wash, so they stay visible in light mode instead of going
  white-on-white.
- **`GlassSurface`** should stay under roughly six blurred surfaces per viewport — `backdrop-filter` is
  GPU-costly. `Button`'s secondary variant deliberately omits `backdrop-filter` because those buttons are
  typically nested inside a glass card already.
- **Toast** renders at the top of the screen, below the notch, so it is never hidden behind the bottom
  tab bar.
- **`ActivityHeatmap`** cells are keyed on `themeVersion` so `color-mix` values remount and re-resolve on
  a theme or accent switch.

### Internationalisation

**`t.locale` must be passed explicitly to anything that formats.** `Intl` APIs and
`toLocaleDateString`/`toLocaleString` that resolve their own locale differ between server and browser:
Node takes its default from the machine's environment, the browser from the user's settings. A number
formatted through one renders "Projected 1 663 km" in prerendered HTML and "Projected 1,663 km" after
hydration, which React reports as a hydration mismatch and recovers from by throwing away the whole tree
and re-rendering on the client. `src/i18n/__tests__/localeIndependence.test.ts` guards this.

Locale parity is checked in both directions as `path:type`. The type is part of the key because shapes
must match too: a plain string where the other locale holds an interpolating function renders
"[object Object]" at the callsite. `satisfies Strings` only checks fr against en, so it says nothing
about keys fr carries that en has since dropped.

`formatRange` is used for week headers so the locale picks its own order and elision — fr reads
"6-12 juil." rather than the month-first "juil. 6 - 12" that hand-assembling the parts produced.

### Date handling

Two `YYYY-MM-DD` conventions coexist and must not be confused:

- `isoDate` in `lib/calendarDate` is **local time**, matching the `date` field stored on activities.
  It is the default.
- `utcDate` in `GetTrainingWorkbook` is **UTC**, because the workbook computes its dates from UTC
  timestamps throughout.

Coaching presentation does its date maths in UTC on purpose: a macrocycle spans a DST change, and
local-midnight arithmetic drifts a day either side of it. `isoWeekNumber` returns `isoYear * 100 + isoWeek`,
matching the sync pipeline's `week` field.

### Owner authorization

There is one authorization fact, the Firebase Auth custom claim `owner`, and both sides
read it:

- **Firestore** (`firestore.rules`) allows a write only on
  `request.auth.token.owner == true`.
- **The client** resolves the same claim through `useOwnerAuth` (`src/lib/useOwnerAuth.ts`),
  which `ActivityNotes` and `SettingsClient` both consume. It subscribes with
  `onIdTokenChanged` rather than `onAuthStateChanged`, so a token refresh that changes the
  claim is picked up, and it reads `getIdTokenResult()` without forcing a refresh — the
  callback only fires when there is a genuinely new token, so the cached one is always the
  current one.

`NEXT_PUBLIC_OWNER_EMAIL` is not part of that decision. It is provisioning input for
`npm run set-owner-claim`, which is what actually grants the claim. Comparing the email in
the browser was the previous UI gate and it drifted from the rules: an account whose email
matched but whose token carried no claim was shown the editor and then refused by Firestore
with a 403. An email is also not something the rules can read, and a claim survives an email
change, so the claim is the side that wins.

### Content Security Policy

`next.config.ts` sets the CSP for every route. Each allowance is deliberate, and the
comment-free header is easy to widen by accident — this is what each one is for:

- **`script-src 'unsafe-inline'`** — Next.js needs it for its bootstrap scripts on SSG
  pages, which have no per-request nonce. `'unsafe-eval'` is added **in development
  only**, for react-refresh.
- **`script-src https://www.gstatic.com`** — `firebase-messaging-sw.js` `importScripts`.
- **`script-src https://apis.google.com`** — the gapi loader (`api.js`) that
  `signInWithPopup` needs for its `postMessage` relay. Without it the popup opens but the
  sign-in promise never resolves. This header is also served on the service-worker route,
  so both origins must be allowed there too.
- **`img-src https://api.maptiler.com`** — map sprites and raster images. `data:`/`blob:`
  are for MapLibre and the share-card canvas.
- **`connect-src`** — `*.googleapis.com` for Firestore/Auth/FCM, `api.maptiler.com` for
  styles, tiles and geocoding, `nominatim.openstreetmap.org` for share-card reverse
  geocoding, and `apis.google.com` for the gapi loader above.
- **`worker-src blob:`** — MapLibre spawns blob workers.
- **`frame-src`** — the Firebase Auth sign-in iframe (`*.firebaseapp.com`), the Google
  account chooser (`accounts.google.com`), and gapi's own relay iframes.

`object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`
are lockdowns with no exceptions; keep them that way.

### Build configuration

The app version comes from `package.json` and is exposed as `NEXT_PUBLIC_APP_VERSION`, so
there is one source of truth for it.

`outputFileTracingIncludes` pulls `./data/**/*` into the server bundle explicitly. The
directory is read from the filesystem at request time (ISR revalidation, the API routes),
but its paths are built at runtime, so nothing links it into the traced module graph and
the deployment would otherwise ship without it.

`npm run analyze` opens a per-bundle treemap — worth checking when Recharts or MapLibre
creep upward.

ESLint's config re-declares `eslint-config-next`'s default ignores because overriding them
replaces the list wholesale. Beyond the defaults it skips `scripts/**` (Node utilities, not
part of the linted Next.js app) and `coverage/**`.

The two React hook rules are suppressed **per effect**, with a one-line
`eslint-disable-next-line` carrying its reason, never per file. A file-wide override also
exempts every hook written in that file later, which is exactly the code most worth
linting; the directive expires with the line it is attached to, and ESLint reports it as
an unused directive once the effect no longer needs it.

- **`react-hooks/set-state-in-effect`** — `ActivityListClient`, `AnalyticsClient` and
  `FirstLaunchHint` restore state from `localStorage`/`sessionStorage` once after mount. It
  has to be an effect rather than a state initializer: an initializer would differ from the
  server-rendered markup and trip a hydration mismatch. `ActivityListClient` additionally
  guards with a `hasRestored` ref and merges only into still-default values, so a restore
  can never clobber a user edit.
- **`react-hooks/exhaustive-deps`** — `AnalyticsClient` (one-time mount effect),
  `CelebrationOverlay`, `useMapRoutes` and `useShareCardMap` deliberately narrow their
  dependency arrays. These effects own imperative MapLibre/canvas resources whose teardown
  and rebuild is expensive; re-running them on every referenced value would recreate the map
  or the render on each parent render.

`ThemeToggle`, `AccentPicker` and `ThemeSegmented` needed no suppression at all: their
"have we hydrated yet?" flag is `useMounted` (`src/lib/useMounted.ts`), a
`useSyncExternalStore` whose server snapshot is `false` and whose client snapshot is `true`.
Same two-pass render as the `useEffect(() => setMounted(true))` it replaces — false through
the server render and the hydration render, true immediately after — but React's own idiom
for reading something outside React, so the rule has nothing to object to.

File-scoped overrides remain in `eslint.config.mjs` for two rules that really are about a
whole file:

- **`@typescript-eslint/no-explicit-any`** — `ActivityMap` builds MapLibre `interpolate`
  paint expressions, which are heterogeneous nested arrays that MapLibre's own types do not
  express usefully.
- **`@next/next/no-img-element`** — `ShareCardThumbnails` renders canvas-generated object
  URLs, which `next/image` cannot optimise.

If one of these files stops needing its exemption, drop it from the override list rather
than leaving the rule off for it.

### Test configuration

`vitest.config.ts` aliases `server-only` to an empty module: it throws unless resolved
through a react-server bundle, which is the point in the app and useless in tests — the
modules marked with it are exactly the ones the tests exercise directly. Coverage is scoped
to `lib`, `application`, `domain` and `components`; app-router pages and layouts are
exercised by the build, not by unit tests. `e2e/**` and `screenshots/**` are excluded
because they are Playwright specs with their own runner and their own `test`/`expect`.

`vitest.setup.ts` carries two environment workarounds:

- **`localStorage`** is reassigned from the underlying JSDOM instance. Node has had a
  built-in `localStorage` global since Node 22, and it shadows jsdom's implementation —
  Vitest only overrides globals it does not already find on `global`, so even
  `window.localStorage` resolves back to Node's broken stub.
- **`matchMedia`** is stubbed because jsdom does not implement it, and code reading
  `prefers-color-scheme` (such as `persistAccent`) would throw.

React Testing Library's automatic `afterEach` cleanup cannot register itself while Vitest
globals are disabled, so it is called explicitly — without it, renders leak across tests.

### End-to-end and screenshot runs

Playwright runs against a real production build (`next start`), not `next dev`: ISR/SSG
timing and cache headers differ enough to matter, and this matches what is deployed. The
server needs Firebase Admin credentials for the `runomics-dev` project to prerender
Firestore-backed pages. `PORT` comes from `.env.e2e` (3100) so a personal dev server left
running on 3000 does not collide with the suite's own build; both Playwright configs read
it, and the screenshot run can still be pointed elsewhere with `SCREENSHOT_BASE_URL`.

The screenshot audit has its own config so it never runs as part of the e2e suite, or vice
versa. It captures through an iPhone 13 viewport (390×844 @3×) because the app is designed
phone-first, driven by Chromium rather than the preset's default WebKit, and pins
`locale: 'en-US'` so string-based waits behave regardless of the host. Set
`SCREENSHOT_BASE_URL` to shoot an already-running server or a deployed URL and skip the
build. Some managed CI environments pre-provision a Chromium whose build number differs from
the one this Playwright version would download (and downloads are blocked), so a
pre-installed binary at `/opt/pw-browsers/chromium` — or `PLAYWRIGHT_CHROMIUM_PATH` — is
launched directly when present.

Determinism comes from three things together: the theme and accent are seeded into
`localStorage` *before* any app script runs (layout's `beforeInteractive` script reads the
accent key and stamps `data-accent`, which the palette CSS keys off), the colour scheme is
emulated as a backup for `prefers-color-scheme` and the pre-hydration paint, and every
transition and animation is frozen with an injected stylesheet — otherwise the aurora
background, tab underline and page transitions make two runs of the same screen differ. The
default accent is the bare stylesheet, so the wait for it is on the *absence* of the
attribute.

Each screen is shot begin/middle/end (what a phone actually shows) plus one stitched
full-page frame; pages too short to scroll get only the full frame. Screens with an in-page
tab bar are walked tab by tab. Route IDs in `screenshots/routes.ts` are real ones from
committed data so detail pages prerender with content instead of 404ing. Accents come
straight from `@/lib/accent`, so a newly shipped accent is captured without a second list to
keep in sync. Both themes and accents default to the shipped-out-of-the-box look because the
full matrix is six times the work; `SCREENSHOT_THEMES` / `SCREENSHOT_ACCENTS` take `all` or
a comma-separated list.

### Service worker

`public/sw.js` provides the offline app shell and push notifications.

- Hashed build assets (`/_next/static`) and icons are **cache-first** — they are immutable.
- Pages, RSC payloads and `/data` JSON are **network-first with cache fallback**, so the app
  opens with the last-seen content when offline; a failed navigation falls back to the
  cached shell.
- `/api` and cross-origin requests (map tiles, analytics) are **never cached**.

Push events display FCM webpush payloads (`{ notification: { title, body } }`) directly, so
no separate `firebase-messaging-sw.js` is needed. A non-JSON push falls through to the
generic notification.

Bump `VERSION` to invalidate every cache on deploy of a breaking change.

Made with love
