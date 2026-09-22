# Coaching rules

The rules the planner must follow when writing a training block. This file is the
source: `npm run build:coaching-rules` turns it into
`src/infrastructure/ai/coachingRules.generated.ts`, which is what the coaching prompt
actually sends. Edit here, never there, and a test fails if the two disagree.

Every bullet below is one instruction. They are joined with single spaces in document
order, so reordering or rewording a bullet changes what the model is told - which is the
point, but do it deliberately and rerun the generator.

The reasoning behind these rules, and the training science they came from, is in
`SKILL.md` and `references/`. This file is only the normative list.


## Scope

- Create a conservative running prescription for the supplied planning period.

## Frequency and rest days

- Available weekdays are scheduling opportunities, never a frequency setting.
- Follow runsPerWeek as the normal desired frequency, including race runs.
- Recovery, taper, fatigue, illness or injury may justify fewer runs; in that case week.focus must explicitly say "fewer runs" and explain the specific reason.
- Normal weeks target the requested number, but runsPerWeek is a preference, never a mandatory quota.
- Prefer fewer runs during taper when matching the count would create unnecessary consecutive running.
- For an explicitly targeted Saturday race, prefer Sunday easy, Tuesday easy plus strides/light sharpening, Wednesday rest, Thursday short easy shakeout, Friday rest, Saturday race; four runs including the race is a preferred taper exception when normal frequency is five.

## Weekly volume and where it goes

- Avoid three consecutive running days within the final four days before an explicitly targeted race.
- Plan the aerobic volume trajectory separately from the quality-session choice.
- Adding one limited 5K-specific session must not automatically turn its whole week into a cutback.
- After immediate post-race recovery, use demonstrated sustained historical capacity to avoid unnecessary under-prescription, while recent load and adaptation still set the starting point.
- A non-taper build week should normally maintain or modestly increase aerobic volume versus the preceding build week; explain a decrease with specific recovery/load evidence rather than the mere presence of intervals.
- Supply remaining volume through easy/recovery running or easy warmup/cooldown only, never another quality workout or a faster long-run finish.
- Preserve race-week rest days and reduce volume through shorter easy runs, not a frequency quota.
- Historical capacity remains context, never a compulsory immediate target.
- Specify distanceMeters for aerobic running blocks where practical so weekly volume is reviewable.
- No single session may exceed the longest run of trainingHistory.longestRunLast30DaysKm by more than a tenth, nor take more than about 30 per cent of a full week at that volume; a correct weekly total says nothing about one outsized run hidden inside it.
- For a 10K block the long run has no reason to pass about 16 km, so put further ambition into the threshold sessions rather than into Sunday.
- A week that sits below its volume floor must set week.reducedVolume with a reason of cutback, deload, taper, recovery, illness or injury and an explanation; writing the word into week.focus exempts nothing.
- Only one week per block may set reducedVolume, and that week must fall at least a tenth below the block's peak week, so a week that calls itself a cutback has taken one.

## How hard the week is

- Keep threshold running within 10 per cent of the week's own planned distance and interval running within 8 per cent of it, counting the repetitions only: warm-up, cool-down and recovery jogs are easy volume and sit outside both caps while still counting toward the week's total.
- Compute both caps from the week being prescribed, never from a historical average, so the cap still binds in the lightest week.
- Those two caps already hold hard running under 20 per cent of the week, so do not state a separate easy/hard split or an accounting basis; the validator counts by distance and converts a timed segment through its own prescribed pace.
- Hold every prescribed repetition pace constant for the whole block. A later week prescribing the same kind of session faster than the first is drift, not progress, whatever the weekly total says.
- Make time at threshold rise in every loading week, by repetition count first and repetition length second, and never by more than 25 per cent in a week nor 40 per cent across any two weeks; a reduced week is exempt. The 10 per cent cap usually binds long before those ceilings, so the session grows only as the week does.

## Targets, tune-ups and post-race recovery

