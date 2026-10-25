import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
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
  'vmaKmh',
  'thresholdPaceSecPerKm',
  'lastUpdate',
] as const satisfies readonly (keyof AthleteProfile)[]

export type AthletePageView = Pick<AthleteProfile, (typeof ATHLETE_PAGE_FIELDS)[number]>

export function athletePageView(profile: AthleteProfile): AthletePageView {
  return pickDefined(profile, ATHLETE_PAGE_FIELDS)
}
