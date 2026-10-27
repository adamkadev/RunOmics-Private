# Data and sync

Where the athlete's data lives, how a sync reaches it, and what Garmin does and does not give. Part of the implementation notes: see the [README](../README.md#implementation-notes).

## Private data and the sync pipeline

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

**A push checks the data contract first.** `push_private_data.mjs` runs
`scripts/validate-data.ts` on the workspace before it clones, and refuses to push when an
error rule fails, printing the rules that did. The deployment checks every commit with the
same contract and keeps serving the previous one on a refusal, and the next code deploy
would fail its build, so a dataset that breaks the contract must never become HEAD. The
nightly workflow restores `node_modules` from CI's cache, or runs `npm ci --ignore-scripts`,
for `tsx`.

`scripts/loadPalette.mjs` stages `src/lib/<entry>.ts` for use from plain Node. Every
module it is asked to load must be alias-free (`./x`, never `@/x`), and dependencies
must be listed before the modules that import them.

## Reading the data at run time

With `RUNOMICS_DATA_SOURCE=github` on Vercel, a deployment reads its data
repository through GitHub's API instead of the copy its build cloned, so a sync
shows in about the time the sync takes, with no rebuild. The data repository
stays the only copy: every writer pushes to it as before. Both deployments run
this way, and the sync fires no deploy hook: a deployment without the mode keeps
the data of its last build, and `data-revalidate` answers it with a 409.

- **Each page and route that reads data awaits `loadData()` first.** It asks
  GitHub for HEAD (cached ten minutes, tagged), and when HEAD moved it reads the
  commit's tree and the files that changed, then swaps the new commit in whole.
  `npm run check:cycles` fails on a page or route that reads data without it.
- **The sync expires that cache** with `POST /api/internal/data-revalidate`
  after each push (the tag with `expire: 0`, and the root layout's path, since
  pages prerendered at build never read the tagged pointer), then polls health
  every 3 s until it reports the new sync, and pings once more for a page whose
  render straddled the first ping.
- **The pages a phone opens first are rendered right after.** Once the response
  is sent, `warmPages` waits 2 s for the expiry to land, then fetches Today,
  Activities, Plan, Analytics, Profile and the newest run's page, so the first
  tap after a sync is served from cache rather than rendered. On a private site
  it signs a two-minute owner session cookie for these requests with
  `SESSION_SECRET`; without the secret there is no warm-up. Each failure is
  logged by path, never thrown.
- **A commit is checked before it goes live,** with the same data contract the
  build ran. A refused commit leaves the previous one serving, and health
  reports it as `rejectedData`, which fails the sync.
- **If GitHub is unreachable,** an instance keeps serving the commit it has;
  a new one cannot start serving and answers with an error, and cached pages
  stay up.
- **The functions ship without the data.** With the mode set at build,
  `next.config.ts` stops tracing `./data/**` into them; the build itself still
  reads its clone to prerender.
- **Local runs never read GitHub:** the mode needs `VERCEL=1`, and the build
  reads its clone, so dev, E2E and the CLIs work from files as before.
- **Month files are written one key a line, with number arrays on one line**
  (`dumps_readable` in `scripts/repository/json_store.py`): a diff still shows
  which field moved, at about 40% of the indented size (6.9 MB for the whole
  history instead of 16.9 MB once every month is rewritten), which keeps each
  month far under the 2 MB a fetch may cache. A month takes the format the next
  time the sync writes it.
- **A token is announced before it expires.** On scheduled runs the sync reads
  GitHub's `github-authentication-token-expiration` header for each data token,
  and the Garmin key's date from the Environment variable
  `GARMIN_PERSONAL_API_KEY_EXPIRES` (a bare `YYYY-MM-DD`: Garmin's API does not
  report it), and posts them to `POST /api/internal/token-expiry`, which pushes
  when one has 14 days or fewer left - the GitHub tokens in one push, the Garmin
  key in its own, both through `sendOpsPush`.

