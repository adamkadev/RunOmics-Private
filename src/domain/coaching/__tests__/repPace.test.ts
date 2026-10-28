import { describe, expect, it } from 'vitest'
import type { WorkoutBlock, WorkoutTarget } from '../types'
import { prescribedRepPace } from '../repPace'

const runWalk = (run: WorkoutTarget, walk: WorkoutTarget = {}): { blocks: WorkoutBlock[] } => ({
  blocks: [
    { kind: 'warmup', target: { durationSeconds: 300, paceSecPerKm: { min: 600, max: 900 } } },
    {
      kind: 'repeat',
      repetitions: 5,
      steps: [
        { kind: 'effort', target: { durationSeconds: 240, ...run } },
        { kind: 'recovery', target: { durationSeconds: 60, ...walk } },
      ],
    },
    { kind: 'cooldown', target: { durationSeconds: 300 } },
  ],
})

describe('prescribedRepPace', () => {
  it('reads the run pace of a run/walk, not the warm-up or the walk', () => {
    expect(prescribedRepPace(runWalk({ paceSecPerKm: { min: 470, max: 525 }, hrZone: 2 }, { paceSecPerKm: { min: 900, max: 1100 } })))
      .toEqual({ min: 470, max: 525 })
  })

  it('reads the pace of an easy rep that also sets a heart rate', () => {
    expect(prescribedRepPace(runWalk({ paceSecPerKm: { min: 470, max: 525 }, hrBpm: { min: 124, max: 144 } }))).toEqual({ min: 470, max: 525 })
  })

  it('leaves a controlled threshold rep, held by its heart rate, to the reps\' own band', () => {
    const threshold: { type: 'threshold'; blocks: WorkoutBlock[] } = {
      type: 'threshold',
      blocks: [
        { kind: 'warmup', target: { durationSeconds: 900 } },
        {
          kind: 'repeat',
          repetitions: 3,
          steps: [
            { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 263, max: 268 }, hrBpm: { min: 160, max: 168 } } },
            { kind: 'recovery', target: { durationSeconds: 90 } },
          ],
        },
        { kind: 'cooldown', target: { durationSeconds: 600 } },
      ],
    }

    expect(prescribedRepPace(threshold)).toBeNull()
  })

  it('has none for reps set by heart rate alone', () => {
    expect(prescribedRepPace(runWalk({ hrBpm: { min: 124, max: 144 } }))).toBeNull()
    expect(prescribedRepPace(runWalk({ hrZone: 2 }))).toBeNull()
  })

  it('has none for reps at different paces, a single steady effort, or no session', () => {
    const ladder: { blocks: WorkoutBlock[] } = {
      blocks: [
        { kind: 'effort', target: { durationSeconds: 600, paceSecPerKm: { min: 270, max: 275 } } },
        { kind: 'recovery', target: { durationSeconds: 120 } },
        { kind: 'effort', target: { durationSeconds: 300, paceSecPerKm: { min: 255, max: 260 } } },
      ],
    }

    expect(prescribedRepPace(ladder)).toBeNull()
    expect(prescribedRepPace({ blocks: [{ kind: 'effort', target: { distanceMeters: 9000, paceSecPerKm: { min: 330, max: 384 } } }] })).toBeNull()
    expect(prescribedRepPace(null)).toBeNull()
  })

  it('reads reps written out one by one at the same pace', () => {
    const pace = { min: 270, max: 275 }
    const written: { blocks: WorkoutBlock[] } = {
      blocks: [
        { kind: 'effort', target: { durationSeconds: 900, paceSecPerKm: pace } },
        { kind: 'recovery', target: { durationSeconds: 120 } },
        { kind: 'effort', target: { durationSeconds: 900, paceSecPerKm: pace } },
      ],
    }

    expect(prescribedRepPace(written)).toEqual(pace)
  })
})
