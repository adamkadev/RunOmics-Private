import { describe, expect, it } from 'vitest'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingWorkoutType, WorkoutBlock } from '@/domain/coaching/types'
import { intensityBand, validateDraftIntensity } from '../intensity'

// Adam runs Tue, Wed, Thu, Sat, Sun.
const DAYS = [2, 3, 4, 6, 0]

// Threshold 4:23/km: the band splits quality from aerobic running at 268 s/km and
// threshold from sharper work at 258 s/km.
const BAND = intensityBand(263)

const easy = (metres: number): WorkoutBlock => ({ kind: 'effort', target: { distanceMeters: metres, paceSecPerKm: { min: 308, max: 384 } } })
const warmup = (metres: number): WorkoutBlock => ({ kind: 'warmup', target: { distanceMeters: metres, paceSecPerKm: { min: 308, max: 384 } } })
const cooldown = (metres: number): WorkoutBlock => ({ kind: 'cooldown', target: { distanceMeters: metres, paceSecPerKm: { min: 308, max: 384 } } })

const reps = (count: number, metres: number, pace: number, jog = 400): WorkoutBlock => ({
  kind: 'repeat',
  repetitions: count,
  steps: [
    { kind: 'effort', target: { distanceMeters: metres, paceSecPerKm: { min: pace, max: pace + 5 } } },
    { kind: 'recovery', target: { distanceMeters: jog, paceSecPerKm: { min: 330, max: 400 } } },
  ],
})

const strides = (count: number): WorkoutBlock => ({
  kind: 'repeat',
  repetitions: count,
  steps: [
    { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 215, max: 230 } } },
    { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 360, max: 420 } } },
  ],
})

let day = 0
function workout(type: CoachingWorkoutType, blocks: WorkoutBlock[]) {
  day += 1
  return { date: `2026-09-${String(day).padStart(2, '0')}`, type, title: 't', description: '', blocks }
}

function week(start: string, workouts: ReturnType<typeof workout>[], reducedVolume?: BootstrapWeekDraft['reducedVolume']): BootstrapWeekDraft {
  day = 0
  return {
    startDate: start,
    endDate: new Date(Date.parse(start) + 6 * 86_400_000).toISOString().slice(0, 10),
    focus: 'build',
    ...(reducedVolume ? { reducedVolume } : {}),
    workouts,
  }
}

const draft = (...weeks: BootstrapWeekDraft[]): CoachingPlanDraft => ({ name: 'block', focus: 'build', weeks })

/** The 10% cap binds hard at this volume, so the session grows only as the week does. */
function soundWeek(start: string, repMetres: number, totalKm: number, pace = 263): BootstrapWeekDraft {
  const filler = Math.round((totalKm * 1_000 - 3_500 - 3 * (repMetres + 400)) / 4)
  return week(start, [
    workout('easy', [easy(filler)]),
    workout('threshold', [warmup(2000), reps(3, repMetres, pace), cooldown(1500)]),
    workout('easy', [easy(filler)]),
    workout('easy', [easy(filler)]),
    workout('long_run', [easy(filler)]),
  ])
}

