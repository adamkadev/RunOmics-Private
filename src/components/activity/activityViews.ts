import type { Activity } from '@/domain/activity/types'
import type { ShareActivity } from '@/lib/shareCardStats'
import { pickDefined } from '@/components/pickDefined'

/**
 * The activity page handed the whole Activity to its client components, so
 * every field went into the page payload whether or not anything drew it -
 * the encoded polyline, calories, gear id, the comment and title the server
 * already rendered. Each client component gets the fields it reads instead.
 */
const DETAIL_FIELDS = [
  // The note row reads and writes the activity's note by id.
  'id',
  'type',
  'rpe',
  'distanceKm',
  'durationSeconds',
  'paceSecPerKm',
  'avgHeartRate',
  'hrZones',
  'aerTrainingEffect',
  'anaTrainingEffect',
  'bestEfforts',
  'splits',
  'route',
  'weather',
  'elevationGain',
  'elevationProfile',
  'hrSamples',
  'paceSamples',
  'cadenceSamples',
  'cadenceSpm',
  'groundContactMs',
  'verticalOscillationMm',
  'verticalRatioPct',
  'strideLengthM',
] as const satisfies readonly (keyof Activity)[]

const SHARE_FIELDS = [
  'id',
  'date',
  'dayOfWeek',
  'description',
  'distanceKm',
  'durationSeconds',
  'paceSecPerKm',
  'avgHeartRate',
  'elevationGain',
  'route',
  'paceSamples',
  'hrZones',
] as const satisfies readonly (keyof ShareActivity)[]

/** The map, stats, tabs and charts of the activity detail. */
export type ActivityDetailView = Pick<Activity, (typeof DETAIL_FIELDS)[number]>

export function activityDetailView(activity: Activity): ActivityDetailView {
  return pickDefined(activity, DETAIL_FIELDS)
}

export function shareActivity(activity: Activity): ShareActivity {
  return pickDefined(activity, SHARE_FIELDS)
}
