import { describe, expect, it } from 'vitest'
import { plannedWorkoutKm } from '../plannedKm'

describe('plannedWorkoutKm', () => {
  it('reads a session set by time from its steps, a recovery with no pace at the slowest one', () => {
    const km = plannedWorkoutKm({
      steps: [
        { kind: 'warmup', minutes: 15, paceSecPerKm: [330, 360] },
        ...[1, 2, 3].flatMap((rep) => [
          { kind: 'effort' as const, minutes: 10, rep, paceSecPerKm: [265, 275] as [number, number] },
          { kind: 'recovery' as const, minutes: 2, rep },
        ]),
        { kind: 'cooldown', minutes: 10, paceSecPerKm: [330, 360] },
      ],
    })

    expect(km).toBeCloseTo((25 * 60) / 345 + (30 * 60) / 270 + (6 * 60) / 345, 5)
  })

  it('knows no distance for an effort with no pace, nor for a session with no steps', () => {
    expect(plannedWorkoutKm({ steps: [{ kind: 'effort', minutes: 40 }] })).toBeNull()
    expect(plannedWorkoutKm({})).toBeNull()
    expect(plannedWorkoutKm({ distanceM: 12_000 })).toBe(12)
  })
})