describe('what counts as hard', () => {
  it('accepts a week whose quality sits inside the caps', () => {
    expect(() => validateDraftIntensity(draft(soundWeek('2026-09-28', 1500, 48)), BAND, DAYS)).not.toThrow()
  })

  it('leaves warm-up and cool-down out of the caps while they still fill the week', () => {
    // 4 km of jogging around a 4.5 km session. Counted as quality the session
    // would breach the 10% cap; counted as the easy running it is, it does not.
    const padded = week('2026-09-28', [
      workout('threshold', [warmup(2000), reps(3, 1500, 263), cooldown(2000)]),
      workout('easy', [easy(12000)]),
      workout('easy', [easy(12000)]),
      workout('long_run', [easy(13000)]),
    ])
    expect(() => validateDraftIntensity(draft(padded), BAND, DAYS)).not.toThrow()
  })

  it('counts 20-second strides as neuromuscular rather than as quality volume', () => {
    const sharpening = week('2026-09-28', [
      workout('easy', [easy(9000), strides(6)]),
      workout('threshold', [warmup(2000), reps(3, 1600, 263), cooldown(1500)]),
      workout('easy', [easy(11000)]),
      workout('easy', [easy(11000)]),
      workout('long_run', [easy(11000)]),
    ])
    expect(() => validateDraftIntensity(draft(sharpening), BAND, DAYS)).not.toThrow()
  })

  it('reads an unpaced hill session by its workout type', () => {
    const hills = week('2026-09-28', [
      workout('vo2max', [warmup(2000), { kind: 'repeat', repetitions: 10, steps: [{ kind: 'effort', target: { distanceMeters: 400 } }, { kind: 'recovery', target: { distanceMeters: 400 } }] }, cooldown(2000)]),
      workout('easy', [easy(6000)]),
    ])
    expect(() => validateDraftIntensity(draft(hills), BAND, DAYS)).toThrow(/of intervals/)
  })

  it('does not ration the race itself', () => {
    const raceWeek = week('2026-09-28', [
      workout('easy', [easy(8000)]),
      workout('easy', [easy(6000)]),
      workout('race', [warmup(2000), { kind: 'effort', target: { distanceMeters: 10000 } }, cooldown(1000)]),
    ])
    expect(() => validateDraftIntensity(draft(raceWeek), BAND, DAYS)).not.toThrow()
  })
})

describe('the dose of hard running', () => {
  it('refuses a week running 40% of its distance at threshold', () => {
    // Every volume check passes, yet the week is a race, not a training week.
    const hard = week('2026-09-28', [
      workout('threshold', [warmup(2000), reps(6, 1600, 263), cooldown(2000)]),
      workout('threshold', [warmup(2000), reps(6, 1600, 263), cooldown(2000)]),
      workout('easy', [easy(9000)]),
      workout('long_run', [easy(9000)]),
    ])
    expect(() => validateDraftIntensity(draft(hard), BAND, DAYS)).toThrow(/at threshold within/)
  })

  it('refuses interval volume past the tighter cap that applies to it', () => {
    const sharp = week('2026-09-28', [
      workout('vo2max', [warmup(2000), reps(8, 800, 235), cooldown(2000)]),
      workout('easy', [easy(9000)]),
      workout('easy', [easy(9000)]),
      workout('long_run', [easy(10000)]),
    ])
    expect(() => validateDraftIntensity(draft(sharp), BAND, DAYS)).toThrow(/of intervals within/)
  })

  it('bounds hard running below 80/20 without a separate check, because 10 and 8 make 18', () => {
    // Both caps at their limit in a 50 km week: 5 km threshold, 4 km
    // intervals, 18% hard. A 20% ceiling could never fire behind them.
    const maxed = week('2026-09-28', [
      workout('threshold', [warmup(2000), reps(2, 2500, 263, 0), cooldown(2000)]),
      workout('vo2max', [warmup(2000), reps(5, 800, 235, 0), cooldown(2000)]),
      workout('easy', [easy(10000)]),
      workout('easy', [easy(10000)]),
      workout('long_run', [easy(13000)]),
    ])
    expect(() => validateDraftIntensity(draft(maxed), BAND, DAYS)).not.toThrow()
  })
})

