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

## Controlled threshold

**Heart-rate targets come from the athlete's own LTHR, never from rules written for one
runner.** A repetition's ceiling is LTHR − 6 bpm, which keeps it under threshold; where its
heart rate should settle is 4 bpm under the ceiling for a long repetition (7.5 min or more) and
2 bpm under for a medium (4 min or more) or short one. Without an LTHR no controlled threshold
session is written at all: a %HRmax zone floor is not a threshold, and a ceiling guessed from
one would be the wrong number with the confidence of a right one. The offsets, the dose limits
and the autoregulation settings are coaching conventions kept together in `CONTROLLED_THRESHOLD`
(`src/application/coaching/controlledThreshold.ts`) and labelled as such in the coaching
methodology.

**The planner is told this athlete's numbers, not the rules' constants.** The context's
`controlledThreshold` carries the heart rates above, the full week the dose stops growing at (two
sessions of 30 minutes, in a week of the best 4-week average ± 1 km) and the guide for short
repetitions: a 5 s/km band from threshold pace rounded down to the next 5 s. It is null without
an LTHR, and the context then holds no controlled threshold facts for the planner to use.

**The full week grows between blocks, never inside one.** `blockGrowth()`
(`src/application/coaching/blockGrowth.ts`) reads the block being renewed: its heaviest week
holding both 30-minute sessions is the level, and the new block's full week is 5% above it when
the block ran at least 21 days with no injury, illness or pregnancy break, no 7 days without a
run, no illness check-in or skip, no niggle on 3 or more days, at pain 4 or more or changing a
run in the last four weeks, and no easy-run fatigue flag. Otherwise it holds that level, as it
does where the grown week would pass the volume ceiling, the block-opening ramp or the long-run
limit; unreadable check-ins also hold it. The planner reads `fullWeek.growth` as grown, held with
the reason, or baseline (no earlier full week, so the best 4-week average), and `weekKm` never
passes what the validators accept. The threshold dose does not grow: a guide gets faster only
from two agreeing sessions or a 5K check, which a new block stores as `block.guideProposals`.
Plan shows the open ones under the phase card, and bootstrap refuses a plan focus that leaves an
open one unnamed.

**A session is judged against the ceiling it prescribed,** which is what the watch held the
athlete to, not today's LTHR. Heart rate lags a change of pace, so each repetition is read from
minute 3 to its end. Over: a repetition past its target or touching the ceiling without having
run faster than the guide (easing off on a hot day still reads as over). Under: every repetition
5 bpm or more under its target at the guide. Off guide: run more than 3 s/km away from the guide,
which says nothing about the guide. Two sessions of one class in a row that agree, both under or
both over, propose a 3-5 s/km change to its guide. A run's page shows each
repetition's heart rate against its target and ceiling with the verdict. `npm run coach -- autoregulate`
prints the sessions, the proposals, the easy-run fatigue flag (an easy run 5 bpm over the
recent normal at a similar pace, temperature and duration; pace is grade-adjusted where both
runs carry it, and a run climbing 15 m/km or more without it is left out, since walked climbs
slow its pace more than its effort) and the 5K check.

## The 12-week checkpoint

