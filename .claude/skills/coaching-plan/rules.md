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
- Specify distanceMeters for aerobic running blocks where practical so weekly volume is reviewable, except for a recovery step inside a repeat: a rest interval is a dose of time, so give it durationSeconds with an easy pace range. Capping rest by distance inverts the control - an athlete jogging slower, because they are tired or ill, is handed more rest, and one jogging faster gets less. Volume stays reviewable either way, since weekKm converts a timed segment through its own prescribed pace.
- No single session may exceed the longest run of trainingHistory.longestRunLast30DaysKm by more than a tenth, nor take more than about 30 per cent of a full week at that volume; a correct weekly total says nothing about one outsized run hidden inside it.
- For a 10K block the long run has no reason to pass about 16 km, so put further ambition into the threshold sessions rather than into Sunday.
- A week that sits below its volume floor must set week.reducedVolume with a reason of cutback, deload, taper, recovery, illness or injury and an explanation; writing the word into week.focus exempts nothing.
- Only one week per block may set reducedVolume, and that week must fall at least a tenth below the block's peak week, so a week that calls itself a cutback has taken one.

## How hard the week is

- Keep pace-led threshold running within 10 per cent of the week's own planned distance and interval running within 8 per cent of it, counting the repetitions only: warm-up, cool-down and recovery jogs are easy volume and sit outside both caps while still counting toward the week's total.
- Compute both caps from the week being prescribed, never from a historical average, so the cap still binds in the lightest week.
- Those two caps already hold hard running under 20 per cent of the week, so do not state a separate easy/hard split or an accounting basis; the validator counts by distance and converts a timed segment through its own prescribed pace.
- Hold every prescribed repetition pace constant for the whole block. A later week prescribing the same kind of session faster than the first is drift, not progress, whatever the weekly total says.
- Make pace-led time at threshold rise in every loading week, by repetition count first and repetition length second, and never by more than 25 per cent in a week nor 40 per cent across any two weeks; a reduced week is exempt. The 10 per cent cap usually binds long before those ceilings, so the session grows only as the week does.
- A controlled threshold session is a threshold workout whose every repetition step carries an hrBpm range, its max the heart-rate ceiling in context.controlledThreshold.heartRate.ceilingBpm, which keeps it below the threshold. It is run by pace with heart rate as the limit, so its pace guide may sit slower than the threshold band and it is quality all the same, and the pace-led threshold rules above do not apply to it.
- Write a controlled threshold session only when context.controlledThreshold is present. When it is null the athlete has no lactate threshold heart rate to set a ceiling by, so threshold work stays pace-led.
- Set a controlled threshold session's pace guide by repetition length, slower for longer repetitions, and hold each length's guide fixed for the whole block, as for any repetition.
- Hold controlled threshold time to CONTROLLED_THRESHOLD_DOSE instead of the 10 per cent cap: at most maxShareOfRunningTime of the week's running time, and never more than maxWeeklyStepMinutes above the previous full loading week, nor past the 25 and 40 per cent ceilings. It need not rise: repeating a full week is the method, and a week after a lighter one returns to the dose without counting as a jump.

## Where the numbers have been

- trajectories carries each key metric's recent history alongside its current value: threshold pace, VO2max, the Garmin 10K prediction and CTL, each with its best inside the window and how far the current value sits below it.
- A metric well below its own recent best is a rebuild target, not a ceiling. Where offBestPct is material, say the athlete is returning toward a level already demonstrated, and never present the depressed value as the limit of what they can do.
- Do not raise a prescribed pace to chase a past best either. The trajectory explains why a current value is low; only a race or a completed benchmark changes what is prescribed.
- trajectories.ctl.weeks lists every week including those with no running, which show zero kilometres. A gap there explains a depressed 28-day mean and must never be read as reduced capacity: it is training not done, not training the athlete cannot do.
- Read repeated gaps as the constraint they are. Where the series shows more than one interruption, the block's job is to be completed rather than to be ambitious, and week.focus should say so.
- trajectories.bestEfforts includes efforts set in ordinary training runs, not only official races. Treat the best effort at the target distance as evidence of capacity whatever its source, and do not describe an athlete as never having run a distance they have covered in training.
- A recentActivities entry's type is how the watch, or RunOmics without a watch label, filed the run, and a watch that sends no Training Effect guesses it. Where intendedType is present it names the session the run was set as: read the run as that session, and never count an easy walk/run filed as VO2Max as quality work.

