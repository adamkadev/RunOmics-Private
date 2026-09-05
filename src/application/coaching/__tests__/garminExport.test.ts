import { describe, expect, it } from 'vitest'
import {
  buildGarminExport,
  formatGarminWorkout,
  formatGarminWorkouts,
  selectGarminExportWorkouts,
} from '../garminExport'
import { plan, provenance, workout } from '@/domain/coaching/__tests__/fixtures'
import { withCourseAwareRacePacing } from '@/domain/coaching/coursePacing'
import type { CoachingPlan, TargetEvent, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'

const today = '2026-09-07'

function easyRun(overrides: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return workout({
    id: 'workout-easy',
    date: '2026-09-16',
    type: 'easy',
    title: 'Easy Aerobic Run',
    description: 'Steady aerobic run.',
    notes: undefined,
    totalDurationSeconds: undefined,
    blocks: [{ kind: 'effort', target: { distanceMeters: 7_000, paceSecPerKm: { min: 310, max: 387 } } }],
    ...overrides,
  })
}

function thresholdRun(overrides: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return workout({
    id: 'workout-threshold',
    date: '2026-09-15',
    type: 'threshold',
    title: 'Threshold 3 x 1600m',
    description: 'Threshold interval session.',
    notes: ['Target threshold pace on reps.'],
    totalDurationSeconds: undefined,
    blocks: [
      { kind: 'warmup', target: { distanceMeters: 2_000, paceSecPerKm: { min: 310, max: 387 } } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { distanceMeters: 1_600, paceSecPerKm: { min: 260, max: 270 } }, notes: ['Controlled threshold effort.'] },
          { kind: 'recovery', target: { durationSeconds: 120 } },
        ],
      },
      { kind: 'cooldown', target: { distanceMeters: 2_000 } },
    ],
    ...overrides,
  })
}

function stridesRun(overrides: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return workout({
    id: 'workout-strides',
    date: '2026-09-12',
    type: 'easy',
    title: 'Easy Run with Strides',
    description: 'Easy run with light strides.',
    notes: undefined,
    totalDurationSeconds: undefined,
    blocks: [
      { kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 310, max: 387 } } },
      {
        kind: 'repeat',
        repetitions: 4,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20 } },
          { kind: 'recovery', target: { durationSeconds: 40 } },
        ],
      },
    ],
    ...overrides,
  })
}

const courseAwareEvent: TargetEvent = {
  id: 'tune-up-5k',
  name: 'Autumn Hill 5K',
  date: '2026-10-03',
  role: 'tune_up',
  distanceLabel: '5K',
  distanceMeters: 5_000,
  targetSeconds: 1_200,
  courseContext: {
    pacingNotes: ['Hilly course with an existing course-aware PacePro strategy on the watch.'],
  },
}

function raceWorkout(): WorkoutPrescription {
  return workout({
    id: 'workout-race',
    date: '2026-10-03',
    type: 'race',
    title: 'Autumn Hill 5K Race',
    description: '5K tune-up race.',
    notes: undefined,
    totalDurationSeconds: undefined,
    blocks: [
      { kind: 'warmup', target: { distanceMeters: 2_000 } },
      { kind: 'effort', target: { distanceMeters: 5_000, paceSecPerKm: { min: 240, max: 240 } } },
      { kind: 'cooldown', target: { distanceMeters: 2_000 } },
    ],
  })
}

function planWith(workouts: WorkoutPrescription[], overrides: Partial<CoachingPlan> = {}): CoachingPlan {
  const base = plan(overrides)
  return {
    ...base,
    weeks: [
      { id: 'week-1', index: 1, startDate: '2026-09-07', endDate: '2026-09-20', focus: 'Build', workouts: workouts.filter((w) => w.date <= '2026-09-20') },
      { id: 'week-2', index: 2, startDate: '2026-09-21', endDate: '2026-10-04', focus: 'Sharpen', workouts: workouts.filter((w) => w.date > '2026-09-20') },
    ],
  }
}

