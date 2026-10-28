import { describe, expect, it } from 'vitest'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import {
  intervalsPace,
  intervalsWorkoutText,
  IntervalsEncodingError,
  toIntervalsWorkoutEvent,
} from '../intervalsWorkoutEncoding'

function prescription(overrides: Partial<WorkoutPrescription>): WorkoutPrescription {
  return {
    id: 'plan:workout:1:1',
    revision: 1,
    date: '2026-11-03',
    type: 'easy',
    title: 'Aerobic Easy Run',
    description: 'Steady easy aerobic run.',
    status: 'prescribed',
    blocks: [],
    provenance: { source: 'manual', trigger: 'bootstrap', createdAt: '2026-10-28T08:00:00.000Z' },
    ...overrides,
  }
}

const SPARSE_PACE = { min: 470, max: 525 }

describe('pace targets', () => {
  it('writes a range fast to slow in minutes per kilometre', () => {
    expect(intervalsPace({ min: 330, max: 384 })).toBe('5:30-6:24/km Pace')
  })

  it('orders the bounds however the range is given', () => {
    expect(intervalsPace({ min: 525, max: 470 })).toBe('7:50-8:45/km Pace')
  })

  it('writes a single pace once', () => {
    expect(intervalsPace({ min: 300, max: 300 })).toBe('5:00/km Pace')
  })

  it('rejects a non-positive pace', () => {
    expect(() => intervalsPace({ min: 0, max: 300 })).toThrow(IntervalsEncodingError)
  })
})

describe('the event', () => {
  it('is a planned run on the prescription date, keyed by its RunOmics id', () => {
    const event = toIntervalsWorkoutEvent(prescription({
      title: 'Footing · 6 × 3′',
      blocks: [{ kind: 'effort', target: { durationSeconds: 1_800 } }],
    }))

    expect(event).toMatchObject({
      category: 'WORKOUT',
      type: 'Run',
      start_date_local: '2026-11-03T00:00:00',
      name: "Footing · 6 × 3'",
      external_id: 'runomics:plan:workout:1:1',
    })
  })
})

describe('golden workouts', () => {
  it('the owner’s threshold session: warm-up, a repeat with jogged recoveries, cool-down, heart rate in the text', () => {
    const workout = prescription({
      type: 'threshold',
      title: 'Threshold 3 x 1600m',
      description: 'Controlled threshold.',
      blocks: [
        { kind: 'warmup', target: { distanceMeters: 2_000, paceSecPerKm: { min: 330, max: 384 } } },
        {
          kind: 'repeat',
          repetitions: 3,
          steps: [
            { kind: 'effort', target: { distanceMeters: 1_600, paceSecPerKm: { min: 260, max: 270 }, hrBpm: { min: 160, max: 172 } } },
            { kind: 'recovery', target: { durationSeconds: 120, paceSecPerKm: { min: 350, max: 387 } } },
          ],
        },
        { kind: 'cooldown', target: { durationSeconds: 600 } },
      ],
    })

    expect(intervalsWorkoutText(workout)).toBe([
      'Controlled threshold.',
      'HR 160-172 bpm',
      '',
      '- 2km 5:30-6:24/km Pace intensity=warmup',
      '',
      '3x',
      '- 1.6km 4:20-4:30/km Pace',
      '- 2m 5:50-6:27/km Pace intensity=rest',
      '',
      '- 10m intensity=cooldown',
    ].join('\n'))
  })

  it('the owner’s easy run with strides: no heart rate, strides as a repeat group', () => {
    const workout = prescription({
      title: 'Easy Run with Strides',
      description: 'Easy, HR under 150 bpm.',
      notes: ['Relaxed shoulders.', 'Keep HR in zone 2.'],
      blocks: [
        { kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 330, max: 384 }, hrBpm: { min: 130, max: 150 } } },
        {
          kind: 'repeat',
          repetitions: 4,
          steps: [
            { kind: 'strides', target: { durationSeconds: 20 } },
            { kind: 'recovery', target: { durationSeconds: 40 } },
          ],
        },
      ],
    })

    expect(intervalsWorkoutText(workout)).toBe([
      'Relaxed shoulders.',
      '',
      '- 6km 5:30-6:24/km Pace',
      '',
      '4x',
      '- 20s',
      '- 40s intensity=rest',
    ].join('\n'))
  })

  it('the second athlete’s run/walk: paced runs, untargeted walks, no notes', () => {
    const workout = prescription({
      title: 'Footing · 6 × 3′',
      description: 'Course et marche.',
      blocks: [
        { kind: 'warmup', target: { durationSeconds: 300 } },
        {
          kind: 'repeat',
          repetitions: 6,
          steps: [
            { kind: 'effort', target: { durationSeconds: 180, paceSecPerKm: SPARSE_PACE } },
            { kind: 'recovery', target: { durationSeconds: 90 } },
          ],
        },
        { kind: 'cooldown', target: { durationSeconds: 300 } },
      ],
    })

    expect(intervalsWorkoutText(workout)).toBe([
      'Course et marche.',
      '',
      '- 5m intensity=warmup',
      '',
      '6x',
      '- 3m 7:50-8:45/km Pace',
      '- 90s intensity=rest',
      '',
      '- 5m intensity=cooldown',
    ].join('\n'))
  })

  it('the second athlete’s continuous run: jogged warm-up and cool-down, one paced run', () => {
    const workout = prescription({
      title: 'Footing continu 20′',
      description: 'Footing continu.',
      blocks: [
        { kind: 'warmup', target: { durationSeconds: 300, paceSecPerKm: SPARSE_PACE } },
        { kind: 'effort', target: { durationSeconds: 1_200, paceSecPerKm: SPARSE_PACE } },
        { kind: 'cooldown', target: { durationSeconds: 300, paceSecPerKm: SPARSE_PACE } },
      ],
    })

    expect(intervalsWorkoutText(workout)).toBe([
      'Footing continu.',
      '',
      '- 5m 7:50-8:45/km Pace intensity=warmup',
      '- 20m 7:50-8:45/km Pace',
      '- 5m 7:50-8:45/km Pace intensity=cooldown',
    ].join('\n'))
  })
})

describe('targets the text syntax cannot carry', () => {
  it('keeps a heart-rate zone as the zone target', () => {
    const text = intervalsWorkoutText(prescription({
      type: 'tempo',
      blocks: [{ kind: 'effort', target: { durationSeconds: 1_200, hrZone: 3 } }],
    }))

    expect(text).toContain('- 20m Z3 HR')
  })

  it('leaves a bpm-only step untargeted and names the range in the text', () => {
    const text = intervalsWorkoutText(prescription({
      type: 'tempo',
      description: '',
      blocks: [{ kind: 'effort', target: { durationSeconds: 1_200, hrBpm: { min: 150, max: 160 } } }],
    }))

    expect(text).toBe('HR 150-160 bpm\n\n- 20m')
  })

  it('refuses a lap-button step', () => {
    expect(() => intervalsWorkoutText(prescription({ blocks: [{ kind: 'effort', target: {} }] }))).toThrow(/duration or distance/)
  })

  it('refuses a workout without steps', () => {
    expect(() => intervalsWorkoutText(prescription({ blocks: [] }))).toThrow(IntervalsEncodingError)
  })
})

describe('prose', () => {
  it('cannot be read as a step or a repeat', () => {
    const text = intervalsWorkoutText(prescription({
      description: '- easy start',
      notes: ['Finish with strides 4x'],
      blocks: [{ kind: 'effort', target: { durationSeconds: 600 } }],
    }))

    expect(text.split('\n\n')[0]).toBe('easy start\nFinish with strides 4 ×')
  })
})