## Where the block sits in the season

- MACROCYCLE gives the phases between the start of the season and the target race, and the phase each planned week falls in; write the block for the phase it is in rather than repeating the same block every month.
- In base, grow aerobic volume and threshold durability, and keep faster running to strides: no VO2max or race-pace session belongs here.
- In build, hold the volume reached in base and move the emphasis to threshold density, adding one race-pace or VO2max session a week only where recent load and recovery permit.
- In peak, ease aerobic volume and make the quality specific to the target distance and its goal pace.
- In the final week before the race, taper: cut volume by 30 to 50 per cent, hold intensity and frequency, and introduce nothing new.
- When a block spans two phases, treat each week by its own phase and name the transition in week.focus.
- When PRIMARY_TARGET is none, the block is general preparation: it progresses fitness over time toward no race, so MACROCYCLE carries no phases, every week follows the base rules above, and nothing tapers, peaks or sharpens toward a date.
- In general preparation, a race in TUNE_UP_EVENTS is a supporting run the block passes through, not a goal: keep the two days before it free of hard sessions, as for any tune-up, and leave the rest of its week as the block would have it.

## Controlled threshold blocks in general preparation

- A controlled threshold block is a general preparation block, PRIMARY_TARGET none, for an athlete whose context.controlledThreshold is present. The rules below that name one apply to no other block.
- context.autoregulation reads each recent controlled threshold session from minute 3 of every repetition against its heart-rate target, compares the latest easy run with the athlete's recent normal, and reads the latest 5K fitness check. Its guideProposals and a fatigue flag are proposals the athlete has not accepted: keep each repetition length's guide as currentPlan last prescribed it unless the guidance says a proposal was accepted, and name any open proposal in the plan focus without stating a pace.
- In a controlled threshold block, once the controlled threshold dose has reached the full week in context.controlledThreshold.fullWeek - its number of sessions of about minutesPerSession each, in a week of about weekKm - repeat that week rather than growing it further.
- In a controlled threshold block, take a lighter week only when context.autoregulation flags fatigue, in the week before a fitness check, or as a routine one no more often than every six to eight weeks; never as a fixed last week of every block. A lighter week cuts controlled threshold time by about a third and easy running by about a fifth, keeps every run and the strides, and sets reducedVolume.
- In a controlled threshold block, alternate two speed weeks so they never fall in the same week. Week A: hill sprints in place of the flat strides on the easy run that carries them, 6 to 8 repetitions of 10 seconds up a steep hill with a walk back down, written as a strides repeat group with no pace or heart-rate target and effort and form in the notes. Week B: the 5-6 minute repetitions become 10 × 3 minutes with 60 seconds of jogging, guided at about context.controlledThreshold.shortRepetitionGuideSecPerKm for now and under the same heart-rate ceiling.
- In a controlled threshold block, a fitness check every 8 to 12 weeks - a 5K time trial or a parkrun - takes the place of one controlled threshold session, on a date the athlete has registered as an event, so it arrives as a supporting race. When context.autoregulation.fitnessCheck carries proposedGuides, write the next block's guides from them and say in the plan focus that they come from the check.
- With no target race there is no race-pace work. In a controlled threshold block the fastest running is the strides, the hill sprints and the short-repetition threshold session.

## Targets, tune-ups and post-race recovery

