import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, TrainingWeek, WorkoutBlock, WorkoutPrescription } from '@/domain/coaching/types'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CheckIn, NiggleEpisode } from '@/domain/wellness/checkIn'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { bootstrapUserPrompt } from '@/infrastructure/ai/coachingPrompt'
import type { FatigueReading } from '../autoregulation'
import { blockTargets, type BlockTargetsInput } from '../blockTargets'
import { buildCoachingContext, type CoachingContextInput } from '../context'
import { controlledThresholdFacts } from '../controlledThreshold'
import { blockWeekTargets, validateDraftVolume, weekKm, type VolumeBand } from '../volume'

const DAYS = [2, 3, 4, 6, 0]
const GUIDE = { min: 272, max: 280 }
const EASY = { min: 330, max: 360 }
const BAND: VolumeBand = { baselineKm: 56, capacityKm: 57, longestRunKm: 15 }

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const easy = (km: number): WorkoutBlock[] => [{ kind: 'effort', target: { distanceMeters: Math.round(km * 1_000), paceSecPerKm: EASY } }]
const controlled = (): WorkoutBlock[] => [
  { kind: 'warmup', target: { distanceMeters: 3_000, paceSecPerKm: EASY } },
  {
    kind: 'repeat',
    repetitions: 3,
    steps: [
      { kind: 'effort', target: { durationSeconds: 600, paceSecPerKm: GUIDE, hrBpm: { min: 160, max: 173 } } },
      { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: EASY } },
    ],
  },
  { kind: 'cooldown', target: { distanceMeters: 2_000, paceSecPerKm: EASY } },
]

function session(date: string, type: WorkoutPrescription['type'], blocks: WorkoutBlock[]): WorkoutPrescription {
  return workout({ id: `${type}-${date}`, date, type, title: type, blocks })
}

function fullWeek(monday: string, index: number, easyKm = 10, longKm = 15): TrainingWeek {
  return {
    id: `week-${index}`,
    index,
    startDate: monday,
    endDate: addDays(monday, 6),
    focus: 'Full week',
    workouts: [
      session(addDays(monday, 1), 'threshold', controlled()),
      session(addDays(monday, 2), 'easy', easy(easyKm)),
      session(addDays(monday, 3), 'threshold', controlled()),
      session(addDays(monday, 5), 'easy', easy(easyKm)),
      session(addDays(monday, 6), 'long_run', easy(longKm)),
    ],
  }
}

function generalBlock(): CoachingPlan {
  const general = plan()
  delete general.targetEvent
  return {
    ...general,
    block: { id: 'block-1', name: 'Controlled threshold', startDate: '2026-09-28', endDate: '2026-10-25', focus: 'Three up, one down' },
    weeks: [0, 1, 2, 3].map((offset) => fullWeek(addDays('2026-09-28', offset * 7), offset + 1, 10 + offset)),
  }
}

function run(date: string): Activity {
  return { id: `run-${date}`, date, type: 'Base', sport: 'running', distanceKm: 10, durationSeconds: 3_300, paceSecPerKm: 330, avgHeartRate: 140 } as Activity
}

function everyRun(from = '2026-09-28', to = '2026-10-24'): Activity[] {
  const runs: Activity[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (DAYS.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) runs.push(run(date))
  }
  return runs
}

function fatigue(above: number): FatigueReading {
  const reading = { activityId: 'easy', date: '2026-10-22', hr: 140 + above, paceSecPerKm: 330, gapSecPerKm: null, climbMPerKm: 2, tempC: 12, durationSeconds: 3_300 }
  return { run: reading, normalHr: 140, comparables: 4, gradeAdjusted: 0, leftOut: [], flagged: above >= 5 }
}

function input(overrides: Partial<BlockTargetsInput> = {}): BlockTargetsInput {
  return {
    plan: generalBlock(),
    runs: everyRun(),
    referenceDate: '2026-10-24',
    checkIns: [],
    niggles: [],
    fatigue: fatigue(1),
    best4WeekAverageKm: 55,
    band: BAND,
    ...overrides,
  }
}

const previousWeek1 = Math.round(weekKm(fullWeek('2026-09-28', 1)))
const niggle: NiggleEpisode = { site: 'calf', side: 'left', from: '2026-10-10', to: '2026-10-10', daysReported: 1, peakPain: 2, lastPain: 2, daysChangingRun: 0 }
const poorMornings: ({ date: string } & CheckIn)[] = ['2026-10-14', '2026-10-17', '2026-10-20'].map((date) => ({ date, sleep: 2, soreness: 4 }))