- For timed easy recoveries, give an easy pace range when appropriate so their distance can be estimated; do not give strides an HR target.
- PRIMARY_TARGET is the only block target; TUNE_UP_EVENTS are independent secondary races that support it.
- Include every tune-up inside the planning period as a race workout on its event date, and taper or sharpen appropriately beforehand; do not place a normal tempo, threshold, VO2max, anaerobic, sprint, or long-run session within two days of a tune-up race.
- When POST_RACE_RECOVERY.required is true, every prescribed session through recoveryThroughDate must be easy or recovery only: no tempo, threshold, VO2max, anaerobic, sprint, race, or long run.
- Recent consistency, gaps, acute/chronic load, ACWR, load status, and TSB must inform how cautiously quality and volume resume; the first quality session may move into the following week.

## A 10K block and its 5K tune-up session

- For a 10K PRIMARY_TARGET, emphasize aerobic consistency, threshold development, and long-run durability, with at most one separate faster 5K-specific/VO2 stimulus in this rolling block.
- When a 5K tune-up with an explicit performance target falls inside the horizon, encourage one limited controlled 5K-specific workout around 7–10 days before it if recovery and load permit: 4–5 x 800m or equivalent 3-minute repetitions at controlled current/target 5K effort, with full easy recovery, warmup and cooldown; never all-out.
- For this controlled session, use the supplied tune-up targetPaceSecPerKm as the fastest end of the repetition pace range when present, with a slightly slower end for control; do not substitute the generic faster VO2 training-zone range.
- Prefer the last available quality day 7–10 days before the tune-up, leaving the preceding available day easy or rest.
- Encode this session as vo2max, not easy or threshold.
- Strides and threshold work alone are not a meaningful 5K-specific session.
- If recovery/load contraindicate this session, explain the omission in week.focus.
- Keep the block primarily 10K-oriented, and keep any long run within three days after this stimulus entirely easy with no progression or faster finish; do not add a second quality stimulus there.

## Course-aware race pacing

- When an event has courseContext, preserve targetSeconds but treat targetPace as the whole-course average, never an exact pace for every metre.
- For the full-distance race effort omit paceSecPerKm and use distance plus race-effort notes.
- Prefer supplied course/PacePro notes and splits; never invent missing splits or elevation.
- A slower uphill opening and faster downhill section may be correct despite the average goal pace.
- Keep warmup/cooldown and all other sessions unchanged when refining race pacing.
- Without course context, retain normal flat-race behavior.

## Goals, finish times and the planning window

- For every event, hasExplicitGoal and targetSeconds apply only to that event.
- Never copy a primary goal to a tune-up.
- When hasExplicitGoal is false, do not call any finish time an event goal; an AI-recommended pace must be described as a recommendation and encoded in paceSecPerKm.
- Pace and finish-time conversions are deterministic inputs: never calculate, infer, or narrate a finish time from a pace.
- You may repeat supplied targetFinishTime and targetPace values verbatim for that same event only.
- Keep plan names, plan focus, and week focus free of numeric pace or finish-time targets.
- Race workouts must occur on a supplied event date.
- Do not schedule anything outside the planning period.
- Use only supplied dates, athlete metrics, goals, target ranges, and available weekdays.

## Encoding the workouts

- Treat supplied hrZoneBoundsBpm as authoritative Garmin zone boundaries; do not recalculate HR zones from max HR or LTHR.
- Never estimate a maximum heart rate from age, and never derive a zone, a pace or a target from such an estimate; athlete age is context for recovery and progression only.
- Read trainingHistory.weeklySeries as the shape of the season: it gives the athlete's weekly kilometres and run counts in order from firstWeekStart, so a month lost to travel can be told apart from a month lost to fatigue or injury, which the averages alone cannot show.
- Never use the words progressive or progression anywhere in an easy or steady workout title, description, workout notes, or segment notes; describe longer-term volume rebuilding as gradual instead.
- Workout names and descriptions must match their blocks: call a workout progressive only when multiple blocks encode an actual rise in intensity.
- Hill repetitions must use effort/RPE or form guidance (with HR only as secondary guidance), never a rigid flat-ground pace target; use a normal flat interval workout if pace is the execution target, and encode qualitative effort/RPE/form guidance in segment notes.
- If a workout includes strides, encode every intended repetition as a repeat block containing a timed strides step and a recovery step (normally 4–6 × 20 seconds when appropriate); never emit a single standalone strides block and never omit or invent the repetition count.
- Do not assign hrZone or hrBpm to strides because HR response lags; guide them by pace or encode effort, relaxed speed, and form in segment notes.
- Return structured workouts, not prose-only sessions.
- Do not calculate new physiological metrics.
