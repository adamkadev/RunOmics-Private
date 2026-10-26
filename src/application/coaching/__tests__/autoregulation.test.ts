import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { CoachingPlan, NumberRange, WorkoutPrescription } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { assessFatigue, autoregulationReport, proposeGuideChanges, readControlledSession, type EasyRunReading } from '../autoregulation'
import { controlledThresholdFacts, controlledThresholdHr } from '../controlledThreshold'

const LONG: NumberRange = { min: 272, max: 280 }

function controlledPrescription(date: string, reps = 3, minutes = 10, guide: NumberRange = LONG, ceiling = 173): WorkoutPrescription {
  return workout({
    id: `threshold-${date}`,
    date,
    blocks: [
      { kind: 'warmup', target: { distanceMeters: 3_700 } },
      {
        kind: 'repeat',
        repetitions: reps,
        steps: [
          { kind: 'effort', target: { durationSeconds: minutes * 60, paceSecPerKm: guide, hrBpm: { min: 156, max: ceiling } } },
          { kind: 'recovery', target: { durationSeconds: 90 } },
        ],
      },
      { kind: 'cooldown', target: { distanceMeters: 1_700 } },
    ],
  })
}

interface RepPlan {
  /** Settled heart rate from minute 3 on; the first three minutes climb toward it from 150. */
  hr: number
  paceSecPerKm: number
}

function controlledRun(date: string, reps: RepPlan[], minutes = 10, tempC = 15): Activity {
  const splits: ActivitySplit[] = []
  const samples: number[] = []
  const add = (type: ActivitySplit['type'], seconds: number, metres: number, hrAt: (second: number) => number) => {
    splits.push({ type, durationSec: seconds, distanceM: metres, avgSpeedMs: metres / seconds, avgHr: null, laps: [] })
    for (let second = 0; second < seconds; second += 10) samples.push(hrAt(second))
  }
  add('interval_warmup', 600, 1_700, () => 140)
  for (const rep of reps) {
    const seconds = minutes * 60
    add('interval_active', seconds, Math.round((seconds / rep.paceSecPerKm) * 1_000), (second) => second < 180 ? 150 + Math.round((rep.hr - 150) * second / 180) : rep.hr)
    add('interval_recovery', 90, 230, () => 145)
  }
  add('interval_cooldown', 600, 1_700, () => 140)
  samples.push(140)
  const durationSeconds = splits.reduce((sum, split) => sum + split.durationSec, 0)
  return {
    id: `run-${date}`,
    date,
    type: 'Tempo',
    sport: 'running',
    durationSeconds,
    distanceKm: 12,
    paceSecPerKm: 300,
    avgHeartRate: 155,
    hrSamples: samples,
    splits,
    weather: { tempC, apparentTempC: tempC, humidityPct: 60, windKph: 5, windDirDeg: 0, precipitationMm: 0, code: 0 },
  } as Activity
}

const even = (hr: number, paceSecPerKm = 276, count = 3): RepPlan[] => Array.from({ length: count }, () => ({ hr, paceSecPerKm }))

