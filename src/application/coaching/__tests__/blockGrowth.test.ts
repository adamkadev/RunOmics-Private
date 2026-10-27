import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, TrainingWeek, WorkoutBlock, WorkoutPrescription } from '@/domain/coaching/types'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CheckIn } from '@/domain/wellness/checkIn'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { blockGrowth, type BlockGrowthInput } from '../blockGrowth'
import { buildCoachingContext, type CoachingContextInput } from '../context'
import { controlledThresholdFacts } from '../controlledThreshold'
import { validateDraftVolume, weekKm, type VolumeBand } from '../volume'

const DAYS = [2, 3, 4, 6, 0]
const GUIDE = { min: 272, max: 280 }
const EASY = { min: 330, max: 360 }
const BAND: VolumeBand = { baselineKm: 56, capacityKm: 57, longestRunKm: 15 }

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const easy = (km: number): WorkoutBlock[] => [{ kind: 'effort', target: { distanceMeters: km * 1_000, paceSecPerKm: EASY } }]
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

function fullWeek(monday: string, index: number): TrainingWeek {
  return {
    id: `week-${index}`,
    index,
    startDate: monday,
    endDate: addDays(monday, 6),
    focus: 'Full week',
    workouts: [
      session(addDays(monday, 1), 'threshold', controlled()),
      session(addDays(monday, 2), 'easy', easy(10)),
      session(addDays(monday, 3), 'threshold', controlled()),
      session(addDays(monday, 5), 'easy', easy(10)),
      session(addDays(monday, 6), 'long_run', easy(15)),
    ],
  }
}