**Cycles count in the Plan's Monday weeks from the coach's macrocycle start** (`macrocycleStartDate`,
else the block's start), 12 weeks each, so "week 7 of 12" on the checkpoint is the week Plan
shows. A cycle that has just ended stays under review through the first week of the next, so
its result is there to read on the Monday it closes. With no coach plan, or a start still in
the future, the page compares the last 12 complete weeks with the 12 before (`rolling`), with no
week to mark. Plan names the stretch general preparation when the macrocycle has no race.

**Each row compares the two cycles the same way, and says nothing it cannot measure.** A group
is left out when the athlete's history has nothing to fill it, and a side with no reading says
so rather than show a zero.

- **Km and runs a week** count whole Monday-to-Sunday weeks only, from the week of the first run
  on: a Monday morning never reads as a light week, and weeks before the watch was worn are not
  zeros.
- **Controlled threshold time a week** is the minutes of repetitions read from the sessions the
  plans prescribed, per counted week; while the cycle runs, the time and sessions so far are
  shown too. **Pace guides** are the latest guide run in each repetition class.
- **Efficiency** is the heat-adjusted metres per heartbeat of the easy runs (Base, 3 km or more,
  with pace and heart rate), three runs at least.
- **Easy-run heart rate at a set pace**: the reference pace is the median easy pace of both
  cycles together, to the nearest 5 s; each cycle's figure is the median heat-adjusted heart rate
  of its easy runs within 10 s/km of it, three at least. A fit across all paces swung with every
  hill.
- **The 5K check** is the latest run of 4.9 to 5.3 km that was a race or prescribed as one, at its
  chip time when an official 5 km result exists, with the VDOT it implies.
- **VO₂max, threshold pace and LTHR** are Garmin's latest reading on or before each cycle's last
  day: an estimate holds until the watch revises it. Garmin's monthly and daily VO₂max series
  are merged, since the daily one alone starts too late for an older cycle.
- **Resting heart rate** is the cycle's mean, seven days at least; **fitness** is CTL on each
  cycle's last day (today while it runs).

Better, worse and level come from the same `deltaTone` bands as every other delta in the app, so
a change too small to mean anything reads level (for instance under 2% of km, under 3 s/km of
pace, under 1 bpm of resting heart rate). Threshold heart rate has no better direction and is
not counted in the tally.

## The Plan's single workout shape

The Plan has exactly one workout presentation (`PlannedWorkoutCard`) and it must not care where a session came from. A Garmin planned
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
- **TRIMP follows the athlete's sex.** Banister's TRIMP weights heart-rate reserve by
  0.64·e^(1.92·HRR) for men and 0.86·e^(1.67·HRR) for women, whose lactate rises less steeply
  with effort. `athlete.json` `sex: "female"` picks the second through `HrBounds`; anything else,
  or no `sex`, keeps the first. Every load built from TRIMP (fitness, fatigue, form, ACWR,
  the planned-session estimates and the workbook) moves with it.
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
  paginated API response ever ships per-sample arrays to the client. `toActivitySummary()` drops
  the route, sample and split arrays that make up most of an activity's weight; anything
  crossing the server/client boundary for a list row or card should go through it first.
- **Other training is never an `Activity`.** Strength, cycling and the rest are
  `CrossTrainingSession`s in their own store, so no load, volume, record or running trend can
  count one. The list and calendar get `CrossTrainingEntry` (kind, duration, distance, set count:
  heart rate and load stay on the server); the coach gets `otherTraining`, the minutes of the
  last 7 and 28 days and each session of the 28, which is null without one, so a context with
  none reads and hashes as before. The Monday digest adds last week's time to its volume line.
- **`RACE_DISTANCE_KM` lives in the domain** (`src/domain/race/distances.ts`), not beside a use case, because the charts need
  the kilometre table at render time and importing it from the use case would drag the
  `fs`-backed repository into the client bundle.

## Pace curve and grade-adjusted pace

**The pace curve is the best of each duration, from the full recording.** Each run stores the
most metres it covered in 30 s to 2 h (see [What a sync writes](data-and-sync.md#what-a-sync-writes));
Analytics › Performance draws, for each duration, the fastest any run of the window held, against
the window before.

**Critical speed** is fitted to the window's 3, 5, 10 and 20 minute bests by least squares on
distance = CS × time + D′, the two-parameter model of Monod & Scherrer (1965); Jones et al. (2010)
and Poole et al. (2016) set out CS as the boundary between heavy and severe exercise, which is why
it sits close to, usually a little faster than, threshold pace. Shorter bests lean on sprint
speed and longer ones on a fatigue the model leaves out, so only 3-20 min are used. A fit is shown
only when all four bests exist, D′ is between 0 and 600 m, CS is between 1.5 and 7 m/s, and the
standard error of the slope is under 2% of CS: past that the bests mix all-out and easy efforts
(a test run beside a jog fitted 5% on real data). The card sets CS against the watch's threshold
pace on the window's last day; well slower means the bests were not all-out.

**Grade-adjusted pace** counts each step as the metres of flat running that would cost the same
energy, by the polynomial of Minetti et al. (2002) for the energy cost of running against gradient.
The gradient is rise over run across the 60 m around each sample (no less than 20 m at the ends),
clamped to ±25%: steeper is hiking, where Minetti's data thin out and a barometer step reads as a
cliff. The cost curve is convex, so altitude noise would turn into speed: a run whose altitude
wanders more than 1 m RMS about its own 100 m mean gets no GAP. That is what keeps GPS-only
altitude (a Forerunner 55's jitters metres) out while a barometric one (under 0.6 m) passes; a
run with under half its samples carrying altitude gets none either. The app shows GAP only on a
run that climbed 5 m a km or more: below that it moved none of 192 runs by 3 s/km.

## VDOT fallbacks

**A watch with no threshold pace still gets pace zones.** The Athlete page and a run's pace
chart then take threshold pace from the best recent effort: over the last 120 days, the
best-effort distance from 1.5 km up (Daniels' tables start there; a shorter effort leans on
anaerobic capacity) whose time implies the highest VDOT, credited at its chip time when an
official result covers it. Threshold pace is Daniels' T, the speed whose oxygen cost is 88% of
that VDOT. The zones are marked as estimated and name the effort they stand on.

**The Race page does the same when Garmin's predictions are missing or two weeks old** (garth
reads the series daily, so a fortnight without a day means it has stopped): the prediction is
the time at the race distance that implies the same VDOT, and the 12-week trend is that estimate
as it stood each week, so the line moves only when a better effort was run or one aged out.

## Morning check-in

**Four scores, one tap each, 5 always the best:** sleep, soreness, stress and mood on 1-5, after
McLean et al.'s wellness questionnaire; then an optional niggle (site, side, pain 0-10, and
whether it changes today's run) and illness or travel. Any answer may be left out. Firestore
keeps one document per local date in `wellness`, and every read goes through `readCheckIn`, so a
malformed field is dropped rather than shown or sent to the coach.

**Only a recognised reason to ease off tempers the readiness card.** Illness or pain of 7 or more
turns it to rest; pain of 4 to 6, a niggle the athlete says changes the run, or sleep 2 or less
with soreness 2 or less turns it amber, and the card says why. A merely flat morning changes
nothing. These cut-offs are a convention: 4-6 and 7-10 are the numeric pain scale's usual moderate
and severe bands, not a validated running threshold.

**Health data stays the owner's.** The check-in card and the Athlete page's four weeks of mornings
and twelve weeks of niggles are read from Firestore by the owner's own browser after sign-in, under
owner-only rules: no server render reads them, so a page's HTML, which every viewer gets, never
carries one. The coach reads the last 28 days of check-ins and 84 days of niggle episodes (a gap
of up to three unreported days is still the same niggle) through the Admin SDK, with the nightly
`wellness.json` as its fallback.

**A skipped session lives on its day.** A missed session marked skipped on Plan (ill, rest or
life) is a `skipped` field on that day's `wellness` document, beside the check-in: Today, Plan's
week and month draw the day as rest, and the coach reads the reason with the check-ins. Marks an
older build kept in one browser's `localStorage` move there once, as rest, when the owner next
opens Today or Plan.

## The heat line

On a warm day Today's session says what the forecast will cost: "29 °C at 19:00 - your runs at
this heat cost about +14 s/km: run by heart rate". The line appears only when every link holds:

- **A cost from the athlete's own runs.** The heat cost bands easy runs (Base, 3 km or more, with
  weather) by feels-like temperature: under 5, 15, 20 and 25 °C, and hotter. Only the warm (20-25
  °C) and hot bands count, each with eight runs at least and a cost of 5 s/km or more, which is
  about an easy run's day-to-day spread.
- **The usual hour.** The median start of the last 20 runs, within the part of the day Garmin's
  calendar planned the session for when it names one (morning 5-12, afternoon 12-17, evening
  17-22, night 22-05), else that part's default hour.
- **The forecast there and then.** Open-Meteo's hourly feels-like temperature at the median start
  of those runs, rounded to 0.1° as the sync rounds a run's weather, in the athlete's time zone;
  2.5 s at most, cached for the page's hour, and no line rather than a slow page.
- **A warm band at that hour.** The cost shown is that band's.

## Explore loops

**A generated loop has a climb budget for the day's session**, in metres of climb per km of loop as
ORS's elevation model measures it on the planned loop. Past
the budget each m/km costs 0.2 in the loop's score, so 3 m/km over outweighs all the new ground a loop
can bring: an over-budget loop loses to an in-budget one with less new ground, yet a hilly area still
yields a loop. The session is the coach plan's for the day, else Garmin's planned workout; with none
it is scored as an easy run.

| Session | Budget | Also |
|---|---|---|
| Quality (controlled threshold, threshold, tempo, intervals) | flat, as "Flat for the reps" | |
| The day before a quality session | ≤ 12 m/km | |
| Recovery run | ≤ 12 m/km | |
| Long run | ≤ 15 m/km | steep descents (7 % or more) scored like steep climbs |
| Easy run, or no session | ≤ 20 m/km | |

These are [convention], not research thresholds. The reasoning behind them: walking grades steeper
than about 15-20 % costs about as much energy as running them (Minetti et al. 2002's cost curves), so
an easy run up them turns into a hike or leaves zone 2; downhill running's eccentric damage peaks 24-48 h
later, when it would land on the next quality session, hence the long run's descents and the flat day
before reps; and the goal race, a road half marathon, favours runnable terrain for most easy volume.
The panel names the budget and each loop's m/km against it, and on an easy, recovery or long run a loop
with 200 m or more at 10 % or steeper says to walk the steep climbs.

**Trails are open in daylight, on any day.** The owner judges whether a forest loop suits
the day, a quality day or the day before one included, so a loop's share on trails (steps, soft ground,
and paths or tracks without a paved surface) costs nothing in daylight. When the run, timed from now (or,
for a later day's plan, from the athlete's usual start hour) at the easy pace, would start before sunrise
or end within 15 minutes of sunset, trails cost 6, ten times what new ground can earn (0.6), whatever the
toggles, and the panel says the loop keeps to streets. These weights are [convention] too, set against a forest loop of 25 October 2026: 13.3 km, 407 m
of DEM climb, muddy and steep, run into the dusk the day the clocks went back.

## AI insight generation

**The coach runs through Claude Code; the app's copy runs through Gemini.** Every coach
command writes its prompt to a file by default (the manual path: `--prompt-out` /
`--from-answer`, see the [README](../README.md#adaptive-coach)), and the reply is held to
the same validators. `GEMINI_API_KEY` stays the app's, for the deployed AI surfaces below.

**Gemini for coaching is opt-in, and bills its own Google project.** With `--advisor gemini`
the coach reads `GEMINI_COACH_API_KEY` and never falls back to `GEMINI_API_KEY`: a fallback would silently spend the general AI
surfaces' free-tier quota on a coaching generation, merging two quotas that are kept apart
on purpose. The key is therefore *passed into* the shared transport rather than read from
the environment by it — a transport that picked its own key would quietly merge them again.
Credential resolution stays with each adapter, alongside its domain-specific validation.
There is no fallback in either direction: neither key ever stands in for the other.

**Where each key has to exist** follows from where its code runs:

| | `GEMINI_API_KEY` | `GEMINI_COACH_API_KEY` |
|---|---|---|
| What it powers | The deployed AI surfaces — Today, Season, Analytics, run verdicts, PB celebration, shoe verdicts | The coaching CLI's `--advisor gemini` (`npm run coach`), which runs locally; the default manual path needs no key |
| Local env file | yes, in `.env.local` | only for `--advisor gemini`, in the coach's `.env.<profile>.local` |
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
main *pool* and `GEMINI_BACKFILL_MODEL` the backfill one, not the request, so what gets counted
stays what gets called; overriding at the transport layer would bill one model's ledger for
another's call. They are separate because the pools are: one Flash model standing in for the
Lite pool would spend its 20 requests a day on the backfill.

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
Three Flash models give it 54, nearly four times its worst night: 3.8 and 3.6 Flash first, then
3 Flash, which joined in Oct 2026 with a free quota of its own and none of it used, after a day
Google answered 3.8 and 3.6 with nothing but 503s and a run's verdict had nowhere else to go. 2.5
Flash joined with it and left again: Google serves it only to accounts that used it before, and
answers others with a 404. The pool also held 3.7 Flash, until Google retired it into 3.8: asked under
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

**A retired model is not silent.** Every pass but a `?limit=0` one keeps its status in Firestore
`aiStatus/lastPass`: when it ran, how much it wrote, how much it left (`missed`: a surface or a
verdict it tried and could not write), and each model Google closed during it (429 or 404) with
its answer. Health reports it as `ai` and Settings → Diagnostics shows it above the scheduled
jobs. A pass that writes nothing while it missed something adds its UTC date to `idleDays`; any
pass that writes something, or finds nothing left to write, clears it. On the third idle night
the route sends one operator push (`sendOpsPush`, tag `ai-idle`) naming the closed models, and
no other until a pass writes again: until then every card shows its rule-based copy.

**Ordering.** Verdicts for runs that just landed are written before any other surface — behind
the other ten, the one insight the athlete is waiting for is the first thing the quota or the
clock drops. The rest is priority order, tail last, since what one run cuts off the next picks
up. `?limit=0` reports the backlog without spending; an *absent* `?limit=` must not collapse
into that, because the sync workflow omits the param and `Number(null)` is 0 — hence the
explicit null check before any numeric conversion. `?all=1` lifts the recency horizon for a
manual pass over the archive after a reprocess; the nightly sync never sends it.

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
it. `listCachedKeys` needs the hash rather than mere presence — an entry written from facts
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

Failures are reported, never swallowed: this runs unattended from the nightly sync workflow, where
a silent null looks identical whether the quota ran out, the model was retired, or the copy came
back too long. The same reasoning covers `/api/internal/*` generally — every throw is logged with
the route name and returned as a 500 the workflow run can surface, and the guard rate-limits
*before* checking the shared secret so failed auth attempts are throttled too.

Thinking models put reasoning parts alongside the answer and not always last, so the response
parser takes the first part that actually carries text.

Run verdicts are gated by `deservesVerdict` — generating one for every run ever synced spends the
day's quota on pages nobody opens. A run that already has a cached verdict keeps it either way.