describe('reading a controlled threshold session from minute 3', () => {
  it('reads each repetition from minute 3 to its end, leaving out the climb', () => {
    const reading = readControlledSession(controlledRun('2026-10-28', even(168)), controlledPrescription('2026-10-28'))!
    expect(reading.repClass).toBe('long')
    expect(reading.targetHr).toBe(169)
    expect(reading.reps.map((rep) => rep.windowHr)).toEqual([168, 168, 168])
    expect(reading.reps.map((rep) => rep.paceSecPerKm)).toEqual([276, 276, 276])
    expect(reading.verdict).toBe('on_target')
  })

  it('reads well under target at the guide as under', () => {
    expect(readControlledSession(controlledRun('2026-10-28', even(162)), controlledPrescription('2026-10-28'))!.verdict).toBe('under')
  })

  it('reads one repetition past target as over', () => {
    const reps = [{ hr: 166, paceSecPerKm: 276 }, { hr: 168, paceSecPerKm: 276 }, { hr: 171, paceSecPerKm: 276 }]
    expect(readControlledSession(controlledRun('2026-10-28', reps), controlledPrescription('2026-10-28'))!.verdict).toBe('over')
  })

  it('still reads a session eased off on a hot day as over: the heart rate is the evidence', () => {
    const reps = [{ hr: 170, paceSecPerKm: 285 }, { hr: 171, paceSecPerKm: 288 }, { hr: 171, paceSecPerKm: 290 }]
    expect(readControlledSession(controlledRun('2026-10-28', reps, 10, 26), controlledPrescription('2026-10-28'))!.verdict).toBe('over')
  })

  it('blames nothing on the guide when the repetitions were run faster than it', () => {
    expect(readControlledSession(controlledRun('2026-10-28', even(172, 262)), controlledPrescription('2026-10-28'))!.verdict).toBe('off_guide')
  })

  it('uses the medium-repetition target for 5-6 minute repetitions', () => {
    const reading = readControlledSession(controlledRun('2026-10-31', even(170, 271, 5), 6), controlledPrescription('2026-10-31', 5, 6, { min: 268, max: 274 }))!
    expect(reading).toMatchObject({ repClass: 'medium', targetHr: 171, verdict: 'on_target' })
  })

  it('reads a session against the ceiling it prescribed, not a fixed one', () => {
    const reading = readControlledSession(controlledRun('2026-10-28', even(158)), controlledPrescription('2026-10-28', 3, 10, LONG, 160))!
    expect(reading).toMatchObject({ targetHr: 156, ceilingHr: 160, verdict: 'over' })
  })

  it('says nothing for a run without heart-rate samples', () => {
    const run = { ...controlledRun('2026-10-28', even(168)), hrSamples: null }
    expect(readControlledSession(run, controlledPrescription('2026-10-28'))!.verdict).toBe('unreadable')
  })
})

describe('what a new block is told', () => {
  it('sets an LTHR of 179 to a ceiling of 173 and targets of 169 long, 171 medium and short', () => {
    expect(controlledThresholdHr(179)).toEqual({ lthrBpm: 179, ceilingBpm: 173, targetBpm: { long: 169, medium: 171, short: 171 } })
  })

  it('sets none without an LTHR', () => {
    expect(controlledThresholdHr(undefined)).toBeNull()
  })

  it('gives the full week and the short-repetition guide from the athlete\'s own volume and threshold pace', () => {
    expect(controlledThresholdFacts(179, 261, 57.35)).toMatchObject({
      fullWeek: { sessions: 2, minutesPerSession: 30, weekKm: { min: 56, max: 58 } },
      shortRepetitionGuideSecPerKm: { min: 260, max: 265 },
    })
  })
})

describe('proposing a pace-guide change', () => {
  const reading = (date: string, hr: number, guide = LONG, pace = 276) =>
    readControlledSession(controlledRun(date, even(hr, pace)), controlledPrescription(date, 3, 10, guide))!

  it('proposes taking 4 s/km off a guide two sessions in a row ran well under target', () => {
    expect(proposeGuideChanges([reading('2026-10-28', 162), reading('2026-11-04', 163)])).toEqual([
      expect.objectContaining({ repClass: 'long', direction: 'faster', guide: LONG, proposedGuide: { min: 268, max: 276 }, stepSecPerKm: 4 }),
    ])
  })

  it('proposes slowing a guide two sessions in a row ran past target', () => {
    expect(proposeGuideChanges([reading('2026-10-28', 171), reading('2026-11-04', 170)])).toEqual([
      expect.objectContaining({ direction: 'slower', proposedGuide: { min: 276, max: 284 } }),
    ])
  })

  it('needs the two sessions to agree', () => {
    expect(proposeGuideChanges([reading('2026-10-28', 162), reading('2026-11-04', 171)])).toEqual([])
    expect(proposeGuideChanges([reading('2026-11-04', 162)])).toEqual([])
  })

  it('reads only the latest two, so an older disagreement does not block a fresh signal', () => {
    expect(proposeGuideChanges([reading('2026-10-21', 171), reading('2026-10-28', 162), reading('2026-11-04', 162)])).toHaveLength(1)
  })

  it('proposes nothing across a guide that changed between the two sessions', () => {
    expect(proposeGuideChanges([reading('2026-10-28', 162), reading('2026-11-04', 162, { min: 268, max: 276 }, 272)])).toEqual([])
  })

  it('keeps repetition lengths apart: a long and a medium session are not two in a row', () => {
    const medium = readControlledSession(controlledRun('2026-10-31', even(164, 271, 5), 6), controlledPrescription('2026-10-31', 5, 6, { min: 268, max: 274 }))!
    expect(proposeGuideChanges([reading('2026-10-28', 162), medium])).toEqual([])
  })
})

