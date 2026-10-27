---
name: coaching-plan
description: Write or review a RunOmics training block - the rolling four-week plan the coaching pipeline produces. Use when generating a plan from a dumped coaching prompt, reviewing a plan a chat returned, changing the coaching rules, or answering a training-methodology question about this athlete. Covers the rules the planner must follow, the evidence behind them, and the validators a plan has to pass.
---

# Writing a training block

The plan is a rolling four-week block, regenerated about monthly rather than
written once for a season. Later weeks are set from the athlete's state today,
so planning further ahead is guessing about a state that has not happened.

## What to read, and when

| File | When |
| --- | --- |
| `rules.md` | Always. It is the normative list, and it generates the planner's system instruction. |
| `references/methodology.md` | Changing a rule, or asked why a rule exists. Carries the evidence label for each. |

## Generating a block

Every coach command renders the whole prompt to a file by default (`.coach-previews/coach-prompt.md`
without `--prompt-out`), so no API key is involved; `--advisor gemini` is the opt-in exception:

```bash
npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5 \
  --guidance-file guidance.txt --prompt-out coach-prompt.md
```

Without `--guidance-file`, bootstrap reads `coaching/guidance.md` from the data
workspace, so what one block was told carries to the next; the decision records its
hash. Keep an athlete's standing instructions there, such as a clinician's limits
during a return to running.

That file carries the rules, the athlete's context and the answer schema. Answer
it with a single JSON object, save it, and feed it back:

```bash
npm run coach -- bootstrap --days ... --runs-per-week 5 --from-answer answer.json
```

A rejected plan rewrites the prompt with the reason attached, ready to answer
again. Apply the preview it prints with `npm run coach -- --apply <path>`.

`weekly-review` and `evaluate --activity <id|latest>` work the same way: the prompt
asks for a KEEP, ADJUST or REPLAN recommendation, gives the weeks left in the block
up to its end date, and a rejected answer comes back with the reason.

Add `--general` for a block written toward no race: the full four weeks, base
rules throughout, and any race inside it run as a supporting one. It is also
what bootstrap does when no race is registered. Consecutive general blocks
share one macrocycle start; marking a race primary later opens a fresh run-up.

`--start <monday>` writes the block from a Monday at most a week out and keeps
the current plan's sessions until then exactly as written.

After each controlled threshold session, `npm run coach -- autoregulate` reads the runs against the
heart-rate targets: a pace-guide change when two sessions of one repetition
length agree, a lighter week when easy-run heart rate sits 5+ bpm above the
recent normal at similar pace (grade-adjusted where the runs carry it) and
temperature, and the latest 5K check. It
writes previews and applies nothing. Every threshold it and the controlled threshold dose
checks use is in `src/application/coaching/controlledThreshold.ts`.

A session is read against targets set under the ceiling it prescribed (4 bpm
for long repetitions, 2 for shorter ones), since that is what the watch held
the athlete to. What a new block is told comes from the athlete's own data, in
`context.controlledThreshold`: the ceiling 6 bpm under the LTHR, the full week
at about the best four-week average, and the short-repetition guide in the
5 s/km band that holds threshold pace. The rules carry no athlete's numbers.

The full week grows between blocks, never inside one. `fullWeek.growth` compares the
new block with the full week `currentPlan` reached: `grown` when that block ran through
without a break, about 5% more, all of it easy running and the long run; `held`, with
the reason, after a gap, an illness or injury, a niggle, a fatigue flag, or where the
volume ceiling, the ramp or the long-run limit would refuse the grown week; `baseline`
when no earlier block reached the full week. A 50 km full week renewed after a clean
block becomes about 52.5 km, the two 30-minute sessions unchanged and the extra in the
easy runs and the long run; renewed after a week of illness it stays at 50 km or less.
The threshold dose never grows: a guide gets faster only from two agreeing sessions or
a 5K check. A new block stores the open proposals in `block.guideProposals`, the app
shows their guides on Plan, and the plan focus names each without a pace, so the athlete
can accept it in the guidance at the next block.
An athlete without an LTHR - a Forerunner 55 has no lactate threshold
detection, and %HRmax zones are no threshold - gets no controlled threshold
sessions: the context says null and the rules keep threshold work pace-led.

Bootstrap refuses while a plan is active. Add `--replace` to supersede it; the
outgoing plan is kept under `coaching/superseded/<id>.json`, so rewriting a
block is reversible.

## The checks a plan must pass

