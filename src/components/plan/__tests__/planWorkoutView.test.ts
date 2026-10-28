import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { CoachingPlan, WorkoutBlock, WorkoutPrescription } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { coachWorkoutView, plannedWorkoutView } from '../planWorkoutView'

const ZONES: TrainingZonesData = {
  thresholdPaceSecPerKm: 265,
  zones: [
    { key: 'easy', label: 'Easy', shortDesc: '', hrZone: 2, paceMinSecPerKm: 310, paceMaxSecPerKm: 387 },
    { key: 'threshold', label: 'Threshold', shortDesc: '', hrZone: 4, paceMinSecPerKm: 260, paceMaxSecPerKm: 270 },
  ],
}

function recovery(overrides: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return workout({
    id: 'workout-recovery',
    date: '2026-09-09',
    type: 'recovery',
    title: 'Post-Race Recovery Run',
    description: "Very easy recovery run to clear fatigue from yesterday's race.",
    notes: ['Keep effort strictly easy and controlled.'],
    totalDurationSeconds: undefined,
    totalDistanceMeters: 4_000,
    blocks: [{ kind: 'effort', target: { distanceMeters: 4_000, paceSecPerKm: { min: 350, max: 387 } } }],
    ...overrides,
  })
}

function viewOf(prescription: WorkoutPrescription): PrescriptionView {
  const coachingPlan: CoachingPlan = plan()
  coachingPlan.weeks[0]!.workouts = [prescription]
  coachingPlan.weeks[1]!.workouts = []
  return buildCoachingOverview(coachingPlan, [], [], '2026-09-09').workouts[0]!
}

describe('a session’s distance on Plan and Today', () => {
  const fourthOfNovember = workout({
    id: 'workout-return',
    type: 'easy',
    totalDurationSeconds: undefined,
    blocks: [
      { kind: 'warmup', target: { durationSeconds: 300 } },
      { kind: 'effort', target: { durationSeconds: 900, paceSecPerKm: { min: 470, max: 525 } } },
      { kind: 'cooldown', target: { durationSeconds: 300 } },
    ],
  })

  function overviewOf(prescription: WorkoutPrescription, easyPace?: { min: number; max: number } | null): PrescriptionView {
    const coachingPlan: CoachingPlan = plan()
    coachingPlan.weeks[0]!.workouts = [prescription]
    coachingPlan.weeks[1]!.workouts = []
    return buildCoachingOverview(coachingPlan, [], [], '2026-09-09', easyPace).workouts[0]!
  }

  it('runs the untargeted warm-up and cool-down at the athlete’s easy pace zone', () => {
    const view = overviewOf(fourthOfNovember, { min: ZONES.zones[0]!.paceMinSecPerKm, max: ZONES.zones[0]!.paceMaxSecPerKm })
    expect(coachWorkoutView(view, ZONES).distanceM).toBe(Math.round(1_809 + (600 * 2_000) / (310 + 387)))
  })

  it('falls back to the plan’s own easy range without zones', () => {
    expect(overviewOf(fourthOfNovember).distanceMeters).toBe(3_015)
  })

  it('counts nothing for a walk the notes name', () => {
    const walked = workout({
      ...fourthOfNovember,
      blocks: fourthOfNovember.blocks.map((block) => (block.kind === 'effort' ? block : { ...block, notes: ['Marche active.'] })),
    })
    expect(overviewOf(walked).distanceMeters).toBe(1_809)
  })
})

