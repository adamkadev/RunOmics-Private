import { describe, expect, it } from 'vitest'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { athletePageView } from '../athleteView'

const PROFILE: AthleteProfile = {
  displayName: 'Demo Runner',
  age: 32,
  sex: 'male',
  heightCm: 178,
  weightKg: 70,
  bmi: 22.1,
  restingHrBpm: 50,
  maxHrBpm: 189,
  lthrBpm: 172,
  hrZoneBoundsBpm: [128, 145, 160, 172, 182],
  thresholdPaceSecPerKm: 258,
  vmaKmh: 17.5,
  fitnessAgeYrs: 27,
  achievableFitnessAgeYrs: 24,
  deviceId: 123,
  deviceName: 'Forerunner 265',
  lastUpdate: '2026-09-24T06:00:00Z',
  injuryHistory: { reviewedOn: '2026-09-01', injuries: [{ site: 'left achilles', year: 2024, recurrent: true }] },
}

describe('athletePageView', () => {
  it('carries no injury history', () => {
    const view = athletePageView(PROFILE)

    expect(view).not.toHaveProperty('injuryHistory')
    expect(JSON.stringify(view)).not.toContain('achilles')
  })

  it('carries exactly the fields /athlete draws', () => {
    expect(Object.keys(athletePageView(PROFILE)).sort()).toEqual(
      [
        'hrZoneBoundsBpm',
        'lastUpdate',
        'lthrBpm',
        'maxHrBpm',
        'restingHrBpm',
        'thresholdPaceSecPerKm',
        'vmaKmh',
      ].sort()
    )
  })

  it('leaves out a field the file does not have, rather than sending it as undefined', () => {
    expect(athletePageView({ lthrBpm: 170 })).toEqual({ lthrBpm: 170 })
  })
})