- Prescribe the recovery between repetitions as a duration, never as a distance. A distance-capped float stretches exactly when the athlete is most tired and slowest: 600 m meant to be four minutes ran 3:59, 4:28 and 4:42 across one session. The rest is the fixed quantity; the ground covered is not.
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
- In a block toward a 10K, keep it primarily 10K-oriented, and keep any long run within three days after the 5K-specific session entirely easy with no progression or faster finish; do not add a second quality stimulus there.

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
- Keep the plan's name, the plan focus and each week focus free of numeric pace or finish-time targets.
- Race workouts must occur on a supplied event date.
- Do not schedule anything outside the planning period.
- Use only supplied dates, athlete metrics, goals, target ranges, and available weekdays.

## Injury history

- athlete.injuryHistory carries prior running injuries and the date they were last reviewed; prior injury is the most consistently replicated predictor of running injury, more than any load metric, so read it before deciding how hard to ramp.
- An empty injuries list with a recent reviewedOn means the athlete has none: say so plainly in the plan rationale and do not manufacture a caution.
- When injuryHistory is absent, or reviewedOn is over a year old, treat the history as unknown rather than empty, and say it is unknown.
- Where an injury is recorded, name the site in the plan rationale, ramp the tissue it involves more gradually than the weekly total otherwise allows, and treat a recurrent one as a standing constraint rather than a past event.
- Never claim the plan prevents injury: no training plan has been shown to, and the two randomised tests of graded progression in runners were null.

## What the athlete wrote

- A recentActivities entry may carry note and tags the athlete wrote in the app. Read them as first-hand evidence about the circumstances of that session, ahead of whatever its numbers alone would suggest.
- An RPE raised by a note or tag reporting illness, poor sleep, heat, travel or a niggle is not a fitness signal. Never slow a prescribed pace, re-test a threshold, or call a block too hard on that basis; say instead that the session was run under that circumstance.
- Where a note or tag reports illness or injury, weigh it in the frequency and volume decision and name it as the reason, per the rules above on reducedVolume and fewer runs.
- Most sessions carry no note, and the field is absent when nothing was written. Absence means nothing was recorded, never that the session was unremarkable - do not read a conclusion out of a missing note.
- athlete.trainingBreaks, when present, names each stop of the last year and its reason as the athlete typed it: injury, illness, pregnancy, heat, travel or personal. A travel, heat or personal break is a life event, never lost capacity: resume at the recent level without a return reduction. After an illness, injury or pregnancy break return gradually and say so, without inventing percentages a clinician would set.
- context.wellness carries the athlete's morning check-ins of the last 28 days, newest first. Sleep, soreness, stress and mood each run from 1, the worst, to 5, the best, so soreness 5 and stress 5 mean none. ill and travel are present when the athlete flagged them. A niggle names a body site, its side when given, pain from 0 to 10 and changesRun when the athlete said it changed that day's run. wellness.niggles groups the niggle reports of the last twelve weeks by site and side.
- Read the check-ins as first-hand evidence of readiness, as the notes are, never as a fitness signal: do not slow a prescribed pace or re-test a threshold because of them. Several recent mornings of poor sleep, soreness or stress argue for holding volume rather than raising it; an illness flag in the last days argues for fewer runs and reducedVolume, named as the reason.
- Treat a niggle reported on several recent days, at pain 4 or more, or that changed a run, like a recorded injury: name the site and side in the plan rationale and ramp the tissue it involves more gradually than the weekly total otherwise allows. A niggle is not a diagnosis: never name one or prescribe treatment.
- A day without a check-in means nothing was recorded, never that the morning was fine. When context.wellness is absent the check-ins could not be read, so say nothing about them rather than reading an absence as health.

## Returning to running

