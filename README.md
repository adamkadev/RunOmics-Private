# RunOmics

A personal running dashboard that pulls your data from Garmin Connect and turns it into a self-hosted analytics app. Built with Next.js 16, TypeScript, and a Python sync pipeline.

## Features

- **Today** - the day's session, readiness from training load (CTL/ATL/TSB) tempered by a one-tap morning check-in, this week's volume and streak, and on a warm day what the forecast at your usual hour will cost ("29 °C at 19:00 - your runs at this heat cost about +14 s/km")
- **Activity detail** - GPS route map with live-sync to HR, pace and elevation charts; the run's conditions (sky, feels-like, humidity when muggy); grade-adjusted pace on a hilly run; on a controlled-threshold run, each rep's heart rate from minute 3 against its target and ceiling
- **Plan** - week and month views of the coach's (or Garmin's) sessions, with other training as a chip on its day
- **12-week checkpoint** - opened from Plan's "General preparation" card: this cycle against the 12 weeks before it (km and runs a week, controlled threshold time and pace guides, heat-adjusted efficiency, easy-run heart rate at a set pace, the 5K check, VO₂max, threshold pace and heart rate, resting heart rate, fitness), each marked better, worse or level
- **Analytics** - Load (fitness, fatigue, form, training status, the watch's load focus), Performance (best pace for every duration from 30 s to 2 h with a critical speed, running form, pace trend, efficiency, heat cost, race predictions), Volume (weekly distance, long run) and Intensity (80/20 split, time in zones, easy and workout heart rate by week, quality sessions)
- **Athlete** - zones (pace zones estimated by VDOT from a recent best effort when the watch has no threshold pace), VO₂max grade, a fitness age card with a year of history, four weeks of morning check-ins and twelve weeks of niggles
- **Consistency** - a year of weeks, runs and other training (strength, cycling, swimming…) side by side
- **Goals & PBs** - annual distance goal, race targets, official personal bests; races (A/B/C priority, a time or just finish) and goals are edited in Settings
- **All-time records** - best 1K/5K/10K/half/marathon detected from FIT files
- **Race page** - the next race: Garmin's prediction against your target and best, its 12-week trend, and even splits at both times; a VDOT estimate from your best recent effort when Garmin's predictions are missing or two weeks old
- **Explore** - quartier coverage on the Activities map (Districts layer), a loop-route generator for unexplored quartiers (flat and traffic-free on a reps day), GPX export, the quartiers each run pushed forward, and a push when one passes 90 %
- **Pushes** - the morning session, Monday's digest, Friday's goal check-in, new runs and their verdict, records, shoe wear, quartiers past 90 %, and sync failures; each phone picks Training, Shoes and "Records and explored areas" in Settings
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

- Node.js 24 (pinned in `.nvmrc`; `nvm use` picks it up)
- Python 3.12, what CI and the sync workflow run
- A [MapTiler](https://www.maptiler.com/) account (free tier works)
- A Garmin Connect account

### 1. Clone and install

```bash
git clone https://github.com/adamkadev/RunOmics-Private runomics-private
cd runomics-private

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
and note its expiry date as `GARMIN_PERSONAL_API_KEY_EXPIRES` (see
[Configure environment variables](#3-configure-environment-variables)) so the nightly sync warns two weeks
ahead: an expired key fails the night with a message saying so
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

#### Optional: intervals.icu, to put the coach's workouts on the watch

The coach's workouts reach the watch most reliably through [intervals.icu](https://intervals.icu),
a free, official Garmin partner: RunOmics puts each session on its calendar, and intervals.icu's
own Garmin connection sends it on to Garmin Connect and the watch. Each athlete uses their own
account. Read intervals.icu's terms yourself before you rely on it.

1. Create a free intervals.icu account.
2. **Settings → Connections → Garmin**: connect, and enable uploading planned workouts to Garmin.
3. **Settings → Developer Settings**: generate an API key. Put it in the profile's env file
   (`.env.adam.local`, `.env.lamiaa.local`) as `INTERVALS_API_KEY`, and the athlete id shown
   there (`i…`) as `INTERVALS_ATHLETE_ID` (optional; the key's own athlete by default).
4. Dry run: `npm run coach:sync-garmin` (or `coach:sync-garmin:lamiaa`) previews the plan.
5. If RunOmics already pushed sessions through Garmin Connect, the preview says how many. Apply
   with `npm run coach:sync-garmin -- --apply --retire-connect`: it deletes RunOmics's own
   Connect workouts from today on (only those; it needs `GARMIN_SECRET` once more), then puts
   the sessions on intervals.icu. Without any, `--apply` alone. Commit
   `coaching/intervals-sync.json` if the CLI asks you to.

With `INTERVALS_API_KEY` set, `coach:sync-garmin` uses intervals.icu; without it, the Garmin
Connect route runs as before, and `--route connect|intervals` picks one explicitly. See
`docs/data-and-sync.md`, *intervals.icu write path*.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in what you use. It is the one list of every
variable RunOmics reads, with what each is for and where it has to be set; at least set
`GARMIN_PERSONAL_API_KEY`, `RUNOMICS_DATA_DIR` and `NEXT_PUBLIC_MAPTILER_TOKEN`.

```bash
cp .env.example .env.local
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

Besides the runs, a sync writes strength, cycling, swimming and every other non-running
session to `data/cross_training/<year>.json`, apart from the runs so that no running number
reads one. Each run stores its most metres in 30 s to 2 h (`durationBests`) and, on a
barometric altitude, a grade-adjusted pace (`gapSecPerKm`). The nightly workflow also
refreshes `shoes.json` with `scripts/sync_shoes.py` and copies the run notes and morning
check-ins from Firestore into `activity_notes.json` and `wellness.json`. See
[What a sync writes](docs/data-and-sync.md#what-a-sync-writes).

### 5. Start the dev server

```bash
RUNOMICS_DATA_DIR=../runomics-data-adam/data npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration: goals, PBs, athlete profile {#goals-pbs-athlete-profile}

Races and season goals are set in the app: **Settings → Races & goals** (owner only)
adds, edits and removes races and sets each year's distance and target times. They are
kept in Firestore, and the nightly sync mirrors them into `race_entries.json` and
`goal_entries.json`, laid over the two files below (see
[docs/data-and-sync.md](docs/data-and-sync.md#what-a-sync-writes)).

Official personal bests and your athlete profile (HR zones, threshold pace, etc.) are
**not** in Firestore - they're hand-edited JSON files in the private `RunOmics-data`
repository, fetched into `data/` and read server-side, as is `goals.json`, which still
works under the editor. An edit pushed to that repository is served like a sync's (see
[Sync and deploy](#5-sync-and-deploy)), with no rebuild. Races synced from Garmin Connect
land in `upcoming_races.json` (`scripts/sync_upcoming_races.py`); the editor can change
or hide them without touching that file.

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
`displayName` has no Garmin equivalent and is edited by hand. Set any field to `null` to clear it (the app falls back to a population-average
default where one exists, e.g. training load).

## Adaptive coach

The optional coach runs locally, from the CLI (`npm run coach`), and keeps its reviewed
prescriptions under the private `data/coaching/` tree. **The coach runs through Claude Code;
the app's AI copy runs through Gemini.** Every coach command (`bootstrap`, `evaluate`,
`weekly-review`) writes its whole prompt - rules, athlete context, answer schema - to
`.coach-previews/coach-prompt.md` (or `--prompt-out`) and stops. Answer it in Claude Code,
save the JSON reply, and run the same command again with `--from-answer <reply>`. No API key
is involved. A reply the validators reject rewrites the prompt with the reason attached,
ready to answer again; an in-app change and a new block both get that repair loop.

`--advisor gemini` asks Gemini instead, with `GEMINI_COACH_API_KEY` and nothing else:
without it the command fails rather than borrowing the general `GEMINI_API_KEY` quota,
which stays the app's, for its verdicts and insight cards. Nothing deployed calls the
coach, so the coach key stays in the coach's `.env.<profile>.local` and is needed neither on Vercel nor in GitHub
Actions. Garmin-scheduled sessions under `data/planned_workouts/` remain a separate,
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
npm run coach -- weekly-review --from-answer answer.json
npm run coach -- weekly-review --advisor gemini
npm run coach -- --apply .coach-previews/<proposal>.json
```

A weekly review or a run's evaluation is told the weeks left in the current block, up to
its end date, and may replan only those: a new block comes from `bootstrap`.

The coach reads the notes and tags written in the app from Firestore `activityNotes`, live,
at the moment it builds its context, and morning check-ins the same way from Firestore
`wellness`. When Firestore does not answer, it falls back to the nightly copies,
`activity_notes.json` and `wellness.json`, at most a day old. That read needs the production
Firebase **Admin** credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`). The coach commands load one gitignored file per athlete,
`.env.adam.local` for `npm run coach` and `.env.lamiaa.local` for `npm run coach:lamiaa`,
with `dotenv -o`: that file alone, its values winning over the shell's, so it holds
everything the coach reads, the production admin trio included. Without them the coach warns
that it read the nightly copies instead, or, with no copy either, that it is building the plan
without notes - the whole failure mode, because a plan built blind looks exactly like one built
with the tags the athlete wrote. The coaching path only ever reads that collection, but the
service account itself is not read-only, so treat that file as the production credential it is.

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

CI (`.github/workflows/ci.yml`) runs lint, typecheck, the import-cycle check and the Vitest
suite on every push/PR, plus the Python suite (`pytest scripts/tests/`) and the Firestore
rules against the emulator as separate jobs. The tests run in two shards beside lint, each
with a worker per core (`--maxWorkers=100%`). The production-dependency audit
(`npm audit --omit=dev --audit-level=high`) fails only a change that touches
`package-lock.json`, so an advisory published overnight does not turn every unrelated PR red;
Dependabot's security updates (enabled in the repository's settings) open the fix instead, and
its weekly version updates stay grouped. ESLint keeps a cache (`npm run lint` writes it under
`node_modules/.cache/eslint`), which CI restores on every run and saves from `main` only, so
branch runs do not fill GitHub's 10 GB of caches. It does **not**
run `next build`. The production build is exercised by the E2E workflow
(`.github/workflows/e2e.yml`), which runs `npm run test:e2e` — Playwright's `webServer`
runs `e2e:build` (`next build`) and serves it with `e2e:start`. So a change that only
breaks the build fails E2E, not CI. E2E runs on pushes to main and on demand, not on pull
requests (a run is about 3 minutes): run it on a branch from Actions → E2E → Run workflow
before merging a change that could break the build.

### End-to-end tests

Playwright drives a real production build (`next build && next start`). No Firebase
project or secrets are needed: every page (dashboard, activities list → detail,
analytics, records, goals, map, shoes, plan, progress) is built from the generated demo
dataset, and the owner's writes go to local emulators (below). The
`iphone` project walks every page in WebKit at the iPhone 16 Pro's size, with reduced
motion, for text that runs past an edge. The `sparse-fr` project builds a second app,
French and from a sparse Forerunner 55 profile (`npm run demo:generate -- --profile sparse`),
and runs the layout, Today, Plan and Analytics specs plus an axe pass against it.

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

`.env.e2e` also carries the non-secret Firebase client config and pins `PORT` to
3100, so a dev server on 3000 does not collide with the suite's own. It sets
`NEXT_PUBLIC_E2E_MAPS=1`, a test build's flag only: with no MapTiler token, MapLibre
still builds the heat map and a run's map on a blank inline style, so the specs can tap
the map (a start point, a spot to avoid, a quartier).

**The owner.** Playwright starts the Firebase Auth and Firestore emulators (ports 9099
and 8080, through a pinned `firebase-tools`; they need Java 21), and `.env.e2e` points
the build at them (`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`,
`NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`). `signInAsOwner` in `e2e/owner.ts` makes a
made-up Google account with the `owner` claim and hands the page the session the
emulator issues, as the Auth SDK keeps a returning user's: Google's popup loads its
script from apis.google.com even against the emulator. The Firestore rules apply as
they do in production.
`owner.spec.ts` covers the morning check-in, a note with a tag and the HR-unreliable
switch, and the notification switches; `sparse.spec.ts` marks a missed session
« Sautée » in French; `explore.spec.ts` marks spots to avoid in the owner's Firestore.
Each test clears the documents it writes, since the emulator outlives a local run and
both builds share it. `next.config.ts` refuses all three test flags on Vercel, so none
can reach a deployment.

**Visual checks.** `npm run test:visual` (or Actions → Visual) compares key screens of both
athletes, in both themes, with baselines drawn on a fixed day. Run it before a perf or
visual pull request; [`e2e/visual/README.md`](e2e/visual/README.md) says how to update
the baselines.

### Monitoring

`GET /api/internal/health` (authenticated with `x-internal-secret`) answers
`ok`, or `stale` with HTTP 503 once the last sync (`lastSyncedAt`) is 72 hours
old, the same threshold as the in-app stale-sync push. The date of the last run
(`daysSinceLastActivity`) is reported for information only: a training break is
not a broken sync. Data that will not load answers `unloaded`, also with 503.
Its `integrations` field says which server integrations the deployment has
credentials for (`firebaseAdmin`, `gemini`, `syncButton`, `cron`) and whether it
is private (`privateSite`), by name only, and the nightly sync warns when one the
post-sync checks need is missing. `ai` is the last AI insight pass (see
[AI insight generation](docs/coaching-and-metrics.md#ai-insight-generation)), and
`firestoreRulesHash` the SHA-256 of the ruleset Firestore enforces now: the nightly
sync warns when it differs from `firestore.rules` in the repository, or when health
cannot read it (the service account needs the *Firebase Rules Viewer* role).

Every other alert is sent by the deployment it watches, so one that is down, or
has lost its Firebase or cron credentials, cannot report itself. The *Deployment
Health Watchdog* workflow checks each profile from GitHub instead, daily at
17:47 UTC, with its GitHub Environment's `APP_URL` and `INTERNAL_NOTIFY_SECRET`.
It fails when the last sync is 36 hours old (one missed night), when the data is
unloaded, or when `firebaseAdmin` or `cron` is missing, and GitHub emails a
failed scheduled run to whoever last changed its schedule. Run it by hand from
Actions after changing a deployment's variables.

When GitHub refuses the nightly sync's dispatch (an expired or narrowed
`GITHUB_SYNC_TOKEN`), no run starts, so the nightly-sync cron sends an operator
push itself.

Errors on a phone are reported to `/api/client-errors`, scrubbed of coordinates,
and listed under Settings → Diagnostics; see
[Client error reports](docs/security-and-build.md#client-error-reports).

---

## Reprocessing

If you update the FIT parser (e.g. after adding new metrics), reprocess all activities from the cached FIT files without re-downloading from Garmin:

```bash
python scripts/reprocess.py
```

For a deployment, run *Sync Garmin Activities* from Actions with `reprocess` ticked and the
profile picked: it rebuilds the stored runs from the workflow's FIT cache and makes no Garmin
call. A run whose FIT file is not in that cache keeps what it had, and the log says how many;
when it reports any, run the workflow once more with `force` ticked, which downloads them
again. Existing runs get their duration bests and grade-adjusted pace this way.

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
from your `.env.local` *except* the Garmin ones, `RUNOMICS_DATA_DIR` and `GEMINI_COACH_API_KEY`:

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Route maps |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side notification dedup state and push notifications |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side auth, activity notes, push notification tokens |
| `NEXT_PUBLIC_OWNER_EMAIL` | Which account `npm run set-owner-claim` grants the `owner` claim to - not itself an authorization check |
| `INTERNAL_NOTIFY_SECRET` | Authenticates the sync workflow's calls to `/api/internal/*`, and a scheduled route run by hand |
| `CRON_SECRET` | Authenticates Vercel Cron's calls to the scheduled routes (see [Scheduled jobs](#scheduled-jobs)); set it on each Vercel project |
| `OPS_PUSH_URL`, `OPS_PUSH_SECRET` | Optional: the operator channel. On a second athlete's deployment, both forward its operator alerts to `OPS_PUSH_URL` on your own, in English and titled with its `GITHUB_SYNC_PROFILE`; on your own deployment set `OPS_PUSH_SECRET` alone, which is what opens `/api/internal/ops-push` to the other. The secret is yours to generate (32+ random characters, e.g. `openssl rand -base64 32`) and must be the same on both. Unset, operator alerts go to the devices registered on that deployment - see [Push notifications](docs/data-and-sync.md#scheduled-jobs-and-pushes) |
| `GITHUB_SYNC_TOKEN`, `GITHUB_SYNC_REPO`, `GITHUB_SYNC_PROFILE` | The Sync button and the nightly cron dispatch `sync.yml` with them: a token that may run that workflow, `owner/repo`, and this deployment's profile (`GITHUB_SYNC_WORKFLOW` and `GITHUB_SYNC_REF` default to `sync.yml` and `main`) |
| `RUNOMICS_PRIVATE`, `SESSION_SECRET`, `RUNOMICS_VIEWERS` | `RUNOMICS_PRIVATE=1` puts every page behind sign-in; `SESSION_SECRET` (32 characters or more) signs the session cookie; `RUNOMICS_VIEWERS` lists the Google accounts invited to view, comma-separated |
| `NEXT_PUBLIC_LOCALE` | UI language, `en` (default) or `fr` — applied at build time |
| `NEXT_PUBLIC_TIME_ZONE` | Optional: the athlete's IANA time zone (e.g. `Europe/Luxembourg`), so a page prerendered on Vercel's UTC clock and the browser agree on which day it is - see [Date handling](docs/interface.md#date-handling) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BACKFILL_MODEL` | Optional: the AI-written verdicts and insight cards - Today, run verdicts, PB celebration, shoe verdicts. `GEMINI_MODEL` replaces the Flash pool, `GEMINI_BACKFILL_MODEL` the Flash-Lite pool that backfills older run verdicts; unset, each pool keeps its own models |
| `ORS_API_KEY` | Optional: Explore's route generator (OpenRouteService loops) - see [Explore](docs/interface.md#explore) |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | The private data repository the build clones; a fine-grained token with Contents: Read only |
| `RUNOMICS_DATA_SOURCE` | `github`: reads that repository at run time. The sync never rebuilds a deployment, so without it a deployment keeps the data of its last build - see [Reading the data at run time](docs/data-and-sync.md#reading-the-data-at-run-time) |
| `APP_URL` | Optional: this deployment's `https://` origin, for the links pushes open. On Vercel it defaults to the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`); without either, a tapped push opens the app's home page |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Optional: `true` lets search engines index the site (the public demo); anything else answers `noindex` |

> `GARMIN_PERSONAL_API_KEY` and `GARMIN_SECRET` are only used by the sync script - neither runs on Vercel.
> `GEMINI_COACH_API_KEY` / `GEMINI_COACH_MODEL` are the same: only the local coach CLI reads
> them, and only with `--advisor gemini`, so nothing deployed does. Add them here only if a
> server-side coaching route ever ships. No workflow runs a coaching generation either, so
> they belong in no GitHub Environment yet. See
> [AI insight generation](docs/coaching-and-metrics.md#ai-insight-generation) for the full split.

The sync workflow reads its secrets from a **GitHub Environment** named
after the deployment's profile (GitHub → Settings → Environments), not from
repository secrets: `GARMIN_PERSONAL_API_KEY` (and optionally `GARMIN_SECRET`), `RUNOMICS_DATA_REPO_URL`,
`RUNOMICS_DATA_REPO_TOKEN`, `APP_URL` (your deployed domain, no trailing slash) and
`INTERNAL_NOTIFY_SECRET`, plus an environment *variable* `PROFILE` holding the environment's
own name. With a Garmin key, add the *variable* `GARMIN_PERSONAL_API_KEY_EXPIRES`: the key's
expiry date as Garmin showed it when you created it, as `YYYY-MM-DD` (e.g. `2027-10-01`). The
nightly sync then pushes from 14 days before that date, and warns in the run's annotations while
the variable is missing; update it with each new key. These are separate from the Vercel env vars above, and `INTERNAL_NOTIFY_SECRET`
must match on both sides.

That indirection is what lets one repository drive several deployments - one per
athlete, each with its own data repository, Firebase project, domain and UI
language; with a single profile it is just a place to keep the secrets.

### 4. Deploy the Firestore rules

`firestore.rules` is not deployed with the app. After a change to it (the `skipped` field on
`wellness` is the latest), deploy it by hand to each Firebase
project, or the phones' writes are refused:

```bash
firebase deploy --only firestore:rules --project <firebase-project-id>
```

`npm run test:rules` checks the rules against the emulator first. The nightly sync compares
the deployed ruleset with the repository's and warns in its run when a project was left behind;
for that, grant the Firebase Admin service account the **Firebase Rules Viewer** role
(Google Cloud console → IAM) on each project.

### 5. Sync and deploy

Each deployment's Vercel Cron starts its own nightly `sync.yml` run (see
[Scheduled jobs](#scheduled-jobs)): it hydrates a runner workspace from that profile's data
repository, syncs Garmin, pushes the changed files back and expires the deployment's data
cache (`POST /api/internal/data-revalidate`), so the app serves the new commit within
seconds, with no rebuild; it then renders the main pages once so the first visit does not
wait. The post-sync checks (records, shoe wear, explored quartiers, overreaching, new runs,
phone errors, the AI texts) follow.

The app's Sync button runs the same workflow with `quick`: the new runs come
through the Personal API key alone, with no WARP and no garth sign-in, then the
push and the post-sync checks as usual. Their shoes, the calendar and
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

A push by hand is picked up within ten minutes, when the deployment's cached HEAD expires;
`POST /api/internal/data-revalidate` with the internal secret makes it immediate. Nothing real
is ever committed to this repository.

### Scheduled jobs

`vercel.json` schedules the routes below with Vercel Cron, in UTC; GitHub's own schedules
landed hours late. Each Vercel project runs them for its own athlete, and `CRON_SECRET` must
be set on each project, or every call is refused.

| Route | When (UTC) | What it does |
|-------|------------|--------------|
| `/api/internal/nightly-sync` | 04:00 daily | Dispatches this deployment's full `sync.yml` run (`nightly`), unless one is already running |
| `/api/internal/daily-session` | 06:00 and 07:00 daily | The morning session push; only the call in the 08:xx Paris hour sends, so it arrives between 08:00 and 09:00 summer and winter, once a day |
| `/api/internal/stale-sync-check` | 06:00 daily | Pushes once when no sync has landed for 72 hours |
| `/api/internal/weekly-digest` | 06:00 Monday | Last week's km and quality sessions against the plan, other training, resting heart rate and this week's focus |
| `/api/internal/weekly-reminder` | 15:00 Friday | The annual distance goal: ahead, on track or behind; once a year, from 1 December, that the goals have no entry for the coming year (or, from 1 January, this one) |

A scheduled push is sent once per day (Firestore remembers the day it went). To run a route
by hand, `POST` it with the internal secret, or `GET` it the way Vercel Cron does:

```bash
curl -X POST "$APP_URL/api/internal/weekly-digest" -H "x-internal-secret: $INTERNAL_NOTIFY_SECRET"
curl "$APP_URL/api/internal/weekly-digest" -H "Authorization: Bearer $CRON_SECRET"
```

A `GET` of `daily-session` outside the 08:xx Paris hour is skipped; a `POST` skips that check
but still sends once a day.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, SSG) |
| Language | TypeScript 7 (`tsc`), with the TypeScript 6 API for typescript-eslint and Next until 7.1 ships one |
| Styling | Tailwind CSS v4 |
| Charts | Hand-drawn SVG; [Recharts](https://recharts.org/) for the similar runs' line |
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

### Public demo

The public repository is written from this one, never edited apart from its README,
CHANGELOG and screenshots:

```bash
npm run export:demo -- --to ../RunOmics [--ref <commit or tag>] [--check]
```

It extracts the tree at `--ref` (default `HEAD`) and drops what
`scripts/export_public_demo.config.json` denies: the agent tooling, the sync and capability
workflows that need the athletes' secrets, this README, the CHANGELOG and `docs/`, the
athletes' Garmin snapshots, and the tests that carry their numbers, races or places. It keeps
the public repository's own README, CHANGELOG, LICENSE, screenshots and link-preview images,
blanks the private Firebase project in `.env.e2e`, drops the crons from `vercel.json` and the
athlete-specific npm scripts. Then it runs `verify_no_private_data` and scans every exported
file for the athletes' names, addresses, places, races, tokens and Garmin ids; any finding
stops it with the clone untouched. A clean export is staged in the clone, never committed:
review it, commit and push by hand. `--check` runs everything and writes nothing.

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

Bootstrap reads case-specific athlete instructions from `coaching/guidance.md` in the
data workspace, or from `--guidance-file <path>` in its place: accepted workouts to
preserve, nonmandatory volume ranges, a clinician's instructions during a return to
running. Keeping them in the data repository means the next renewal is told what the
last one was, and the decision records the guidance's hash. These instructions reach
Gemini separately from deterministic training-history facts.
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

- [Data and sync](docs/data-and-sync.md): Private data and the sync pipeline, Reading the data at run time, What a sync writes, Scheduled jobs and pushes, Garmin write path (coaching sync), Garmin-sourced series, Official race results.
- [Coaching and metrics](docs/coaching-and-metrics.md): Coaching model, Controlled threshold, The 12-week checkpoint, The Plan's single workout shape, Training metrics, Pace curve and grade-adjusted pace, VDOT fallbacks, Morning check-in, The heat line, AI insight generation.
- [Interface](docs/interface.md): Charts, Colour system, Maps, Explore, Share card, Platform and browser workarounds, Internationalisation, Date handling.
- [Security, build and tests](docs/security-and-build.md): Owner authorization, Firestore rules, Content Security Policy, Build configuration, Test configuration, End-to-end and screenshot runs, Client error reports, Service worker.