describe('a week that is only part of a training week', () => {
  const opener = (thresholdMetres: number) => ({
    startDate: '2026-09-23',
    endDate: '2026-09-27',
    focus: 'opening week',
    workouts: [
      workout('threshold', [warmup(2000), reps(3, thresholdMetres, 263, 600), cooldown(1600)]),
      workout('easy', [easy(9900)]),
      workout('easy', [easy(9900)]),
      workout('long_run', [easy(10000)]),
    ],
  })

  it('judges the session against the week it belongs to, not the stub left after a mid-week start', () => {
    // Wednesday to Sunday is four of his five running days; Tuesday was
    // already run under the previous block. 4.8 km of threshold is over a
    // tenth of the 40 km prescribed here and inside a tenth of the week it
    // actually sits in.
    expect(() => validateDraftIntensity(draft(opener(1600)), BAND, DAYS)).not.toThrow()
  })

  it('still refuses a session that is too much for the whole week either', () => {
    expect(() => validateDraftIntensity(draft(opener(2200)), BAND, DAYS)).toThrow(/at threshold within/)
  })

  it('will not let scaling a short week up swallow the running actually prescribed', () => {
    // Scaled to full size a fifth of a week would permit 7.5 km of threshold
    // and 6 km of intervals. Each session here clears its own cap; together
    // they are a quarter of what is actually being run.
    const stub = {
      startDate: '2026-10-19',
      endDate: '2026-10-20',
      focus: 'tail',
      workouts: [
        workout('threshold', [warmup(1000), reps(2, 1000, 263, 300), cooldown(1000)]),
        workout('vo2max', [warmup(1000), reps(4, 500, 235, 250), cooldown(1000)]),
        workout('easy', [easy(5400)]),
      ],
    }
    expect(() => validateDraftIntensity(draft(stub), BAND, DAYS)).toThrow(/ceiling on hard running/)
  })
})

describe('pace drift across the block', () => {
  it('refuses repetitions that creep faster week by week', () => {
    // 10 s/km a week, each step small, the block ending somewhere else.
    const block = draft(soundWeek('2026-09-28', 1500, 48, 263), soundWeek('2026-10-05', 1650, 52, 253), soundWeek('2026-10-12', 1800, 56, 243))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/prescribes threshold at 253 s\/km against 263 s\/km/)
  })

  it('catches drift that carries the repetitions clean out of the threshold band', () => {
    // At 250 s/km the repetition is no longer threshold work at all, and the
    // session type is what says it was meant to be.
    const block = draft(soundWeek('2026-09-28', 1500, 48, 263), soundWeek('2026-10-05', 1650, 52, 250))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/prescribes threshold at 250 s\/km/)
  })

  it('measures drift against the block, not against the week before', () => {
    // Three 2 s/km steps: every consecutive pair is inside tolerance and the
    // block still finishes 6 s/km fast.
    const block = draft(soundWeek('2026-09-28', 1500, 48, 263), soundWeek('2026-10-05', 1650, 52, 261), soundWeek('2026-10-12', 1800, 56, 257))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/at 257 s\/km against 263 s\/km/)
  })

  it('allows a rounded repetition inside the tolerance', () => {
    const block = draft(soundWeek('2026-09-28', 1500, 48, 263), soundWeek('2026-10-05', 1650, 52, 261))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('says nothing about a week prescribed slower', () => {
    const block = draft(soundWeek('2026-09-28', 1500, 48, 263), soundWeek('2026-10-05', 1650, 52, 268))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })
})