Run them before showing a plan to anyone. They are cheap and they catch the
errors that matter. `src/application/coaching/draftRules.ts` is the one place
that calls them: `validateBootstrapDraft` runs every one below, in this order,
on each answer, and a rejection is sent back to the planner to correct. The
advisors only build the prompt and read the answer.

- `validateWorkoutDraft` - how each session is written, in `draftRules.ts`:
  strides as a repeat group with recovery, timed and without an HR target;
  hill efforts by effort rather than pace; "progressive" only when the
  targets actually progress.
- `validateDraftFrequency` - one run per day, and the count matches
  `runsPerWeek` unless the week's focus explains otherwise.
- `validateDraftVolume` - four rules, in `src/application/coaching/volume.ts`:
  - **floor** `0.95 x baselineKm`, waived only if the focus names recovery,
    taper, cutback or deload
  - **ceiling** `1.05 x capacityKm + 3 km`
  - **ramp** no week above `blockPeak x 1.12 + 2 km`, where the peak is seeded
    from the athlete's own recent volume so the first week is checked too
  - **focus agreement** kilometres stated in the focus text must match the
    workouts
- `validateDraftIntensity` - in `intensity.ts`: threshold and interval caps,
  pace held across the block, time at threshold progressing.
- `validateBootstrapDraftSemantics` - the races: recovery after one, nothing
  hard just before a tune-up, and no invented finish times.
- `validateAvailableWeekdays` - every run lands on an available weekday.
- `validateDraftNames` - in `workoutNames.ts`, last because a name is the
  cheapest thing to correct: "Threshold · 3 × 8′ @ 4:25", at most 28
  characters, × and ′, no " - ", no total distance or duration, a pace and
  a repetition count the blocks actually prescribe; a `shortName` of at most
  18 on every workout, and a `structure` that agrees with the blocks.
- `normalizeBootstrapPlan` - structural validity.

A change to the live plan - an `ADJUST` or `REPLAN` from `evaluate` or
`weekly-review` - goes through `validateAdaptation`, measured on the plan it
would produce. Every session it adds or rewrites must be written as above
and land on an available weekday, with one run a day and no week pushed past
`runsPerWeek`. It may always take load away; whatever it adds must fit the
volume ceiling, long-session and ramp bounds and the intensity caps and pace
hold, judged only on the weeks it added to. A title it writes follows the
naming rules; one the plan already held is kept as it was written. The
floor, the reduced-week rules, the "fewer runs" explanation, threshold
progression and the race rules stay with bootstrap: they refuse exactly the
easing an adaptation is for.

`weekKm` converts a timed segment to distance through its pace, so a week
counted from `distanceMeters` alone reads lighter than it trains.

## What goes wrong

Four failures, each of which has actually happened here:

**Anchoring on the 28-day mean.** A mean over a window containing an absence
cannot tell "did not run" from "cannot run". Read
`trainingHistory.weeklySeries` for the shape, not just the averages. This
produced a 22 km week for a 45 km runner.

**Threshold volume that does not progress.** A block going 4.8, 4.0, 3.6,
4.8 km of threshold develops nothing - week four merely returns to week one.
Progress by repetition count first, then repetition length, holding pace fixed.

**A cutback that is not one.** A 4% reduction labelled "cutback" claims an
exemption it has not earned and switches off the volume floor. A real cutback
is 15-20% below the block's peak.

**Pace drift.** The documented failure of controlled-intensity training is reps
creeping faster week to week until a sub-threshold block is three threshold
sessions. A faster week is a violation, not progress.

## Worked block

For an athlete at 45 km last week, best four-week average 57.35 km, five
running days, threshold 4:23/km:

| Week | km | Threshold | Long run |
| --- | --- | --- | --- |
| 1 | 46.5 | 3 x 1600 m | 15 km |
| 2 | 50.5 | 4 x 1600 m | 16 km |
| 3 | 42.0 | 3 x 1600 m | 13 km (cutback, -17%) |
| 4 | 52.4 | 3 x 2000 m | 18 km |

Quality on Tuesday and Thursday, 48 hours apart, never three sessions a week at
this volume. Every threshold repetition at the same pace all block; only the
count and then the length move.

## Changing a rule

`rules.md` is the source. Edit a bullet, then:

```bash
npm run build:coaching-rules
```

That regenerates `src/infrastructure/ai/coachingRules.generated.ts`, which is
what the prompt sends. A test fails if the two drift. Bullets are joined in
document order, so reordering changes what the planner is told.

Before adding a rule, check `references/methodology.md` for whether the claim
survives - the "Claims to refuse" section lists the ones that do not, including
the 10% rule, ACWR gating, 40-60% deloads and 220-age heart rates.
