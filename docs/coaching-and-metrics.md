# Coaching and metrics

How the coach plans, how a session is shaped, and how the training numbers and AI texts are worked out. Part of the implementation notes: see the [README](../README.md#implementation-notes).

## Coaching model

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

## The Plan's single workout shape

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

## Training metrics

- **Distance totals round once.** `sumDistanceKm` rounds the sum, not the parts — this is
  what keeps Progress, Goals and Analytics from disagreeing by a kilometre.
- **Easy/hard split** has one implementation, accepting anything carrying `hrZones`
  (`Activity` or the lighter `ActivitySummary`), so Today, Plan and Activities cannot diverge.
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

## AI insight generation

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
| What it powers | The deployed AI surfaces — Today, Season, Analytics, run verdicts, PB celebration, shoe verdicts | The adaptive coaching CLI (`npm run coach`), which runs locally today |
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

`CALL_TIMEOUT_MS` is 45s. Gemini 3.x cannot turn thinking off (2.5's `thinkingBudget: 0` does
not apply to this family), `'low'` is the floor, and it still spends real tokens on a
schema-constrained answer: a French one measured 23s live at 360 thinking tokens, where 15s
was aborting calls that would have succeeded seconds later. 3.8 Flash thinks for longer
still, and on Oct 10 2026 its calls ran into the 30s the limit was then, on every surface of
both syncs. A call that times out now hands the request to the next model in the pool, as a
503 does. 3.8 Flash also takes no sampling settings (`temperature`, `top_p` and `top_k` are
deprecated there), so `generateStructuredJson` sends a temperature only to the models before
it.

**A transient failure moves to the next model, not the next surface.** 429 and 404 mean that
model is done for the day, and the pool exists so the work can continue — but the loop used to
abandon the item and carry that recovery only as far as the *next* item's `reserve()`. With one
verdict pending, a single Google-side 503 therefore wasted an entire pass; two passes in a row
went that way before a run verdict finally landed. `generateFromPool()`
(`src/application/ai/insightPass.ts`, not the route handler any more) now retries the same
request on a different pool member, each member once and three at most, for anything
transient (500, 503, a timeout) or closed (429, 404). Once each, because with two models a third
attempt went straight back to the one that had just answered 503: in a day of Google's 503s
that third request was a third of the budget, spent for nothing. Copy the validator rejected is not retried: that is the documented
reject-and-requeue path, and spending a second model on it would buy nothing. Failing to
reserve at all is reported separately from a model failing, because only the former means the
caller should stop looping. The pool is the only retry: `generateInsight` sends one request
per call, so one reservation is one request against the day's quota.

**Model pool.** A model answering 429 has spent its day; one answering 404 has been retired
out from under us. Both mean stop asking and take the next in the pool. `reserve()` returning
null is ambiguous on its own — spent for the day, or out of this invocation's clock — so the
daily ledger is read back to let a stuck verdict name which. `GEMINI_MODEL` replaces the
*pool*, not the request, so what gets counted stays what gets called; overriding at the
transport layer would bill one model's ledger for another's call.

**Two pools, sized from the demand.** Free-tier quotas are per model, and Flash and Flash Lite
are not in the same league: Flash allows 20 requests a day, Lite 500. `MODEL_POOL` carries the
surfaces a reader actually looks at — `today`, a PB celebration, a shoe verdict or two, and
the verdicts for runs that just landed — which is a few calls a night. (The season headline and
the four Analytics tab cards were written here too until v4.16.4, long after v4.6 replaced them
on the page with the rule-based coach read.) The five passes per night do not
multiply that: once a surface's hash matches, the pass reports `unchanged` and spends nothing,
and the sync stops passing once one asks Gemini nothing (the day's ledger reads the same after
it as before).

**A sync with no new data still finishes the AI work.** The post-sync step used to run only on
a sync that brought new data. In Oct 2026 a run's verdict and Today's card met nothing but 503s,
which spent the day's budget; the next sync came before the quota's midnight-Pacific reset, and
the one after it brought no new activity, so nothing asked again. Now every sync that writes
anything - the timestamp alone included - runs the AI passes; with no new data it skips the
wait for the new deployment and the other checks, and a pass with nothing left to do costs a
few Firestore reads.
Four Flash models give it 72, five times its worst night: 3.8 and 3.6 Flash first, then 3 Flash
and 2.5 Flash, which joined in Oct 2026 with a free quota of their own and none of it used, after
a day Google answered 3.8 and 3.6 with nothing but 503s and a run's verdict had nowhere else to
go. 2.5 sets its thinking by a token budget (512, about what `'low'` spends here) where 3.x takes
a level. The pool also held 3.7 Flash, until Google retired it into 3.8: asked under
its old name it was 3.8 asked twice, paced and budgeted as if it were another model, so the
second ask came inside 3.8's minute and drew on its day.

`BACKFILL_POOL` carries the per-activity verdict queue, whose demand is not the one run a day
but the whole eligible history at once: any change to `runHistory` or the verdict facts moves
every hash, and the 90-day horizon plus the record holders is around 100 verdicts. Two Lite
models give it 996. What actually caps a pass there is the invocation clock rather than the
quota — `reserve()` stops handing out models 48s before the 280s ceiling, and at Lite's 5s
spacing that is roughly two dozen verdicts, which is what `DEFAULT_RUN_VERDICTS_PER_RUN` (24)
is set to.
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

- **Today's hero**: the tone badge, the kind of day (rest, easy, quality, race) and whether a
  run was logged today. A `go` line under a red badge, a rest-day line on race day, or "that was
  the window to use it" before the athlete has run, contradicts the card around it.
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

Run verdicts are gated by `deservesVerdict` — generating one for every run ever synced spends the
day's quota on pages nobody opens. A run that already has a cached verdict keeps it either way.