## What a sync writes

Beyond the month files of runs, a sync keeps these, each read by its own repository:

- **Other training** (`cross_training/<year>.json` and an `index.json` of the years,
  `scripts/garmin/cross_training.py`). Strength, cycling, swimming and every other
  non-running activity, one compact summary each from Garmin's activity list: sport,
  duration, distance, average HR and training load. A strength session also downloads its
  FIT for the work sets (category, exercise, reps, weight, duration). They live apart from
  `activities/` so that no running metric, load or record can ever read one; the app shows
  them on Plan and Consistency, and the coach gets the last 28 days (`otherTraining`). The
  first night reads 180 days back; after that each night re-reads from 14 days before the
  newest stored session, which catches one the watch uploaded late. Breathwork and
  meditation are skipped, an activity that became a run is dropped, and a session that
  fails is retried the next night while the step reports a partial sync.
- **Shoes** (`shoes.json`). The nightly workflow runs `scripts/sync_shoes.py` after the sync,
  through WARP like every garth call, so a pair added or retired in Garmin Connect shows the
  next morning. Without `GARMIN_SECRET`, or when Connect fails, the stored list is kept and a
  failure counts the night as partial. Once garth's token has expired the step is skipped
  (see [After garth](#after-garth)).
- **Shoe picks** (`shoe_choices.json`). The owner picks a run's shoe on its page (Firestore
  `runShoes/{activityId}`) and a default shoe on Shoes (`shoeSettings/default`), both owner-only
  in `firestore.rules`. `GET /api/internal/shoe-choices` returns `{ runs, settings }` and the
  workflow commits it like the notes. The app reads the copy when it loads the runs: a pick wins
  over Garmin's shoe, and the default fills a run Garmin gave none, from the pair's first use on.
  The stored `gearId` is never rewritten, so a pick can be undone and Garmin's answer comes back.
  A pick counts toward the mileage after the next sync; the owner's own page shows it at once.
  A pick or a default naming a shoe `shoes.json` does not list is ignored.
- **Sync report** (`sync_meta.json`). Besides `lastSyncedAt`: `warnings`, each Garmin request a
  step read around rather than failed on (`{ step, message }`, from `scripts/garmin/step_warnings.py`),
  dated `warningsAt`, which a quick or single-run sync leaves as the last full sync wrote them;
  `seriesFreshness`, the newest sample date of each Garmin series file
  (`scripts/garmin/series_freshness.py`); and `shoesCheckedAt`, the last time Connect answered
  the gear list. The workflow writes the warnings into the run's summary. Health reports
  `connectWarnings`, `seriesFreshness` and `staleSeries`, and Settings → Diagnostics lists each
  series with its newest sample, red with "nothing new since" once it is past
  `STALE_AFTER_DAYS` (`src/domain/sync/seriesFreshness.ts`). A series the watch never filled reads
  "never received", not stale. Shoes notes the list's date once it is more than 14 days old.
- **Run notes and morning check-ins** (`activity_notes.json`, `wellness.json`). Both exist
  only in Firestore otherwise. The workflow reads them through `GET /api/internal/activity-notes`
  and `GET /api/internal/wellness`, sorted so the commit changes only where an entry did, and
  logs a count, never an entry. The coach falls back to both when Firestore does not answer.
  Neither step can fail the sync.
- **Route names and avoid spots** (`route_names.json`, `avoid_spots.json`). Also only in Firestore
  otherwise: one `GET /api/internal/route-data` returns both, sorted by id, and the step writes one
  file each and logs the two counts. Nothing in the app reads them back; they are there to restore.
- **Races and goals edited in the app** (`race_entries.json`, `goal_entries.json`). Settings →
  Races & goals writes Firestore `raceEntries` and `goalEntries`; one `GET /api/internal/goals-races`
  returns both, sorted by id, and the step writes one file each. Unlike the backups above, the app
  reads them: `getUpcomingRaceYears` lays the race entries over `upcoming_races.json` (a race added
  in the app, or a Garmin race edited or hidden under its Garmin id), and `getGoalYears` lets a
  season in `goal_entries.json` replace the same year in `goals.json`. Plan, Today, the race page,
  Goals and the coach all read through those two, so they agree, and an edit reaches them at the
  next sync (the Sync button, or the night). The coach's dump warns when Firestore holds edits the
  mirror lacks.
- **Restoring from the backups** (`scripts/restore_firestore.mjs`). Puts `activityNotes`, `wellness`,
  `routeNames`, `avoidSpots`, `runShoes`, `shoeSettings`, `raceEntries` and `goalEntries` back from those seven files, with the Admin SDK. It is a dry run by
  default: it reads each collection and reports, per collection, how many documents are missing, how
  many differ from the backup and how many already match. `--apply` writes the missing and differing
  ones (a whole-document `set`). It only upserts: a document that is in Firestore but not in the backup
  stays. A document the rules would refuse is skipped and counted, a missing file is skipped, and a file
  without its key stops the run. It prints counts only. Run it against one deployment at a time, from a
  checkout of that athlete's data repository:

  ```sh
  dotenv -e .env.local -- node scripts/restore_firestore.mjs <data dir>          # dry run
  dotenv -e .env.local -- node scripts/restore_firestore.mjs <data dir> --apply
  ```

  The env file needs that project's `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
  `FIREBASE_PRIVATE_KEY`; with `FIRESTORE_EMULATOR_HOST` set it writes to the emulator instead.
- **Duration bests** (`durationBests` on each run, `scripts/processing/pace_profile.py`): the
  most metres covered in 30 s, 1, 2, 3, 5, 10, 20, 30, 60, 90 and 120 min, on the moving clock
  and from the full-resolution records. A step faster than 8 m/s (2:05/km) is capped as a GPS
  jump. The window is exact on a piecewise-linear track: the best one starts or ends on a
  sample, so both anchorings are tried.
- **Best efforts** (`bestEfforts`, the fastest 1 km, mile, 5 km and so on): read on the same
  GPS-jump-capped distance as the duration bests, so a jump can make neither faster.
- **Runs removed in Garmin Connect** (`removed_activities.json`, `scripts/garmin/listing_reconcile.py`).
  After a complete listing (never with `--limit`, `--id` or `--dry-run`), a stored run missing from
  it is checked against Garmin: a 404 means deleted, another sport means re-typed (a run changed to
  walking). Either moves it out of `activities/` into the tombstone file with its id, date, name,
  distance and reason, at most 5 a night; the cross-training step then reads back to the re-typed
  run's date, so the walk lands in Other training. A run Garmin still calls a run, or one it does
  not answer for, stays and makes the night partial. More than 20 missing runs, or an empty list,
  reads as a list cut short: nothing is removed and the night is partial.
- **Names follow Garmin Connect.** Each night the stored description takes the list row's name,
  cleaned and matched against the plan as a new run's is, and a renamed run's type is inferred
  again when its FIT is cached (without it the type stays, as the summary alone would drop
  Garmin's race flag).
- **A run that changes month** on a re-fetch leaves its old month file, which is deleted when
  nothing is left in it. One id in two month files stops the sync before anything is written.
- **Grade-adjusted pace** (`gapSecPerKm`, with a GAP pace series for the chart): each step
  counted as the metres of flat running that would cost the same energy, by Minetti et al.
  (2002)'s cost of running against gradient. See
  [Pace curve and grade-adjusted pace](coaching-and-metrics.md#pace-curve-and-grade-adjusted-pace).

**Existing runs get the new fields by reprocessing.** Dispatch *Sync Garmin Activities* with
`reprocess` for the profile: `scripts/reprocess.py` rebuilds every stored run from the
workflow's FIT cache with the current parser and calls Garmin for nothing. It writes the FIT
fields through `fit_derived_fields()`, the mapper's own, so a reprocessed run matches a
freshly synced one (a parity test holds them together). A run without a
cached FIT keeps what it had, and the log counts them; when it reports any, dispatch once more
with `force`, which downloads every FIT again.

## Scheduled jobs and pushes

**Vercel Cron runs the schedule** (`vercel.json`), because GitHub's scheduled workflows started
hours late and the morning push arrived around lunchtime. Each deployment runs the crons for
its own athlete:

- `nightly-sync` at 04:00 UTC dispatches `sync.yml` with `nightly` (and the deployment's
  `GITHUB_SYNC_PROFILE`), unless the sync gate says a run is already going. `nightly` is what
  turns on the token-expiry warning, which a dispatch from the Sync button leaves off.
- `daily-session` runs at 06:00 and 07:00 UTC. Paris is UTC+2 in summer and UTC+1 in winter,
  so exactly one of the two falls in the 08:xx Paris hour (`isDailySessionHour`), and only that
  one sends.
- `stale-sync-check` daily at 06:00, `weekly-digest` Monday at 06:00 and `weekly-reminder`
  Friday at 15:00.

**Two secrets, two callers.** Vercel Cron can send nothing but `Authorization: Bearer
$CRON_SECRET` on a `GET`; the workflow and a person send `x-internal-secret` on a `POST`.
`scheduledRoute` gives each scheduled route both: `GET` checks `CRON_SECRET`, `POST` checks
`INTERNAL_NOTIFY_SECRET`. Every other internal route takes the internal secret alone. The
guard rate-limits before it checks either.

**A scheduled push goes out once a day.** `sendOncePer` claims the day's key in Firestore before
sending and releases it if the send throws, so a retry or the second `daily-session` call cannot
repeat a push, and a failed one is tried again.

**Each device chooses its pushes.** A `pushTokens` document carries `categories`, the three
Settings switches; `sendPush` sends to the devices whose switch for the push's audience is not
off. A device registered before categories existed has none stored and keeps getting everything.

| Audience | Pushes |
|----------|--------|
| `training` | The morning session or rest day, the Monday digest, the Friday goal check-in, a new run, the AI verdict of a run that just landed, an overreaching alert |
| `shoes` | Shoe wear |
| `records` | A new record, a quartier past 90 % |
| `always` | A failed workflow, a stale sync, a data token or the Garmin key about to expire, garth's token found expired, the digest of phone errors, the coaching-block reminder: sent whatever the switches say |

**Operator alerts leave the athlete's deployment.** A second athlete's deployment registers
her devices, so an `always` push about a dead token or a failed workflow reaches her and not
the person who can fix it. `sendOpsPush` carries those five - a failed workflow, a data token
about to expire, garth's token found expired, the digest of phone errors and the coaching-block reminder - and with
`OPS_PUSH_URL` and `OPS_PUSH_SECRET` set it POSTs them to the operator's own deployment at
`/api/internal/ops-push` instead of pushing locally. That route is the one internal route
guarded by `OPS_PUSH_SECRET` rather than `INTERNAL_NOTIFY_SECRET`, so the second deployment
holds a secret that opens nothing else. The alert arrives titled with the sending deployment's
`GITHUB_SYNC_PROFILE` - not the athlete's name, because an alert about a workspace that will
not load must not need that workspace to say who it is about - and its words come from the
English locale whatever that deployment speaks. A refusal or a timeout throws, so the calling route answers 500 rather than record an
alert nobody read. A stale sync is **not** an operator alert: the athlete can act on it.

**Every push opens a page and carries a tag.** `sendPush` sends the push's `link` as
`webpush.fcmOptions.link`, which FCM accepts only as an absolute HTTPS URL, so a path is
prefixed with `APP_URL` or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`; `public/sw.js` opens it
on a tap, a link off the app's origin (a workflow run on GitHub) in a new window. The `tag`
goes out as `webpush.notification.tag`, so a later push with the same tag replaces the one
still on the lock screen. A warning has one tag per kind; an event's tag also names its subject,
so two runs synced in one night stay two notifications. A forwarded operator alert keeps its
link and gets its tag prefixed with the sending profile.

| Push | Opens | Tag |
|------|-------|-----|
| A new run, its AI verdict, a new record | That run's page | `run:<id>`, `verdict:<id>`, `record:<distance>` |
| Shoe wear | `/shoes/<gearId>` | `shoe-wear:<gearId>` |
| A quartier past 90 % | The Activities map | `quartier:<unit id>` |
| The morning session, the Monday digest, the coaching-block reminder | `/plan` | `daily-session`, `weekly-digest`, `coach-block` |
| The Friday goal check-in | `/goals` | `weekly-goal` |
| An overreaching alert | `/analytics` | `overreaching` |
| A failed workflow | Its run on GitHub | `workflow-failure:<workflow>` |
| A token or the Garmin key about to expire, a refused nightly dispatch, a stale sync, the digest of phone errors | `/settings` | `token-expiry`, `garmin-key-expiry`, `sync-dispatch-refused`, `stale-sync`, `client-errors` |
| garth's token found expired | `/settings` | `connect-expired` |

## After garth

garth's OAuth1 token can no longer be minted (Garmin changed its login in March 2026) and dies
about a year after it was minted, on a date nothing can read. The Personal API key carries the
runs on; everything only Connect's private API serves stops.

**What the sync does the night the token dies.** `GarminClient` raises `GarminTokenExpired` when
Garmin answers the token exchange with a 401. A 403 (Cloudflare refusing a datacenter IP, as
when WARP is down), a 5xx or a network error stays a plain `GarminAuthError`: a partial night,
tried again tomorrow. On an expired token `sync.py`:

- writes `connect_status.json` as `{"state": "expired", "since": "<the day>"}` and keeps that
  day on later nights;
- carries on without Connect and exits 0, so the night is not partial and sends no failure push;
- stores new runs without `gearPending`, as no shoe will ever come for them;
- and the workflow skips *Sync shoes*, then, once the data commit has landed, posts the day to
  `POST /api/internal/connect-expired`. That route sends one operator push (`sendOpsPush`, so
  the second deployment's alert reaches the operator) with this runbook. The next night reads
  `expired` from the data repository and stays quiet.

Without a Personal API key nothing can read the runs, so the sync still stops with exit 1
after recording the expiry. A token that works again turns the file to `{"state": "active"}`;
a deployment that never lost Connect has no file.

**Runbook.** Confirm with `npm run coach:garmin-auth`. If a working way to mint a token exists
(see *Optional: the garth token* in README.md), put the new token in the profile's
`GARMIN_SECRET`; the next night records Connect active again. If not, leave `GARMIN_SECRET` as
it is: each night tries once, costs nothing, and Connect comes back on its own if it can.

**Readings mirrored from Connect stop at an age** (`src/domain/sync/garminReadings.ts`), so a
frozen file never reads as current. Training status counts for 3 days, then Today and the
overreaching push use the local estimate. Threshold pace counts for 8 weeks from the day it
last changed (in `threshold_history.json` or `athlete_history.json`), then the pace zones and
the coach use the VDOT estimate. Race predictions count for 14 days, then the Race page
estimates by VDOT, Records predicts by Riegel and Goals shows none.

### Sunset matrix

| Connect-only feature | Without Connect | Status |
|---|---|---|
| Runs, FIT tracks, HR zones, resting HR, other training, recovery | The Personal API | Covered |
| Lactate threshold HR | The Personal API's zone settings | Covered |
| VO₂max history | The runs' own FIT readings (`sync_vo2max_from_runs`) | Covered |
| Training status and load | The local TRIMP estimate after 3 days | Covered (G2) |
| Threshold pace and pace zones | The VDOT estimate after 8 weeks | Covered (G2) |
| Race predictions (Race, Records, Goals) | VDOT on Race, Riegel on Records, none on Goals after 14 days | Covered (G2) |
| Each run's shoe (`gearId`) | The default shoe, or the owner's pick on the run page | Covered (G3) |
| Shoe list (`shoes.json`) | The stored list, frozen; Shoes says since when | Partial (G3) |
| Garmin calendar (`planned_workouts/`) | The coach's plan on Plan; the morning push still reads the calendar | Partial (N8) |
| Upcoming races (`upcoming_races.json`) | The stored list, edited, hidden and added to in Settings → Races & goals | Covered (G4) |
| Coach workouts sent to the watch | None | Open: Run/Walk settings on Plan, then intervals.icu (G5) |
| Training load balance | The last stored day, frozen | No fallback |
| Garmin Coach plan (`training_plan.json`) | The last stored plan, frozen | No fallback |
| Fitness age history | The last stored values, frozen | No fallback |
| Sex, height, the watch | `athlete.json` as stored | Kept as stored |
| VO₂max norms | `vo2max_norms.json` as stored | Kept as stored |

## Garmin write path (coaching sync)

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

**The mapping travels like the plan.** `coach:sync-garmin` takes its data workspace
the way `coach --apply` does: an explicit `--data-dir` or `RUNOMICS_DATA_DIR` is the
operator's checkout, read and written in place, and the CLI reminds them to commit the
mapping. Otherwise, with `RUNOMICS_DATA_REPO_URL` set, it fetches the private data, and
`--apply` pushes the mapping back through the same base-revision guard once Garmin has
been written, including after a partial failure, since every operation's state is
persisted. A push refused after Garmin writes would lose the only record of those
workouts with the temporary workspace, so the mapping is first saved under
`.coach-previews/` to commit by hand.

**Payload mapping quirks.** Garmin stores a pace target as speed in m/s, so the conversion
inverts: the *faster* bound of a `paceSecPerKm` range (the smaller number of seconds)
becomes the *higher* speed. Garmin orders the pair low-to-high, so the slower pace lands
in `targetValueOne` and the faster in `targetValueTwo`. Garmin has no dedicated strides
step, so strides ride on `interval`, which preserves their repetition count, duration and
form cues where the plain `other` bucket would lose them. One target per step: a
prescription carrying both pace and heart rate keeps pace as the executed target and
preserves the HR bound in the step description. An easy, recovery or long run sends neither:
the pace guides it, so its paced steps drop the heart rate, and any line of its description,
notes or step notes that names a heart rate or zone stays off the watch. A step whose only
target is a heart-rate zone, as a return to running prescribes it, keeps it. A segment with no pace and no HR target
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

## Garmin-sourced series

Several repositories exist only to read what the Python sync writes, and each carries a
caveat worth knowing:

- **Athlete history** entries exist only for days a value actually moved — a change log, not
  a daily reading. Same for **threshold history**, where either field can be absent from a day.
- **Training status**: days before the watch had enough history come back as `no_status` with
  no ratio. They are not a reading, and returning one would make the app show a status Garmin
  itself declined to give. A watch that sends no loads or status at all (a Forerunner 55) gets
  both from the app's own TRIMP load instead: acute the last 7 days, chronic the 28-day weekly
  average, and the status Today already estimates, replayed day by day and marked "Estimated".
  The file's `checkedFrom` and `checkedThrough` mark the unbroken span from the first run that
  Garmin has answered, empty days included, so such a watch asks for the last week each night
  instead of every 28-day window since its first run. A window that fails stops the span before
  it, and a run older than `checkedFrom` drops the mark.
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
  `avgTemperature`, which is what the watch's wrist sensor read. A run's conditions name the sky
  from its WMO weather code, add the feels-like temperature only when it is 3 °C or more from
  the air's, and the humidity only from a dew point of 16 °C, about where runners feel the air
  as muggy.
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

## Official race results

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