describe('the fatigue flag', () => {
  const easyRun = (date: string, hr: number, overrides: Partial<EasyRunReading> = {}): EasyRunReading => ({
    activityId: `easy-${date}`, date, hr, paceSecPerKm: 345, gapSecPerKm: 344, climbMPerKm: 2, tempC: 14, durationSeconds: 3_300, ...overrides,
  })
  const normal = [easyRun('2026-10-20', 145), easyRun('2026-10-22', 146), easyRun('2026-10-27', 147)]

  it('flags an easy run 5 bpm above the recent normal at similar pace and temperature', () => {
    expect(assessFatigue([...normal, easyRun('2026-10-29', 151)])).toMatchObject({ normalHr: 146, comparables: 3, flagged: true })
  })

  it('leaves a run 4 bpm above it alone', () => {
    expect(assessFatigue([...normal, easyRun('2026-10-29', 150)])?.flagged).toBe(false)
  })

  it('does not compare a hot day with cool ones, and says it has too little to judge', () => {
    expect(assessFatigue([...normal, easyRun('2026-10-29', 155, { tempC: 24 })])).toMatchObject({ normalHr: null, comparables: 0, flagged: false })
  })

  it('compares a long run only with runs of similar length', () => {
    expect(assessFatigue([...normal, easyRun('2026-11-01', 152, { durationSeconds: 5_000 })])).toMatchObject({ normalHr: null, flagged: false })
  })

  it('compares a hilly run by its grade-adjusted pace, not the pace its walked climbs slowed', () => {
    const hilly = easyRun('2026-10-29', 151, { paceSecPerKm: 405, gapSecPerKm: 350, climbMPerKm: 20 })
    expect(assessFatigue([...normal, hilly])).toMatchObject({ normalHr: 146, comparables: 3, gradeAdjusted: 3, flagged: true })
  })

  it('leaves out a hilly run with no grade-adjusted pace and judges the latest run it can', () => {
    const hilly = easyRun('2026-10-29', 160, { gapSecPerKm: null, climbMPerKm: 20 })
    expect(assessFatigue([...normal, hilly])).toMatchObject({ run: { date: '2026-10-27' }, leftOut: [hilly], flagged: false })
  })
})

describe('the report over a plan', () => {
  it('finds the controlled threshold sessions the plan prescribed among the runs, across the archived block too', () => {
    const archived: CoachingPlan = plan({ id: 'old', weeks: [{ id: 'old:w', index: 1, startDate: '2026-11-02', endDate: '2026-11-08', focus: 'f', workouts: [controlledPrescription('2026-11-04')] }] })
    const current: CoachingPlan = plan({ id: 'new', weeks: [{ id: 'new:w', index: 1, startDate: '2026-11-09', endDate: '2026-11-15', focus: 'f', workouts: [controlledPrescription('2026-11-11')] }] })
    const runs = [controlledRun('2026-11-04', even(162)), controlledRun('2026-11-11', even(163))]
    const report = autoregulationReport(runs, [current, archived], '2026-11-11')
    expect(report.controlledSessions.map((session) => [session.date, session.verdict])).toEqual([['2026-11-04', 'under'], ['2026-11-11', 'under']])
    expect(report.guideProposals).toHaveLength(1)
  })
})