- context.returnToRunning is present after a stop of four weeks or more that athlete.trainingBreaks gives as injury, illness or pregnancy, until a run since has held 30 minutes without a walk; it names the break and longestContinuousMinutesSince. While it is present, and for as long after as the notes report symptoms, the athlete is returning: the rules that begin "While returning" take precedence over the volume, long-run, threshold, speed-week and season-phase rules, and best4WeekAverageKm and every other figure from before the break describe the past, not a target. What the athlete has just tolerated sets the next step.
- While returning, write every session by time. Each running interval is durationSeconds with one target: the heart-rate zone the guidance gives, as hrBpm, or, when the guidance gives none, the pace range the guidance gives, never slower, and only without one a wide easy pace range. Never both, since the watch executes the pace and drops the heart rate. Each walk break, walking warm-up and walking cool-down is durationSeconds alone, with no pace and no heart-rate target, so the watch never alerts a walker for being slow and walking adds no running volume. No week has a volume floor to meet while returning.
- While returning, guide the running by effort: write in the notes the talk test the guidance gives, or, when it gives none, that the athlete should be able to talk in full sentences. When the guidance gives a heart-rate zone, keep any walk-down rule it gives with it - walk above one heart rate until back under another - in each running interval's notes. When it gives none, there is no heart-rate target: a heart-rate figure, where one helps and the guidance does not make heart rate information only, is a ceiling to walk under, written in the notes.
- While returning, progress one step at a time - longer running intervals first, then shorter walks - and only when the latest notes, RPE and check-ins say the sessions felt comfortable. After a hard session, pain or a symptom, repeat the week rather than progress it, and say why in week.focus.
- While returning, prescribe no quality work: no tempo, threshold, VO2max, anaerobic, sprint, race-pace or hill session, no strides and no long run. Every session is easy or recovery.
- While returning, put a stop rule in every session's notes: stop and see the athlete's clinician on pain at an injured site, or, after pregnancy, on leaking or urgency, heaviness, pressure or dragging in the pelvis, or pelvic or lower-back pain. Defer to the clinician, through the guidance when it carries their instructions, on when running may progress; never diagnose, prescribe treatment or promise a date the athlete will be back by.

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

## Naming the workouts

The name is what the watch, Plan, Today and the run it becomes all show, and the app
prints it as given: it never reads a figure back out of it. These bullets also go,
on their own, to a change to the live plan, which names the sessions it writes too.
`validateDraftNames` in `src/application/coaching/workoutNames.ts` holds a plan to
them (design review, Oct 2026).

- Name each workout in its title as its session type, then " · " and its structure when it has one: "Threshold · 3 × 8′ @ 4:25", "Easy · 54 min + 6 strides", "VO₂ intervals · 5 × 3′". A session without structure is its type alone: "Recovery run", "Easy run", "Long run". The type leads so that the word telling two sessions apart survives a watch that shows only the first characters.
- The session types are Recovery run, Easy run, Easy, Long run, Tempo, Threshold, VO₂ intervals, Anaerobic, Sprints and Race; an easy run is "Easy" when a structure follows it.
- Write repetitions as their count, the multiplication sign and their length with the prime: "3 × 8′", never "3 x 8", "3x8'" or "3 x 7:40". Round a repetition to the nearest minute (7:40 is 8′); one under a minute keeps its seconds with the double prime ("10 × 30″").
- Put the repetitions' target pace last, after " @ ": "@ 4:25", the middle of their pace range, with no unit and never a range.
- Keep a name to 28 characters, so it fits a row on a phone and on the watch; drop the pace first when it would not fit.
- Use sentence case in names: capitalise the first word only, unless a proper noun follows.
- Never use " - " in a name, and never put the session's total distance, its total duration or its zone in it. Each is computed from the blocks and shown beside the name, and a figure written into the name is a second source of truth that drifts from the session it names.
- Give every workout a shortName of at most 18 characters for a tight row, the name itself when it already fits: "Threshold 3×8′", "Easy + strides", "Long run".
- Give a workout with repetitions or extras a structure that states them as its blocks have them: {"reps": 3, "repMinutes": 8, "targetPace": "4:25"} for "Threshold · 3 × 8′ @ 4:25", {"extras": ["6 strides"]} for "Easy · 54 min + 6 strides".
- A run inherits the name of the session it was, so keep each name specific enough to tell its session apart in a list of runs.
