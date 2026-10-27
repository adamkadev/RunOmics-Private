import { describe, expect, it } from 'vitest'
import {
  finishSecondsFromPace,
  formatRaceTime,
  paceSecondsPerKmFromFinish,
  raceDistanceMeters,
  raceTargetFacts,
} from '../raceTarget'

describe('coaching race target calculations', () => {
  it('converts race pace and finish time deterministically', () => {
    expect(finishSecondsFromPace(249, 5_000)).toBe(1_245)
    expect(formatRaceTime(finishSecondsFromPace(249, 5_000))).toBe('20:45')
    expect(paceSecondsPerKmFromFinish(1_200, 5_000)).toBe(240)
    expect(raceTargetFacts({ distanceLabel: '5K', targetSeconds: 1_200 })).toEqual({
      hasExplicitGoal: true,
      targetSeconds: 1_200,
      targetFinishTime: '20:00',
      targetPaceSecPerKm: 240,
      targetPace: '4:00/km',
    })
  })

  it('does not fabricate target facts for an event without its own goal', () => {
    expect(raceTargetFacts({ distanceLabel: '10K' })).toEqual({ hasExplicitGoal: false })
  })

  it('reads a race’s distance from a standard label or one in km', () => {
    expect(['10K', 'Half-Marathon', '15 km', '8.5 km', 'Trail'].map(raceDistanceMeters)).toEqual([10_000, 21_098, 15_000, 8_500, undefined])
  })
})
