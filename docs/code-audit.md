# Code audit — RunOmics v3.1

A full-codebase audit across architecture, code smells, features, and the way
Firebase and the AI layer are managed, plus the action plan that follows from
it. The first tranche of that plan is already applied — see
[What this change fixes](#what-this-change-fixes).

Scope: ~60 000 lines of TypeScript/TSX across `src/`, the Python sync pipeline
in `scripts/`, the eight GitHub Actions workflows, the Firestore rules and the
build configuration.

---

## Method, and what it is worth

The codebase was swept along eighteen dimensions in parallel — architecture,
layering, Firebase client, Firebase Admin, Gemini/AI, Next.js App Router, API
routes, security, two passes of code smell, React quality, TypeScript, the data
layer, the coaching subsystem, performance, tests, the Python pipeline, i18n and
accessibility, and build/CI/dependencies. That produced **199 raw findings**: 8
critical, 64 high, 103 medium, 24 low.

**Those 199 are leads, not conclusions.** The adversarial verification pass that
was supposed to refute them never ran — every verifier hit an API session limit.
So the raw list is unfiltered and certainly contains mistakes: wrong line
numbers, deliberate trade-offs read as bugs, and things already handled
elsewhere.

What is trustworthy is narrower and stated plainly below: **every issue this
change touches was reproduced by hand first.** Where a bug could be executed, a
test was written that fails on the old code and passes on the new one, and that
is recorded per item. Where it could only be read, the reasoning is in the code
comment next to the fix. Two findings were investigated and **rejected** —
they are in [Investigated and not changed](#investigated-and-not-changed), with
the reasons.

Everything in [The remaining plan](#the-remaining-plan) is still at lead
quality. Confirm before acting.

---

## The shape of the codebase

The architecture is genuinely good, and worth saying so before the criticism.
`src/domain` holds pure logic, `src/application` the use cases, and
`src/infrastructure` the adapters; there are ports for the coaching slice; the
Firestore rules are versioned with a written rationale; there are 1 800 unit
tests, 350 pytest tests, a Playwright suite, axe smoke tests and a bundle
analyser. The code is unusually well commented, and the comments explain *why*.

The problems are of two kinds.

**First, the boundaries are conventions, not rules.** Nothing enforces the
layering, so it has drifted: `src/domain/activity/types.ts` imports
`lucide-react`, twelve domain modules import from `src/application/usecases`,
`src/app` reaches past the use cases into repositories seventeen times, and
`madge` reports import cycles. Each individual violation is small. Together they
mean the layer diagram describes an intention rather than the code.

**Second, and much more serious: the write paths assume everything succeeds.**
This is where all eight criticals live. The Python sync read its own history
files through `except Exception: return {}` and then rewrote them whole; the
Garmin workout sync kept its mapping in memory until the end of the loop; the
nightly workflow threw away a whole night's work if one activity failed. None of
these fail loudly. They fail silently, they are self-feeding, and the damage
they do is to the dataset itself — which, for history older than Garmin's
rolling window, has no other copy.

That second category is what this change is mostly about.

---

## What this change fixes

Twenty issues, all reproduced before being fixed. Grouped by why they matter.

### Silent, permanent data loss

**The history files were being shredded by their own error handling.**
`race_predictions.json`, `threshold_history.json`, `vo2max_history.json`,
`training_status.json`, `athlete_history.json` and `fitness_age_history.json` are
the only copy of everything older than Garmin's few-week window — built up one
nightly sync at a time over years. Every one was read through
`except Exception: return {}` and then rewritten wholesale. So any file that
failed to parse was silently treated as empty, that night's window was folded
in, and the result was written over the top. Years became weeks, with no error
and nothing left to restore from.

The write was the other half: a plain `Path.write_text` that is interrupted
leaves exactly the half-written file the reader could not parse. The failure fed
itself.

`scripts/repository/history_file.py` now holds both rules, and they only work
together: a file that is **absent** is empty, a file that is **present and
unreadable** raises and stops the sync rather than letting it overwrite from a
partial view; and every write goes through a temporary file and a rename, so the
torn state cannot arise. Nine call sites converted, 11 new tests.

**One failed activity threw away the entire night, forever.** `sync.py` isolates
each activity correctly and calls `store.save()` — but then returns exit 2 if
*any* activity failed. `Commit updated data` had no `if:`, so it was skipped, and
the successfully-synced data died with the runner. Because a malformed activity
fails deterministically, this repeats every night: a red scheduled run, no data
published, indefinitely. The sync step now records its status, the good data is
committed and deployed, and the run is failed at the very end instead.

**An interrupted `coach:sync-garmin --apply` duplicated the athlete's week.**
The mapping was accumulated in a local and returned only after the whole loop,
so a Ctrl-C after three of five workouts had already been created on Garmin left
no record of any of them. The next run created all five again, and the orphaned
first copies could never be deleted — `deletions()` only removes what the mapping
knows about. With the one-second pause between operations, that window is
seconds wide on every real run. The mapping is now checkpointed after each
mutation (the store's write is already a tmp+rename). 4 new tests.

**`--to` deleted the rest of the plan.** `selectSyncableWorkouts` honoured the
`--from`/`--to` window; `deletions()` did not. So every already-pushed workout
*outside* the window looked like a prescription that had left the plan:
`coach:sync-garmin -- --to 2026-09-12 --apply`, which reads as "only push up to
the 12th", unscheduled and deleted everything after it from the Garmin calendar.
Both now share one range. 3 new tests, one of which fails on the old code.

### Privacy and authorization

**Raw, un-cropped FIT files were being written into `public/`.** These are the
*source* binaries, holding every GPS sample including the ones inside the
privacy zone — `crop_privacy_zone` only ever runs on the derived route written
into `data/*.json`. Everything under `public/` is served as a static asset, so
any dev server or preview started from a synced workspace published the
unredacted GPS history at `/fit/<activityId>.fit`, and `/api/activities` hands
out the ids. The cache moved to `.fit-cache/`, and `verify_no_private_data.mjs`
now fails on a checkout still carrying the old directory.

*Not a production leak:* `/public/fit/` is gitignored, so it never reached
Vercel. The exposure was local dev servers, previews, and the Actions cache.

**Any visitor could dump every private training note.** `firestore.rules` said
`allow read: if true`, and in Firestore `read` grants both `get` and `list`. The
public per-activity note needs only `get`; the one caller that needs `list` is
the owner's own tag autocomplete, already gated behind `isOwner` in the UI. The
rule now says the same thing, and writes are shape- and size-checked against the
client's own limits.

**`/api/activities/export` was unauthenticated.** Settings only ever shows the
download behind `isOwner`, but the route had no guard — so the workbook, whose
Athlete sheet carries weight, BMI, resting and max heart rate, age, sex, VO2max
and fitness age, was one anonymous `GET` away. It is also the most expensive
thing the app does, rebuilt from the entire history through exceljs on every
request. Now behind `requireOwner`, checked before any work. 2 new tests.

**The private-data verifier was dead code.** `verify_no_private_data.mjs` is the
guard against committing the real dataset, a service-account key or an API key
into a repository whose entire privacy model is "the data lives somewhere else"
— and nothing ran it. It is now `npm run verify:private-data` and a CI step.

**The three reminder workflows were byte-identical** apart from a name, a cron,
an endpoint and a label — including the profile guard that keeps one athlete's
reminder off another athlete's deployment, triplicated. They now call one
`internal-notify.yml` via `workflow_call`: 126 lines of YAML become 44, and that
guard is defined once.

**A routine Google key rotation locked the owner out.** `verifyFirebaseIdToken`
cached the cert map for an hour and never refetched on an unknown `kid`. Google
rotates signing keys with an overlap, so a token signed with the new key arrives
while the old map is still valid — and that became "no matching Google
certificate" until the TTL ran down. It now refetches once per unknown kid per
cache generation, which fixes rotation without letting a forged token drive
traffic at Google. 2 new tests.

### Wrong data shown to the user

**Notes bled between activities.** `ActivityNav` moves between activity pages
with a `<Link>`, so `ActivityNotes` stays mounted and only its prop changes. The
Firestore read then `return`ed early when the new activity had no note — leaving
the *previous* activity's note in state, displayed under the new run's header,
and written to the new activity's document by the next save. Two concurrent
reads could also resolve out of order, and the slower one won. State is now
reset before each read and guarded against a stale response. The regression test
fails on the old code.

### Correctness of failure paths

**The Garmin bridge could not report its own death.** `spawn` announces a
missing interpreter asynchronously, and the `'error'` listener *threw* — into
the event loop, where no promise was waiting. "python3 is not installed" killed
the CLI with a stack trace that never mentioned Garmin. Closing stdout instead
is not enough either: readline's async iterator does not finish on a destroyed
input, so the read just hangs (verified — the first attempt at this fix timed
out). The bridge's death is now a promise every read races against. 3 new tests.

**Data files had three different opinions about failure.** Nineteen repositories
read the same kind of file; sixteen checked `existsSync`, ten wrapped
`JSON.parse`, and the two sets were not the same. A truncated `goals.json` threw
out of a server component and took the page down; a truncated `shoes.json`
quietly became `[]`. One `readJsonFile` now decides: degrade the section, and say
on the console which file was unreadable — the `catch {}` blocks it replaces made
corruption look exactly like absence. Net −60 lines, 12 new tests. Three readers
keep throwing on purpose and now say why.

### CI and supply chain

**`sync.yml` was command-injectable.** `${{ github.event.inputs.limit }}` — free
text, unlike the constrained `profile` choice — was interpolated straight into a
`run:` block holding `GARMIN_SECRET`, `PRIVACY_ZONES` and the data-repo token.
Actions substitutes that before bash parses the line. It now arrives via `env:`,
is rejected unless it is digits, and goes into an argv array. Every input
combination was tested against the real shell, including the injection.

**Three workflows put `INTERNAL_NOTIFY_SECRET` in curl's argv**, where any other
process on the runner can read it. `sync.yml` already passed it through `env:`;
the other three now match.

**`security-autofix.yml` pushed unreviewed dependency bumps straight to the
default branch.** It opens a pull request instead.

### Build correctness and bundle size

**The dashboard shipped a Node crypto polyfill.** `CelebrationOverlay` is a
client component and imported one number — `CELEBRATION_WINDOW_DAYS` — from
`domain/ai/pbCelebrationInsight`, which reaches `insightHash.ts` and its
`import { createHash } from 'crypto'`. Moving the constant and its shared
predicate to a leaf module took **473 KB out of the client chunks** (4 239 832 →
3 755 291 bytes, measured by building both ways), and no chunk contains
`createHash` or `sha256` any more.

**`npm run coach` was broken on Node 22.** Without `"type": "module"`, tsx
compiles these modules to CommonJS, and whether Node hoists their named exports
onto a dynamic-import namespace depends on cjs-module-lexer reading tsx's
output: Node 24 does, Node 22 hands back `{ default: exports }`. So
`new JsonCoachingRepository(...)` threw "is not a constructor" — while CI, pinned
to Node 24, stayed green. `scripts/interopImport.ts` normalises both shapes;
`engines` now states the floor.

**Two tests were failing on `main`, and had been since 00:12 UTC that day.**
`SyncNowCard`'s tests pinned `since` to a literal timestamp, and the card polls
until `since + POLL_CEILING_MS` against the real clock — so once the wall clock
passed it, the poll timed out before its first iteration and the timeout path
cleared the storage key the tests assert on. They would have failed on every run
from then on.

**ESLint linted a vendored bundle.** `public/maplibre/` only exists after a
build, so `npm run lint` said different things before and after one.

---

## Investigated and not changed

**`crop_privacy_zone` only trims the ends of a route.** A run that passes back
through the privacy zone mid-route keeps those points, and
`verify_privacy_zone.py` cannot detect it because it re-runs the very function
under test (`if crop_privacy_zone(route) != route`) — a tautology that prints OK
either way.

The trimming behaviour is deliberate and documented in the module header:
hiding only the start and finish is what keeps the map, recurring-routes and
territory features working on real route shape. Changing it means splitting a
route into segments, which changes `route: [number, number][] | null` in the
domain type and every renderer — too large to fold into this change, and a
product decision rather than a bug fix.

**The tautological verifier is a real defect and is in the plan below.** It
should assert directly that no point satisfies `_in_zone`, independently of the
cropping function. That is a small change and it belongs with whatever decision
is made about the cropping itself.

**The in-memory rate limiter in `internalAuth.ts` is near-useless on Vercel** —
each serverless instance has its own `Map`, and the key is a spoofable
`x-forwarded-for`. It also runs *before* the secret check, so an attacker can
fill the map. But the endpoints behind it are already gated by a shared secret,
the deployment is single-owner, and replacing it properly means a durable store.
Documented, not changed.

---

## The remaining plan

Unverified leads, ordered by what they would cost if true. Confirm each before
acting.

### 1. Finish the coaching subsystem's failure paths (highest value)

The same class of bug as the two criticals already fixed, in the same file.

- `verifyGarminSync` flips a result to `failed` but returns `report.state`
  untouched, so the entry still claims `scheduled` — the next run says "keep"
  and the athlete never gets that session.
- A partially-failed `removeManaged` (unschedule succeeded, delete threw) leaves
  the entry with a consumed schedule id, so every later run fails the same way
  and the Garmin workout is orphaned forever.
- The "retry a failed schedule" branch is checked *before* the content hash, so
  a changed prescription is scheduled against the stale Garmin workout while the
  state records the new hash.
- `block.endDate` is frozen at bootstrap and the 5-week cap counts merged
  history, so `REPLAN` on an aged plan always throws — the "rolling" plan cannot
  roll.
- Nothing ever sets a plan to `completed` or `superseded`, and bootstrap refuses
  while a plan exists, so no plan can be finished or replaced.
- `ADJUST`/`REPLAN` output bypasses the semantic guardrails bootstrap enforces,
  including the athlete's available weekdays, and workout identity comes from a
  model-supplied id — a hallucinated collision silently rewrites an unrelated
  prescription.

### 2. Notifications are lossier than they look

- All five notification routes commit their dedup state **before** sending the
  push, so any delivery failure loses that alert permanently.
- Disabling push notifications mints a token from a different service-worker
  registration, so the real token document is never deleted.
- The per-category toggles are `localStorage` decoration; the server broadcasts
  every category to every token.

### 3. Validate at the Python→TypeScript boundary

Twenty of twenty-two repositories assert unvalidated disk data straight into a
domain type. A renamed key on the Python side becomes an `undefined` that
white-screens a server-rendered page instead of an error naming the file. The
coaching slice already does this properly (`parseCoachingPlan`) — that pattern
should spread. Related: `Record<FiniteUnion, …>` lookups are the hole
`noUncheckedIndexedAccess` does not plug, so one new activity-type string from
the Python classifier takes out `/activities`, `/plan`, `/map` and `/analytics`.

### 4. Performance, in measured order

- Every activity detail page eagerly loads a ~629 KB Firebase auth+firestore
  chunk for a notes button almost no visitor can use.
- `/activities` and `/plan` serialize the entire activity history into the
  client — and `/api/activities`, which paginates properly, is dead code.
- `runHistory` re-sorts and re-scans the whole activity list *per activity*,
  making the AI insights route quadratic.
- `/api/map/routes` returns a whole cluster's full-precision routes in one
  uncacheable response.
- Recharts is eager on activity pages though analytics already lazy-loads it;
  `ChartStack` re-runs `cleanStream` on every pointermove; none of the ~20 chart
  components memoize.
- The dashboard awaits eleven independent use cases serially.

### 5. React correctness

Client components read the wall clock during render, so statically prerendered
HTML carries the build machine's "today" (`WeeklyStreakCard`, `PlanClient`,
`SeasonTimeline`, `WeeklyVolumeChart`, `ChartWindowNav`, `RecurringRoutes`,
`TodayHero`, `AnalyticsClient`). `useAccent` seeds state from `localStorage` in a
`useState` initializer, which mismatches on hydration in every accent-coloured
chart. `AppShell` serialises the whole scroll map to `sessionStorage` on every
scroll event. `useToast` never clears its timers. `ActivityMap` destroys and
rebuilds the whole MapLibre instance on each fullscreen toggle.

### 6. Make the boundaries real

Add `import/no-restricted-paths` zones to `eslint.config.mjs` and `madge
--circular` to CI, at `warn` with an allowlist first. Then burn it down: move
the output DTOs out of the use-case files into `src/domain` (which removes four
real import cycles), move `ACTIVITY_TYPE_ICONS`/`ACTIVITY_TYPE_CONFIG` out of
`src/domain/activity/types.ts` so the domain stops importing `lucide-react`, and
lift the 442 lines of budget/model-pool/retry orchestration out of the
`ai-insights` route handler into the application layer where it can be tested.

### 7. Close the test gaps that matter

`firestore.rules` is the only protection on the public Firestore surface and has
no automated verification of any kind — emulator tests would be the single
highest-value addition, and doubly so now the rules have been changed.
`scripts/sync.py`, the orchestrator that writes the canonical dataset, has no
pytest module. Coverage is configured blind to `src/app` and
`src/infrastructure`, has no thresholds, and is never run in CI. The e2e suite
has no auth-gated flow and never exercises an API route; its three "no runtime
error" assertions target a dev-only overlay and cannot fail in the production
build the suite runs.

### 8. Duplication worth collapsing

Eighteen chart files hand-roll `TooltipProps` + `CustomTooltip` while the shared
`SingleSeriesTooltip` written for exactly that is never imported. Shoe
aggregation maths appears three times; `paceSecPerKm` three times with two
different rounding behaviours; `isoDate`/`startOfWeek` are re-implemented in four
places and `DAY_MS` is redeclared fifteen times. Nine i18n keys are defined in
both locales and referenced nowhere.

### 9. Python pipeline robustness

`GarminClient` swallows 5xx on FIT, HR-zone and gear downloads, defeating
`retry_transient` and permanently persisting a GPS-less activity that is never
re-fetched. A transient failure fetching one workout detail permanently replaces
a complete planned-workout entry with a name-only stub. A corrupt month file
makes its activities silently disappear from the live site, because `_load` skips
it and `save()` rebuilds `index.json` from memory. There are three divergent
retry implementations; two of them do not retry 5xx or network errors at all.
Dependencies are unpinned `>=` ranges on `garth`, which the library itself now
reports as deprecated and unmaintained on every run.

### 10. Smaller things

- The week-purpose AI insight is generated and paid for on every cron run and no
  page reads it.
- Gemini's daily ledger is charged *before* the call and never refunded when
  Google refuses, so a retired model burns budget it never used — and every 429
  is read as "this model has spent its day".
- The AI rate-limit spacing is per-invocation only.
- The README's Features list is several versions stale: it omits the AI
  insights, the adaptive coach, shoes, the map, milestones, share cards, push
  notifications and the French locale, and still calls `/plan` "Calendar".
- Locale is a build-time constant (`NEXT_PUBLIC_LOCALE`), so language cannot be
  switched at runtime — including the French validators in `gemini.ts`.
- There are 13 `console.*` calls in 60 000 lines and no error reporting service:
  when something breaks in production, there is nothing to look at.