describe('the changes it would propose', () => {
  const named = (date: string, reps: number, minutes: number, guide: NumberRange) => {
    const middle = Math.round((guide.min + guide.max) / 2)
    const pace = `${Math.floor(middle / 60)}:${String(middle % 60).padStart(2, '0')}`
    const base = controlledPrescription(date, reps, minutes, guide)
    const repeat = base.blocks[1]!
    return {
      ...base,
      title: `Threshold · ${reps} × ${minutes}′ @ ${pace}`,
      shortName: `Threshold ${reps}×${minutes}′`,
      structure: { reps, repMinutes: minutes, targetPace: pace },
      blocks: [base.blocks[0]!, repeat.kind === 'repeat'
        ? { ...repeat, steps: [{ ...repeat.steps[0]!, notes: [`First 2-3 minutes: run the guide pace (4:32-4:40).`] }, repeat.steps[1]!] }
        : repeat, base.blocks[2]!],
    }
  }

  it('moves a guide, and the name, structure and quoted guide with it', async () => {
    const { withGuide } = await import('../autoregulation')
    const moved = withGuide(named('2026-11-04', 3, 10, LONG), LONG, { min: 268, max: 276 })!
    expect(moved.title).toBe('Threshold · 3 × 10′ @ 4:32')
    expect(moved.structure?.targetPace).toBe('4:32')
    const step = moved.blocks[1]!.kind === 'repeat' ? moved.blocks[1]!.steps[0]! : null
    expect(step?.target.paceSecPerKm).toEqual({ min: 268, max: 276 })
    expect(step?.target.hrBpm).toEqual({ min: 156, max: 173 })
    expect(step?.notes).toEqual(['First 2-3 minutes: run the guide pace (4:28-4:36).'])
  })

  it('leaves a session on another guide alone', async () => {
    const { withGuide } = await import('../autoregulation')
    expect(withGuide(named('2026-11-07', 5, 6, { min: 268, max: 274 }), LONG, { min: 268, max: 276 })).toBeNull()
  })

  it('lightens a week the athlete\'s way: two thirds of the repetitions, four fifths of the easy running', async () => {
    const { lighterWorkout } = await import('../autoregulation')
    const longReps = lighterWorkout(named('2026-11-04', 3, 10, LONG))!
    expect(longReps).toMatchObject({ title: 'Threshold · 2 × 10′ @ 4:36', shortName: 'Threshold 2×10′', structure: { reps: 2 } })
    const medium = lighterWorkout(named('2026-11-07', 5, 6, { min: 268, max: 274 }))!
    expect(medium.title).toBe('Threshold · 3 × 6′ @ 4:31')

    const easy = workout({
      type: 'easy', title: 'Easy · 8 km + 6 strides',
      blocks: [
        { kind: 'effort', target: { distanceMeters: 8_000, paceSecPerKm: { min: 330, max: 384 } } },
        { kind: 'repeat', repetitions: 6, steps: [{ kind: 'strides', target: { durationSeconds: 20 } }, { kind: 'recovery', target: { durationSeconds: 60 } }] },
      ],
    })
    const lighter = lighterWorkout(easy)!
    expect(lighter.title).toBe('Easy · 6.5 km + 6 strides')
    expect(lighter.blocks[0]).toMatchObject({ target: { distanceMeters: 6_500 } })
    expect(lighter.blocks[1]).toEqual(easy.blocks[1])
  })
})

describe('the fitness check', () => {
  const race = (date: string, seconds: number, distanceKm = 5.25): Activity =>
    ({ id: `race-${date}`, date, type: 'Race', sport: 'running', distanceKm, durationSeconds: seconds + 20, paceSecPerKm: 250, avgHeartRate: 190, hrSamples: null, splits: null, weather: null }) as Activity
  const current: CoachingPlan = plan({ id: 'p', weeks: [{ id: 'p:w', index: 1, startDate: '2026-11-02', endDate: '2026-11-08', focus: 'f', workouts: [controlledPrescription('2026-11-04')] }] })

  it('times a 5K by its official chip over 5 km, never by GPS distance', () => {
    const report = autoregulationReport([race('2026-11-14', 1_300)], [current], '2026-11-15', [{ activityId: 'race-2026-11-14', distanceMeters: 5_000, chipTimeSeconds: 1_290 }])
    expect(report.fitnessCheck).toMatchObject({ seconds: 1_290, paceSecPerKm: 258, previous: null, proposedGuides: [], impliedThresholdSecPerKm: 274 })
  })

  it('moves each guide by as much as the 5K moved since the check before it', () => {
    const report = autoregulationReport([race('2026-09-19', 1_300), race('2026-11-14', 1_274)], [current], '2026-11-15')
    // Without chip times, 1294 s against 1320 s: 2% faster, so 272-280 becomes 267-274.
    expect(report.fitnessCheck?.proposedGuides).toEqual([{ repClass: 'long', guide: LONG, proposedGuide: { min: 267, max: 274 } }])
  })

  it('takes a 5K from another season as no baseline to move from', () => {
    const report = autoregulationReport([race('2026-03-01', 1_200), race('2026-11-14', 1_274)], [current], '2026-11-15')
    expect(report.fitnessCheck).toMatchObject({ previous: null, proposedGuides: [] })
  })

  it('says nothing about a check older than the look-back', () => {
    expect(autoregulationReport([race('2026-08-01', 1_274)], [current], '2026-11-15').fitnessCheck).toBeNull()
  })
})
