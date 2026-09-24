import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import { pickDefined } from '@/components/pickDefined'

/**
 * What the public athlete screens draw, and nothing more. getAthleteProfile
 * copies athlete.json through key by key, so handing the whole profile to a
 * client component put every field the file holds into the page payload:
 * the injury history included, and whatever the coach records there next.
 * A field reaches the browser by being named here.
 */
const ATHLETE_PAGE_FIELDS = [
  'restingHrBpm',
  'lthrBpm',
  'maxHrBpm',
  'hrZoneBoundsBpm',
  'age',
  'fitnessAgeYrs',
  'achievableFitnessAgeYrs',
  'heightCm',
  'weightKg',
  'bmi',
  'vmaKmh',
  'thresholdPaceSecPerKm',
  'lastUpdate',
] as const satisfies readonly (keyof AthleteProfile)[]

const PROFILE_ATHLETE_FIELDS = ['displayName', 'vmaKmh', 'lthrBpm'] as const satisfies readonly (keyof AthleteProfile)[]

/** /athlete: the stat tiles and the HR zone table. */
export type AthletePageView = Pick<AthleteProfile, (typeof ATHLETE_PAGE_FIELDS)[number]>

/** /profile: the hero's name and the athlete card's headline metrics. */
export type ProfileAthleteView = Pick<AthleteProfile, (typeof PROFILE_ATHLETE_FIELDS)[number]>

export type ProfileView = Omit<ProfileData, 'athlete'> & { athlete: ProfileAthleteView }

export function athletePageView(profile: AthleteProfile): AthletePageView {
  return pickDefined(profile, ATHLETE_PAGE_FIELDS)
}

export function profileView(data: ProfileData): ProfileView {
  return { ...data, athlete: pickDefined(data.athlete, PROFILE_ATHLETE_FIELDS) }
}