function evaluation(prescriptionId: string, matchStatus: WorkoutEvaluation['matchStatus'] = 'matched'): WorkoutEvaluation {
  return {
    schemaVersion: 1,
    id: `evaluation-${prescriptionId}`,
    activityId: 'activity-1',
    activityDate: '2026-09-12',
    prescriptionId,
    planId: 'plan-1',
    planRevision: 1,
    matchStatus,
    decisionId: 'decision-1',
    summary: 'Completed as prescribed.',
    createdAt: '2026-09-12T10:00:00.000Z',
    contextHash: 'hash',
    provenance: provenance('post_activity'),
  }
}

describe('selectGarminExportWorkouts', () => {
  it('keeps only future prescribed and adjusted sessions, in chronological order', () => {
    const past = easyRun({ id: 'workout-past', date: '2026-09-01' })
    const cancelled = easyRun({ id: 'workout-cancelled', date: '2026-09-18', status: 'cancelled' })
    const completed = stridesRun({ id: 'workout-completed', date: '2026-09-12' })
    const adjusted = easyRun({ id: 'workout-adjusted', date: '2026-09-09', status: 'adjusted' })
    const source = planWith([easyRun(), thresholdRun(), past, cancelled, completed, adjusted])

    const selected = selectGarminExportWorkouts(source, [evaluation('workout-completed')], { today })

    expect(selected.map((entry) => entry.id)).toEqual(['workout-adjusted', 'workout-threshold', 'workout-easy'])
  })

  it('ignores an unmatched evaluation, so a date-only guess never drops a session', () => {
    const source = planWith([stridesRun()])

    const selected = selectGarminExportWorkouts(source, [evaluation('workout-strides', 'date_only')], { today })

    expect(selected.map((entry) => entry.id)).toEqual(['workout-strides'])
  })

  it('applies --from and --to, and never reaches back before today', () => {
    const source = planWith([stridesRun(), thresholdRun(), easyRun()])

    expect(selectGarminExportWorkouts(source, [], { today, from: '2026-09-15' }).map((e) => e.date)).toEqual(['2026-09-15', '2026-09-16'])
    expect(selectGarminExportWorkouts(source, [], { today, to: '2026-09-15' }).map((e) => e.date)).toEqual(['2026-09-12', '2026-09-15'])
    expect(selectGarminExportWorkouts(source, [], { today, from: '2026-01-01' }).map((e) => e.date)).toEqual(['2026-09-12', '2026-09-15', '2026-09-16'])
  })
})