describe('time at threshold across the block', () => {
  it('refuses a block whose threshold volume returns to where it started', () => {
    // 4.5, 5.1, 4.5 km at threshold: week three merely undoes week two.
    const block = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1700, 52), soundWeek('2026-10-12', 1500, 52))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/holds time at threshold/)
  })

  it('accepts a block that lengthens the repetitions as the week grows', () => {
    const block = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1650, 52), soundWeek('2026-10-12', 1800, 56))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('refuses a step that doubles the quality dose in a week', () => {
    const block = draft(soundWeek('2026-09-28', 1200, 48), soundWeek('2026-10-05', 1600, 50))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/beyond the quarter a week/)
  })

  it('exempts a declared reduced week from having to progress', () => {
    const block = draft(
      soundWeek('2026-09-28', 1500, 48),
      soundWeek('2026-10-05', 1650, 52),
      { ...soundWeek('2026-10-12', 1200, 40), reducedVolume: { reason: 'cutback', explanation: 'Absorb the block.' } },
      soundWeek('2026-10-19', 1800, 56),
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('says nothing about a block carrying no threshold work at all', () => {
    const recovery = draft(
      week('2026-09-28', [workout('easy', [easy(8000)]), workout('easy', [easy(8000)])]),
      week('2026-10-05', [workout('easy', [easy(9000)]), workout('easy', [easy(9000)])]),
    )
    expect(() => validateDraftIntensity(recovery, BAND, DAYS)).not.toThrow()
  })
})

// Controlled threshold: run by pace with an hrBpm cap. The 8-10 minute repetitions'
// 272-280 s/km guide is slower than the band's 268 s/km edge, so pace alone reads them as easy.
const CAP = { min: 156, max: 173 }
const LONG = { min: 272, max: 280 }
const MEDIUM = { min: 268, max: 274 }

const controlledReps = (count: number, minutes: number, pace: { min: number; max: number }, jogSeconds = 90): WorkoutBlock => ({
  kind: 'repeat',
  repetitions: count,
  steps: [
    { kind: 'effort', target: { durationSeconds: minutes * 60, paceSecPerKm: pace, hrBpm: CAP } },
    { kind: 'recovery', target: { durationSeconds: jogSeconds, paceSecPerKm: { min: 360, max: 420 } } },
  ],
})

const controlled = (count: number, minutes: number, pace = LONG, jogSeconds = 90) =>
  workout('threshold', [warmup(1700), warmup(1000), warmup(1000), controlledReps(count, minutes, pace, jogSeconds), cooldown(1700)])

function controlledWeek(start: string, wednesday: ReturnType<typeof workout>, saturday: ReturnType<typeof workout>, easyKm = [9, 8], longKm = 14): BootstrapWeekDraft {
  return week(start, [
    workout('easy', [easy(easyKm[0]! * 1_000)]),
    wednesday,
    workout('easy', [easy(easyKm[1]! * 1_000), strides(6)]),
    saturday,
    workout('long_run', [easy(longKm * 1_000)]),
  ])
}

describe('controlled threshold sessions', () => {
  it('counts repetitions guided slower than the threshold band as quality, so their dose is checked', () => {
    // Two 4 x 12 minute sessions at 272-280 s/km in a short week: 96 minutes in
    // about five hours. Read by pace alone this was all easy running.
    const heavy = draft(controlledWeek('2026-10-19', controlled(4, 12), controlled(4, 12, MEDIUM, 60), [6, 6], 10))
    expect(() => validateDraftIntensity(heavy, BAND, DAYS)).toThrow(/min of controlled threshold in \d+ min of running, over the 25% ceiling/)
  })

  it('accepts the block written on 2026-10-15: 44, 55 and 60 minutes, then a lighter week', () => {
    const block = draft(
      controlledWeek('2026-10-19', controlled(3, 8), controlled(4, 5, MEDIUM, 60), [10, 8], 13),
      controlledWeek('2026-10-26', controlled(3, 10), controlled(5, 5, MEDIUM, 60), [9, 8], 13.5),
      controlledWeek('2026-11-02', controlled(3, 10), controlled(5, 6, MEDIUM, 60), [9, 8], 14),
      { ...controlledWeek('2026-11-09', controlled(3, 8), controlled(4, 5, MEDIUM, 60), [8, 6], 11), reducedVolume: { reason: 'cutback', explanation: 'Lighter week.' } },
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('lets the full week repeat, where pace-led threshold has to keep rising', () => {
    const full = () => controlledWeek('2026-11-16', controlled(3, 10), controlled(5, 6, MEDIUM, 60))
    const block = draft(full(), { ...full(), startDate: '2026-11-23', endDate: '2026-11-29' }, { ...full(), startDate: '2026-11-30', endDate: '2026-12-06' })
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('refuses controlled threshold time growing faster than the weekly step allows', () => {
    // 30 to 60 minutes: one session to two at full length in a single week.
    const block = draft(
      week('2026-10-19', [workout('easy', [easy(10_000)]), controlled(3, 10), workout('easy', [easy(9_000)]), workout('easy', [easy(10_000)]), workout('long_run', [easy(14_000)])]),
      controlledWeek('2026-10-26', controlled(3, 10), controlled(5, 6, MEDIUM, 60)),
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/controlled threshold time from 30 to 60 min, more than the 15 min a week/)
  })

  it('measures the week after a lighter one against the loading week before it', () => {
    const block = draft(
      controlledWeek('2026-11-02', controlled(3, 10), controlled(5, 6, MEDIUM, 60)),
      { ...controlledWeek('2026-11-09', controlled(2, 10), controlled(4, 5, MEDIUM, 60), [7, 6], 11), reducedVolume: { reason: 'cutback', explanation: 'Fatigue flag.' } },
      controlledWeek('2026-11-16', controlled(3, 10), controlled(5, 6, MEDIUM, 60)),
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('holds each repetition length to its own guide, so a short-repetition week may run faster', () => {
    // Week B: 10 x 3 minutes at 260-265 s/km, alternating with 5 x 6 minutes at 268-274.
    const block = draft(
      controlledWeek('2026-11-16', controlled(3, 10), controlled(5, 6, MEDIUM, 60)),
      controlledWeek('2026-11-23', controlled(3, 10), controlled(10, 3, { min: 260, max: 265 }, 60)),
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })

  it('still refuses one repetition length creeping faster across the block', () => {
    const block = draft(
      controlledWeek('2026-11-16', controlled(3, 10), controlled(5, 6, MEDIUM, 60)),
      controlledWeek('2026-11-23', controlled(3, 10, { min: 266, max: 272 }), controlled(5, 6, MEDIUM, 60)),
    )
    expect(() => validateDraftIntensity(block, BAND, DAYS)).toThrow(/threshold 10-minute repetitions at 266 s\/km against 272 s\/km/)
  })

  it('leaves the threshold cap to pace-led repetitions: a controlled threshold session is held to its own share instead', () => {
    // 60 minutes of controlled threshold is about 13 km, far past 10% of 58 km, and inside 25% of the time.
    const block = draft(controlledWeek('2026-11-02', controlled(3, 10), controlled(5, 6, MEDIUM, 60)))
    expect(() => validateDraftIntensity(block, BAND, DAYS)).not.toThrow()
  })
})

describe('judging an adaptation', () => {
  it('lets a change take easy running out of a week, though its hard share then rises', () => {
    const before = soundWeek('2026-09-28', 1500, 48)
    const eased = { ...before, workouts: before.workouts.filter((_, index) => index !== 2 && index !== 3) }

    expect(() => validateDraftIntensity(draft(eased), BAND, DAYS)).toThrow(/at threshold within/)
    expect(() => validateDraftIntensity(draft(eased), BAND, DAYS, draft(before))).not.toThrow()
  })

  it('refuses a change that adds hard running past the cap', () => {
    const before = draft(soundWeek('2026-09-28', 1500, 48))

    expect(() => validateDraftIntensity(draft(soundWeek('2026-09-28', 3000, 48)), BAND, DAYS, before)).toThrow(/at threshold within/)
  })

  it('refuses a change that makes repetitions faster than the block holds them', () => {
    const before = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1650, 52))
    const faster = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1650, 52, 255))

    expect(() => validateDraftIntensity(faster, BAND, DAYS, before)).toThrow(/hold the pace across the block/)
  })

  it('does not demand that an adaptation progress time at threshold', () => {
    const before = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1500, 48))
    const after = draft(soundWeek('2026-09-28', 1500, 48), soundWeek('2026-10-05', 1500, 46))

    expect(() => validateDraftIntensity(after, BAND, DAYS)).toThrow(/holds time at threshold/)
    expect(() => validateDraftIntensity(after, BAND, DAYS, before)).not.toThrow()
  })
})

describe('intensityBand', () => {
  it('says nothing when the athlete has no measured threshold to judge against', () => {
    expect(intensityBand(null)).toBeNull()
    const anything = draft(week('2026-09-28', [workout('threshold', [reps(20, 1600, 240)])]))
    expect(() => validateDraftIntensity(anything, intensityBand(null), DAYS)).not.toThrow()
  })
})