describe('the signal behind a block', () => {
  it('is green on a block run through with nothing to report, and rises 5% a week from 5% over the last week 1', () => {
    expect(previousWeek1).toBe(59)
    expect(blockTargets(input())).toEqual({
      signal: 'green',
      reasons: ['no fatigue flag, illness, niggle, gap or run of poor check-ins; easy-run heart rate +1 bpm on normal'],
      weeklyRisePct: 5,
      previousWeek1Km: 59,
      weekKmTargets: [62, 65, 68, 54],
      heldBy: [],
    })
  })

  it('is yellow on an easy run 3-4 bpm high, a run of poor mornings, a mild niggle or unread check-ins, and rises 2%', () => {
    const unread = input()
    delete unread.checkIns
    for (const yellow of [input({ fatigue: fatigue(3) }), input({ checkIns: poorMornings }), input({ niggles: [niggle] }), unread]) {
      expect(blockTargets(yellow)).toMatchObject({ signal: 'yellow', weeklyRisePct: 2, weekKmTargets: [60, 61, 63, 50] })
    }
    expect(blockTargets(input({ checkIns: poorMornings })).reasons).toEqual(['3 poor check-ins in the last 14 days'])
  })

  it('is red on a fatigue flag, a serious or recurring niggle or a short block, and holds the last block’s level', () => {
    const red = [
      input({ fatigue: fatigue(5) }),
      ...[{ peakPain: 4 }, { daysReported: 3 }, { daysChangingRun: 1 }].map((serious) => input({ niggles: [{ ...niggle, ...serious }] })),
      input({ referenceDate: '2026-10-14' }),
    ]
    for (const signal of red) expect(blockTargets(signal)).toMatchObject({ signal: 'red', weeklyRisePct: 0, weekKmTargets: [59, 59, 59, 47] })
  })

  it('comes down to the running since a gap, an illness or a break, never above the last level', () => {
    const runs = everyRun().filter((activity) => activity.date < '2026-10-05' || activity.date > '2026-10-12')
    const band = { ...BAND, baselineKm: 40 }
    const afterBreak = [
      input({ runs, band }),
      input({ checkIns: [{ date: '2026-10-14', ill: true }], band }),
      input({ checkIns: [{ date: '2026-10-15', skipped: 'ill' }], band }),
      input({ breaks: [{ start: '2026-10-06', end: '2026-10-08', reason: 'injury' }], band }),
    ]
    for (const signal of afterBreak) {
      expect(blockTargets(signal)).toMatchObject({ signal: 'red', weekKmTargets: [40, 40, 40, 32], heldBy: ['the running since the break'] })
    }
    expect(blockTargets(afterBreak[0]!).reasons).toEqual(['no run for 8 days from 2026-10-05'])
  })

  it('opens a first block at the best four weeks, rising from there', () => {
    expect(blockTargets(input({ plan: null }))).toMatchObject({ signal: 'green', previousWeek1Km: null, weekKmTargets: [55, 58, 61, 49] })
    expect(blockTargets(input({ plan: { ...generalBlock(), targetEvent: plan().targetEvent! } })).previousWeek1Km).toBeNull()
  })
})

describe('the bounds on a block', () => {
  it('lets the capacity ceiling hold week 1 alone, so a long build passes a capacity it has not yet shown', () => {
    const targets = blockTargets(input({ band: { ...BAND, capacityKm: 54 } }))
    expect(targets).toMatchObject({ weekKmTargets: [60, 63, 66, 53], heldBy: ['the volume ceiling set by recent running'] })
  })

  it('holds week 1 under the ramp from the last weeks run', () => {
    expect(blockTargets(input({ band: { ...BAND, baselineKm: 48 } }))).toMatchObject({ weekKmTargets: [56, 59, 61, 49], heldBy: ['the ramp from the last weeks run'] })
  })

  it('stops at the athlete’s weekly maximum and keeps the lighter fourth week there', () => {
    expect(blockTargets(input({ maxWeeklyKm: 64 }))).toMatchObject({ weekKmTargets: [62, 64, 64, 51], heldBy: ["the athlete's weekly maximum of 64 km"] })
  })
})

