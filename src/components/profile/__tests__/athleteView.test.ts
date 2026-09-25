import { describe, expect, it } from 'vitest'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import { athletePageView, profileView } from '../athleteView'

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
        'achievableFitnessAgeYrs',
        'age',
        'bmi',
        'fitnessAgeYrs',
        'heightCm',
        'hrZoneBoundsBpm',
        'lastUpdate',
        'lthrBpm',
        'maxHrBpm',
        'restingHrBpm',
        'thresholdPaceSecPerKm',
        'vmaKmh',
        'weightKg',
      ].sort()
    )
  })

  it('leaves out a field the file does not have, rather than sending it as undefined', () => {
    expect(athletePageView({ lthrBpm: 170 })).toEqual({ lthrBpm: 170 })
  })
})

describe('profileView', () => {
  it('keeps the athlete to the name and the two headline metrics', () => {
    const data = { hero: { lifetimeActivities: 3 }, athlete: PROFILE } as unknown as ProfileData
    const view = profileView(data)

    expect(view.athlete).toEqual({ displayName: 'Demo Runner', vmaKmh: 17.5, lthrBpm: 172 })
    expect(view.hero).toBe(data.hero)
    expect(JSON.stringify(view)).not.toContain('injuryHistory')
  })
})
