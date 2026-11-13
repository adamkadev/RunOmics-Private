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

/** The last measured resting HR, as Analytics shows it: the profile's is Garmin's zone setting, not a reading. */
export function athletePageView(profile: AthleteProfile, measuredRestingHr?: number): AthletePageView {
  const view = pickDefined(profile, ATHLETE_PAGE_FIELDS)
  return measuredRestingHr === undefined ? view : { ...view, restingHrBpm: measuredRestingHr }
}