describe('laying the targets over the block’s weeks', () => {
  const windows = (dates: [string, string][]) => dates.map(([startDate, endDate]) => ({ startDate, endDate }))

  it('gives four Monday weeks the four targets, the last one lighter', () => {
    const weeks = windows([['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15'], ['2026-11-16', '2026-11-22']])
    expect(blockWeekTargets([62, 65, 68, 54], weeks, DAYS)).toEqual([
      { km: 62, lighter: false }, { km: 65, lighter: false }, { km: 68, lighter: false }, { km: 54, lighter: true },
    ])
  })

  it('opens a block started on a Friday with a lead-in at week 1’s level, scaled to its run days, and ends it in the lighter week', () => {
    const weeks = windows([['2026-10-30', '2026-11-01'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15'], ['2026-11-16', '2026-11-22'], ['2026-11-23', '2026-11-26']])
    expect(blockWeekTargets([62, 65, 68, 54], weeks, DAYS)).toEqual([
      { km: 24.8, lighter: false }, { km: 62, lighter: false }, { km: 65, lighter: false }, { km: 68, lighter: false }, { km: 32.4, lighter: true },
    ])
  })
})

describe('the volume check on a 3 + 1 block', () => {
  const mondays = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']
  const LIGHTER = { reason: 'cutback' as const, explanation: 'The planned lighter week of the block.' }
  function draftWeek(monday: string, easyKm: number, longKm: number): BootstrapWeekDraft {
    const week = fullWeek(monday, 1, easyKm, longKm)
    return { startDate: week.startDate, endDate: week.endDate, focus: 'Green: rising', workouts: week.workouts }
  }
  const shape = (): BootstrapWeekDraft[] => [
    draftWeek(mondays[0]!, 11, 16), draftWeek(mondays[1]!, 12.5, 16), draftWeek(mondays[2]!, 14, 16),
    { ...draftWeek(mondays[3]!, 7.5, 15), reducedVolume: LIGHTER },
  ]
  const targets = blockWeekTargets([62, 65, 68, 54], mondays.map((startDate) => ({ startDate, endDate: addDays(startDate, 6) })), DAYS)
  const draft = (weeks: BootstrapWeekDraft[]): CoachingPlanDraft => ({ name: 'Controlled threshold', focus: 'Green signals, so the block rises.', weeks })

  it('accepts exactly the target shape, past the ceiling the capacity alone would set', () => {
    expect(shape().map((week) => Math.round(weekKm(week)))).toEqual([62, 65, 68, 54])
    expect(() => validateDraftVolume(draft(shape()), BAND, DAYS)).toThrow(/beyond the 62.9 km/)
    expect(() => validateDraftVolume(draft(shape()), BAND, DAYS, undefined, false, targets)).not.toThrow()
  })

  it('refuses a week off its target, and a lighter week that does not say so', () => {
    const flat = shape()
    flat[2] = draftWeek(mondays[2]!, 12.5, 16)
    expect(() => validateDraftVolume(draft(flat), BAND, DAYS, undefined, false, targets)).toThrow(/target of 68 km/)
    const unmarked = shape()
    delete unmarked[3]!.reducedVolume
    expect(() => validateDraftVolume(draft(unmarked), BAND, DAYS, undefined, false, targets)).toThrow(/lighter week/)
  })

  it('still holds the long run to its limit inside a week on target', () => {
    const outsized = shape()
    outsized[0] = draftWeek(mondays[0]!, 8.5, 21)
    expect(() => validateDraftVolume(draft(outsized), BAND, DAYS, undefined, false, targets)).toThrow(/longest run/)
  })
})

function contextInput(athlete: CoachingContextInput['athlete']): CoachingContextInput {
  return {
    activities: everyRun(),
    plan: generalBlock(),
    athlete,
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: null,
    trajectories: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
    officialResults: [],
    wellness: new Map(),
  }
}

describe('what a renewed block is told', () => {
  it('gives the owner the targets, the full week the loading range, and the maximum from athlete.json', () => {
    const context = buildCoachingContext(contextInput({ lthrBpm: 179, thresholdPaceSecPerKm: 261, maxWeeklyKm: 70 }), '2026-10-24')
    expect(context.athlete.maxWeeklyKm).toBe(70)
    const block = context.controlledThreshold?.block
    expect(block?.weekKmTargets).toHaveLength(4)
    expect(context.controlledThreshold?.fullWeek.weekKm).toEqual({ min: block!.weekKmTargets[0], max: block!.weekKmTargets[2] })
  })

  it('states each week’s target in a general block’s prompt and none toward a race', () => {
    const context = buildCoachingContext(contextInput({ lthrBpm: 179, thresholdPaceSecPerKm: 261 }), '2026-10-24')
    const request = { context, availableWeekdays: DAYS, planningStartDate: '2026-10-26', horizonEndDate: '2026-11-22', tuneUpEvents: [], macrocycleStartDate: '2026-09-28' }
    const general = bootstrapUserPrompt({ ...request, primaryTargetEvent: null })
    const targets = context.controlledThreshold!.block!.weekKmTargets
    expect(general).toContain(`CONTROLLED_THRESHOLD_BLOCK_WEEKS (each week's km within 1 km of its target): [{"startDate":"2026-10-26","endDate":"2026-11-01","targetKm":${targets[0]},"lighter":false}`)
    expect(bootstrapUserPrompt({ ...request, primaryTargetEvent: { ...plan().targetEvent!, date: '2026-11-22', role: 'primary' } })).not.toContain('CONTROLLED_THRESHOLD_BLOCK_WEEKS')
  })

  it('gives an athlete without an LTHR no controlled threshold block at all', () => {
    const context = buildCoachingContext(contextInput({ maxHrBpm: 206, hrZoneBoundsBpm: [103, 124, 144, 165, 185] }), '2026-10-24')
    expect(context.controlledThreshold).toBeNull()
    expect(controlledThresholdFacts(undefined, 300, 20, blockTargets(input()))).toBeNull()
  })

  it('sets no targets while returning, when the return rules set every week', () => {
    const returning = contextInput({ lthrBpm: 179, trainingBreaks: [{ start: '2026-08-01', end: '2026-10-20', reason: 'injury' }] })
    const context = buildCoachingContext({ ...returning, activities: [run('2026-10-22')] }, '2026-10-24')
    expect(context.returnToRunning).toBeDefined()
    expect(context.controlledThreshold).not.toHaveProperty('block')
  })
})
