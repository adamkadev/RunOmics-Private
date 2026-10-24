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

`scripts/loadPalette.mjs` stages `src/lib/<entry>.ts` for use from plain Node. Every
module it is asked to load must be alias-free (`./x`, never `@/x`), and dependencies
must be listed before the modules that import them.

The concurrency check runs *before* the workspace replaces the clone's `data/`, so a
refusal leaves both the clone and the remote untouched.

`scripts/loadPalette.mjs` stages `src/lib/<entry>.ts` for use from plain Node. Every
module it is asked to load must be alias-free (`./x`, never `@/x`), and dependencies
must be listed before the modules that import them.

## Reading the data at run time

With `RUNOMICS_DATA_SOURCE=github` on Vercel, a deployment reads its data
repository through GitHub's API instead of the copy its build cloned, so a sync
shows in about the time the sync takes, with no rebuild. The data repository
stays the only copy: every writer pushes to it as before.

- **Each page and route that reads data awaits `loadData()` first.** It asks
  GitHub for HEAD (cached ten minutes, tagged), and when HEAD moved it reads the
  commit's tree and the files that changed, then swaps the new commit in whole.
  `npm run check:cycles` fails on a page or route that reads data without it.
- **The sync expires that cache** with `POST /api/internal/data-revalidate`
  instead of firing the deploy hook, when its GitHub Environment sets
  `DATA_SOURCE=github`, then waits a few seconds rather than minutes for health
  to report the new sync.
- **A commit is checked before it goes live,** with the same data contract the
  build ran. A refused commit leaves the previous one serving, and health
  reports it as `rejectedData`, which fails the sync.
- **If GitHub is unreachable,** an instance keeps serving the commit it has;
  a new one cannot start serving and answers with an error, and cached pages
  stay up.
- **Local runs never read GitHub:** the mode needs `VERCEL=1`, and the build
  reads its clone, so dev, E2E and the CLIs work from files as before.

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

## Garmin-sourced series

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