describe('coach prescriptions normalised into the Plan session view', () => {
  it('derives the duration of a session stated only as distance and pace', () => {
    const view = coachWorkoutView(viewOf(recovery()), ZONES)

    expect(view.duration).toEqual({ seconds: 1_474, estimated: true })
    expect(view.distanceM).toBe(4_000)
  })

  it('marks a derived duration as approximate and a stated one as exact', () => {
    const derived = coachWorkoutView(viewOf(recovery()), ZONES)
    const stated = coachWorkoutView(viewOf(recovery({ totalDurationSeconds: 1_500 })), ZONES)

    expect(derived.duration?.estimated).toBe(true)
    expect(stated.duration).toEqual({ seconds: 1_500, estimated: false })
  })

  it('names the effort band from the athletes own zones', () => {
    const view = coachWorkoutView(viewOf(recovery()), ZONES)

    expect(view.type).toBe('Base')
    expect(view.effort).toContain(t.plan.easyEffortLabel)
  })

  it('keeps the pace the coach prescribed rather than the zone band', () => {
    const view = coachWorkoutView(viewOf(recovery()), ZONES)

    expect(view.effort).toContain('5:50–6:27/km')
    expect(view.effort).not.toContain('5:10')
    expect(view.target).toBe(view.effort)
  })

  it('paces the row by the work and the sheet by the whole session', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 900, paceSecPerKm: { min: 350, max: 387 } } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 260, max: 270 } } },
          { kind: 'recovery', target: { durationSeconds: 120, paceSecPerKm: { min: 380, max: 420 } } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 600, paceSecPerKm: { min: 350, max: 387 } } },
    ]
    const view = coachWorkoutView(viewOf(recovery({ title: 'Threshold 3 × 8 min', blocks })), ZONES)

    expect(view.effort).toContain('4:20–4:30/km')
    expect(view.effort).not.toContain('7:00')
    expect(view.target).toContain('4:20–7:00/km')
  })

  it('keeps the row on its zone band when only the bookends are paced', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 900, paceSecPerKm: { min: 350, max: 387 } } },
      { kind: 'effort', target: { durationSeconds: 1_800 } },
      { kind: 'cooldown', target: { durationSeconds: 600, paceSecPerKm: { min: 350, max: 387 } } },
    ]
    const view = coachWorkoutView(viewOf(recovery({ blocks })), ZONES)

    expect(view.effort).toContain('5:10')
    expect(view.target).toContain('5:50–6:27/km')
  })

  it('falls back to the zone band only when the coach states no pace', () => {
    const view = coachWorkoutView(
      viewOf(recovery({ blocks: [{ kind: 'effort', target: { distanceMeters: 4_000, durationSeconds: 1_500 } }] })),
      ZONES
    )

    expect(view.effort).toContain('5:10')
  })

  it('multiplies repeats and counts timed recoveries into the total', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 600 } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 265, max: 270 } } },
          { kind: 'recovery', target: { durationSeconds: 120 } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ]
    const view = coachWorkoutView(viewOf(recovery({ totalDurationSeconds: undefined, blocks })), ZONES)

    expect(view.duration).toEqual({ seconds: 3_000, estimated: false })
  })

  it('counts short timed strides rather than dropping them', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'effort', target: { durationSeconds: 1_800 } },
      {
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20 } },
          { kind: 'recovery', target: { durationSeconds: 60 } },
        ],
      },
    ]
    const view = coachWorkoutView(viewOf(recovery({ totalDurationSeconds: undefined, blocks })), ZONES)

    expect(view.duration).toEqual({ seconds: 2_280, estimated: false })
  })

  it('offers no duration at all when a segment can be neither timed nor paced', () => {
    const view = coachWorkoutView(
      viewOf(recovery({ totalDurationSeconds: undefined, blocks: [{ kind: 'effort', target: { distanceMeters: 4_000 } }] })),
      ZONES
    )

    expect(view.duration).toBeNull()
  })

  it('takes the time of day from a Garmin session matched to the prescription', () => {
    const garmin: PlannedWorkout = { date: '2026-09-09', name: 'Recovery', type: 'Base', scheduledTime: 'Evening' }
    const view = coachWorkoutView(viewOf(recovery()), ZONES, garmin)

    expect(view.scheduledTime).toBe('Evening')
    expect(view.title).toBe('Post-Race Recovery Run')
  })
})

describe('structure, only where there is structure to show', () => {
  it('offers none for a single continuous run', () => {
    expect(coachWorkoutView(viewOf(recovery()), ZONES).structure).toBeNull()
  })

  it('draws the shape of a genuine interval session', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 900 } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { distanceMeters: 1_600, paceSecPerKm: { min: 260, max: 270 } } },
          { kind: 'recovery', target: { durationSeconds: 120 } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ]
    const view = coachWorkoutView(viewOf(recovery({ title: 'Threshold 3 × 1600m', blocks })), ZONES)

    expect(view.structure).not.toBeNull()
    expect(view.structure!.filter((step) => step.kind === 'effort')).toHaveLength(3)
    expect(view.structure!.filter((step) => step.kind === 'recovery')).toHaveLength(3)
    expect(view.structure![0]!.kind).toBe('warmup')
    expect(view.structure!.at(-1)!.kind).toBe('cooldown')
    expect(view.structure!.find((step) => step.kind === 'effort')!.paceSecPerKm).toEqual([260, 270])
  })

  it('splits the leftover time into bookends stated only by distance', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { distanceMeters: 2_000 } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { durationSeconds: 480 } },
          { kind: 'recovery', target: { durationSeconds: 120 } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ]
    const view = coachWorkoutView(viewOf(recovery({ totalDurationSeconds: 3_600, blocks })), ZONES)

    expect(view.structure!.find((step) => step.kind === 'warmup')!.minutes).toBeGreaterThan(0)
  })

  it('draws nothing when an effort itself can be neither timed nor paced', () => {
    const blocks: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 600 } },
      { kind: 'effort', target: { distanceMeters: 5_000 } },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ]

    expect(coachWorkoutView(viewOf(recovery({ blocks })), ZONES).structure).toBeNull()
  })
})

describe('a Garmin planned workout is untouched by any of this', () => {
  const garmin: PlannedWorkout = {
    date: '2026-09-09',
    name: 'Track session',
    type: 'Threshold',
    durationSecs: 3_600,
    distanceM: 12_000,
    scheduledTime: 'Morning',
  }

  it('states exactly what Garmin says, with no coaching additions', () => {
    const view = plannedWorkoutView(garmin, ZONES)

    expect(view.title).toBe('Track session')
    expect(view.duration).toEqual({ seconds: 3_600, estimated: false })
    expect(view.distanceM).toBe(12_000)
    expect(view.scheduledTime).toBe('Morning')
    expect(view.description).toBeNull()
    expect(view.notes).toEqual([])
    expect(view.target).toBeNull()
    expect(view.effort).toBe('Threshold · 4:20-4:30 /km')
  })
})