function generalBlock(): CoachingPlan {
  const general = plan()
  delete general.targetEvent
  return {
    ...general,
    block: { id: 'block-1', name: 'Controlled threshold', startDate: '2026-09-28', endDate: '2026-10-25', focus: 'Hold the full week' },
    weeks: [0, 1, 2, 3].map((offset) => fullWeek(addDays('2026-09-28', offset * 7), offset + 1)),
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

function input(overrides: Partial<BlockGrowthInput> = {}): BlockGrowthInput {
  return {
    plan: generalBlock(),
    runs: everyRun(),
    referenceDate: '2026-10-24',
    checkIns: [],
    niggles: [],
    returning: false,
    fatigueFlagged: false,
    band: BAND,
    ...overrides,
  }
}

const previousKm = Math.round(weekKm(fullWeek('2026-09-28', 1)) * 10) / 10

describe('growing the full week between blocks', () => {
  it('grows the full week 5% over a block run through without a break', () => {
    expect(blockGrowth(input()).growth).toEqual({ status: 'grown', previousWeekKm: previousKm, weekKm: Math.round(previousKm * 1.05 * 10) / 10 })
  })

  it('holds the level after a week without a run', () => {
    const runs = everyRun().filter((activity) => activity.date < '2026-10-05' || activity.date > '2026-10-12')
    expect(blockGrowth(input({ runs })).growth).toMatchObject({ status: 'held', reason: 'gap', weekKm: previousKm, detail: 'no run for 8 days from 2026-10-05' })
  })

  it('holds the level when the latest easy run flagged fatigue', () => {
    expect(blockGrowth(input({ fatigueFlagged: true })).growth).toMatchObject({ status: 'held', reason: 'fatigue', weekKm: previousKm })
  })

  it('holds the level after an illness check-in or a session skipped as ill', () => {
    const ill: ({ date: string } & CheckIn)[] = [{ date: '2026-10-14', ill: true }]
    const skipped: ({ date: string } & CheckIn)[] = [{ date: '2026-10-15', skipped: 'ill' }]
    expect(blockGrowth(input({ checkIns: ill })).growth).toMatchObject({ status: 'held', reason: 'illness' })
    expect(blockGrowth(input({ checkIns: skipped })).growth).toMatchObject({ status: 'held', reason: 'illness' })
  })

  it('holds the level after an injury break, whatever the runs show', () => {
    const breaks = [{ start: '2026-10-06', end: '2026-10-08', reason: 'injury' as const }]
    expect(blockGrowth(input({ breaks })).growth).toMatchObject({ status: 'held', reason: 'injury' })
  })

  it('holds the level on a niggle reported on three days, at pain 4, or that changed a run, and grows past a passing one', () => {
    const niggle = { site: 'calf' as const, side: 'left' as const, from: '2026-10-10', to: '2026-10-10', daysReported: 1, peakPain: 2, lastPain: 2, daysChangingRun: 0 }
    expect(blockGrowth(input({ niggles: [niggle] })).growth.status).toBe('grown')
    for (const recurring of [{ daysReported: 3 }, { peakPain: 4 }, { daysChangingRun: 1 }]) {
      expect(blockGrowth(input({ niggles: [{ ...niggle, ...recurring }] })).growth).toMatchObject({ status: 'held', reason: 'niggle', detail: 'a left calf niggle from 2026-10-10 to 2026-10-10' })
    }
  })

  it('holds the level when the check-ins could not be read', () => {
    const unread = input()
    delete unread.checkIns
    expect(blockGrowth(unread).growth).toMatchObject({ status: 'held', reason: 'check_ins_unread' })
  })

  it('holds the level after a block replaced within three weeks, and while returning', () => {
    expect(blockGrowth(input({ referenceDate: '2026-10-14' })).growth).toMatchObject({ status: 'held', reason: 'short_block' })
    expect(blockGrowth(input({ returning: true })).growth).toMatchObject({ status: 'held', reason: 'returning' })
  })

  it('holds the level where the volume ceiling would refuse the grown week', () => {
    const band = { ...BAND, capacityKm: 54 }
    expect(blockGrowth(input({ band }))).toEqual({
      growth: expect.objectContaining({ status: 'held', reason: 'ceiling', weekKm: previousKm }),
      maxWeekKm: 59.7,
    })
  })

  it('holds the level, under the ramp, where the ramp would refuse the grown week', () => {
    const band = { ...BAND, baselineKm: 48 }
    expect(blockGrowth(input({ band })).growth).toMatchObject({ status: 'held', reason: 'ramp', weekKm: 55.8 })
  })

  it('holds the level where the last block’s long run already sits past the long-run limit', () => {
    expect(blockGrowth(input({ band: { ...BAND, longestRunKm: 12 } })).growth).toMatchObject({ status: 'held', reason: 'long_run' })
  })

  it('starts from the best four weeks when no earlier block reached the full week, or the block was toward a race', () => {
    const building = generalBlock()
    building.weeks = building.weeks.map((week) => ({ ...week, workouts: week.workouts.filter((entry) => entry.date !== addDays(week.startDate, 3)) }))
    expect(blockGrowth(input({ plan: building })).growth).toEqual({ status: 'baseline' })
    expect(blockGrowth(input({ plan: { ...generalBlock(), targetEvent: plan().targetEvent! } })).growth).toEqual({ status: 'baseline' })
    expect(blockGrowth(input({ plan: null })).growth).toEqual({ status: 'baseline' })
  })
})

describe('what a renewed block is told', () => {
  it('centres the full week on the grown level, never past what the validators accept', () => {
    const grown = blockGrowth(input())
    expect(controlledThresholdFacts(179, 261, 50, grown.growth, grown.maxWeekKm)?.fullWeek).toMatchObject({
      weekKm: { min: 61.1, max: 62.9 },
      growth: { status: 'grown' },
    })
  })

  it('gives an athlete without an LTHR no full week to grow, so her blocks are written as before', () => {
    const grown = blockGrowth(input())
    expect(controlledThresholdFacts(undefined, 300, 20, grown.growth, grown.maxWeekKm)).toBeNull()

    const context = buildCoachingContext(contextInput({ maxHrBpm: 206, hrZoneBoundsBpm: [103, 124, 144, 165, 185] }), '2026-10-24')
    expect(context.controlledThreshold).toBeNull()
  })

  it('reads the growth through the context for the owner, held here by the ceiling the recent running sets', () => {
    const context = buildCoachingContext(contextInput({ lthrBpm: 179, thresholdPaceSecPerKm: 261 }), '2026-10-24')
    expect(context.controlledThreshold?.fullWeek.growth).toMatchObject({ status: 'held', reason: 'ceiling' })
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

describe('the validators on a grown block', () => {
  function draftWeek(monday: string): BootstrapWeekDraft {
    const grown = fullWeek(monday, 1)
    const longRun = grown.workouts.at(-1)!
    return {
      startDate: monday,
      endDate: addDays(monday, 6),
      focus: 'Full week, grown between blocks',
      workouts: [...grown.workouts.slice(0, 4).map((entry) => entry.type === 'easy' ? { ...entry, blocks: easy(11) } : entry), { ...longRun, blocks: easy(15.8) }],
    }
  }

  it('accept every full week of a block at the grown level', () => {
    const weeks = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map(draftWeek)
    const draft: CoachingPlanDraft = { name: 'Controlled threshold', focus: 'Full week grown after a block run through.', weeks }
    const grown = blockGrowth(input()).growth
    expect(grown.status).toBe('grown')
    for (const week of weeks) expect(Math.abs(weekKm(week) - (grown as { weekKm: number }).weekKm)).toBeLessThanOrEqual(1)
    expect(() => validateDraftVolume(draft, BAND, DAYS)).not.toThrow()
  })
})