describe('formatGarminWorkout', () => {
  it('renders a repeat session with its warm up, pace ranges and cool down', () => {
    const source = planWith([thresholdRun()])

    expect(formatGarminWorkout(source, thresholdRun())).toBe(
      [
        '2026-09-15 — Threshold 3 x 1600m',
        'Sport: Running',
        '',
        'Warm up:',
        '2 km easy at 5:10-6:27/km',
        '',
        'Repeat 3 times:',
        '- 1600 m at 4:20-4:30/km — Controlled threshold effort.',
        '- 2 min easy jog recovery',
        '',
        'Cool down:',
        '2 km easy',
        '',
        'Notes:',
        '- Threshold interval session.',
        '- Target threshold pace on reps.',
      ].join('\n'),
    )
  })

  it('renders a single-effort easy run without a block heading', () => {
    const source = planWith([easyRun()])

    expect(formatGarminWorkout(source, easyRun())).toBe(
      [
        '2026-09-16 — Easy Aerobic Run',
        'Sport: Running',
        '',
        '7 km easy at 5:10-6:27/km',
        '',
        'Notes:',
        '- Steady aerobic run.',
      ].join('\n'),
    )
  })

  it('preserves strides and their recovery as a repeat block', () => {
    const source = planWith([stridesRun()])

    expect(formatGarminWorkout(source, stridesRun())).toContain(
      ['Repeat 4 times:', '- 20 s strides', '- 40 s easy jog recovery'].join('\n'),
    )
  })

  it('renders heart-rate targets when the prescription uses them', () => {
    const hrRun = easyRun({
      blocks: [{ kind: 'effort', target: { durationSeconds: 2_700, hrBpm: { min: 135, max: 148 }, hrZone: 2 } }],
    })

    expect(formatGarminWorkout(planWith([hrRun]), hrRun)).toContain('45 min easy at HR 135-148 bpm, HR zone 2')
  })

  it('invents no target for a segment the prescription leaves open', () => {
    const openRun = easyRun({ blocks: [{ kind: 'effort', target: { distanceMeters: 8_000 } }] })

    expect(formatGarminWorkout(planWith([openRun]), openRun)).toContain('\n8 km easy\n')
  })

  it('states the race target time and keeps an explicit race pace', () => {
    const source = planWith([raceWorkout()], { tuneUpEvents: [{ ...courseAwareEvent, courseContext: undefined }] })

    const text = formatGarminWorkout(source, raceWorkout())

    expect(text).toContain(['Race:', '5 km at 4:00/km', 'Target time: 20:00'].join('\n'))
    expect(text).not.toContain('Average goal pace')
  })

  it('keeps a course-aware race an average goal rather than a constant pace', () => {
    const source = planWith([raceWorkout()], { tuneUpEvents: [courseAwareEvent] })
    const race = withCourseAwareRacePacing(raceWorkout(), courseAwareEvent)

    const text = formatGarminWorkout(source, race)

    expect(text).toContain(
      [
        'Race:',
        '5 km',
        'Target time: 20:00',
        'Average goal pace: 4:00/km',
        'Run by controlled race effort and follow the supplied course/PacePro strategy; allow pace to vary with the terrain.',
        'Hilly course with an existing course-aware PacePro strategy on the watch.',
      ].join('\n'),
    )
    // The refined effort carries no pace range, and none is reconstructed for it.
    expect(text).not.toContain('5 km at')
    expect(text.match(/Average goal pace/g)).toHaveLength(1)
  })

  it('restates supplied course guidance a plan never copied onto the effort', () => {
    const race = raceWorkout()
    race.blocks[1] = { kind: 'effort', target: { distanceMeters: 5_000 } }
    const source = planWith([race], { tuneUpEvents: [courseAwareEvent] })

    expect(formatGarminWorkout(source, race)).toContain('Hilly course with an existing course-aware PacePro strategy on the watch.')
  })
})

describe('formatGarminWorkouts', () => {
  it('separates each dated workout with a blank gap and ends with a newline', () => {
    const source = planWith([thresholdRun(), easyRun()])

    const text = formatGarminWorkouts(source, [thresholdRun(), easyRun()])

    expect(text.split('\n\n\n')).toHaveLength(2)
    expect(text).toContain('- Target threshold pace on reps.\n\n\n2026-09-16 — Easy Aerobic Run\nSport: Running')
    expect(text.endsWith('\n')).toBe(true)
    expect(text.match(/^\d{4}-\d{2}-\d{2} — /gm)).toEqual(['2026-09-15 — ', '2026-09-16 — '])
  })

  it('is deterministic across renders', () => {
    const source = planWith([thresholdRun(), easyRun()])
    const workouts = [thresholdRun(), easyRun()]

    expect(formatGarminWorkouts(source, workouts)).toBe(formatGarminWorkouts(source, workouts))
  })
})

describe('buildGarminExport', () => {
  it('names the file after the exported window', () => {
    const source = planWith([stridesRun(), thresholdRun(), easyRun()])

    const exported = buildGarminExport(source, [], { today })

    expect(exported?.fileName).toBe('importmyworkout-2026-09-12-to-2026-09-16.txt')
    expect(exported?.startDate).toBe('2026-09-12')
    expect(exported?.endDate).toBe('2026-09-16')
    expect(exported?.workouts).toHaveLength(3)
  })

  it('returns nothing when the range holds no future prescription', () => {
    const source = planWith([easyRun()])

    expect(buildGarminExport(source, [], { today, to: '2026-09-10' })).toBeNull()
  })
})
