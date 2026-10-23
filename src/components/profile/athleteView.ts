import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import { pickDefined } from '@/components/pickDefined'

/**
 * An allow-list: the profile carries every athlete.json field, injury history
 * included, and only the fields named here reach the browser.
 */
const ATHLETE_PAGE_FIELDS = [
  'restingHrBpm',
  'lthrBpm',
  'maxHrBpm',
  'hrZoneBoundsBpm',
  'age',
  'fitnessAgeYrs',
  'vmaKmh',
  'thresholdPaceSecPerKm',
  'lastUpdate',
] as const satisfies readonly (keyof AthleteProfile)[]

const PROFILE_ATHLETE_FIELDS = ['displayName', 'vmaKmh', 'lthrBpm'] as const satisfies readonly (keyof AthleteProfile)[]

export type AthletePageView = Pick<AthleteProfile, (typeof ATHLETE_PAGE_FIELDS)[number]>

export type ProfileAthleteView = Pick<AthleteProfile, (typeof PROFILE_ATHLETE_FIELDS)[number]>

export type ProfileView = Omit<ProfileData, 'athlete'> & { athlete: ProfileAthleteView }

export function athletePageView(profile: AthleteProfile): AthletePageView {
  return pickDefined(profile, ATHLETE_PAGE_FIELDS)
}

export function profileView(data: ProfileData): ProfileView {
  return { ...data, athlete: pickDefined(data.athlete, PROFILE_ATHLETE_FIELDS) }
}
