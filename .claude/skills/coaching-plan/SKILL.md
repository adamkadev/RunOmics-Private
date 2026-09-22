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

The coaching CLI renders the whole prompt to a file, so no API key is involved:

```bash
npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5 \
  --guidance-file guidance.txt --prompt-out coach-prompt.md
```

That file carries the rules, the athlete's context and the answer schema. Answer
it with a single JSON object, save it, and feed it back:

```bash
npm run coach -- bootstrap --days ... --runs-per-week 5 --from-answer answer.json
```

A rejected plan rewrites the prompt with the reason attached, ready to answer
again. Apply the preview it prints with `npm run coach -- --apply <path>`.

Bootstrap refuses while a plan is active. Add `--replace` to supersede it; the
outgoing plan is kept under `coaching/superseded/<id>.json`, so rewriting a
block is reversible.

## The checks a plan must pass

Run them before showing a plan to anyone. They are cheap and they catch the
errors that matter.

- `validateDraftFrequency` - runs land on available weekdays, and the count
  matches `runsPerWeek` unless the week's focus explains otherwise.
- `validateDraftVolume` - four rules, in `src/application/coaching/volume.ts`:
  - **floor** `0.95 x baselineKm`, waived only if the focus names recovery,
    taper, cutback or deload
  - **ceiling** `1.05 x capacityKm + 3 km`
  - **ramp** no week above `blockPeak x 1.12 + 2 km`, where the peak is seeded
    from the athlete's own recent volume so the first week is checked too
  - **focus agreement** kilometres stated in the focus text must match the
    workouts
- `normalizeBootstrapPlan` - structural validity.

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
