import type { Activity, ActivityType } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { repSet } from '@/domain/activity/repSet'
import type { ShareActivity, ShareReps } from '@/lib/shareCardStats'
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
  'type',
  'hrSamples',
] as const satisfies readonly (keyof ShareActivity)[]

/** The map, stats, tabs and charts of the activity detail. */
export type ActivityDetailView = Pick<Activity, (typeof DETAIL_FIELDS)[number]>

export function activityDetailView(activity: Activity): ActivityDetailView {
  return pickDefined(activity, DETAIL_FIELDS)
}

/** The kinds of run whose laps are reps worth leading with; strides on an easy run are not. */
const INTERVAL_TYPES: readonly ActivityType[] = ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic']
const isIntervalType = (type: ActivityType) => INTERVAL_TYPES.includes(type)

function paceOf(text: string | undefined): number | null {
  const m = text?.match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** The pace the session set for its reps: its structure's when it has one, else the repeat's effort step. */
function repTarget(prescription: WorkoutPrescription | null): ShareReps['target'] {
  if (!prescription) return null
  const named = paceOf(prescription.structure?.targetPace)
  if (named !== null) return { min: named, max: named }
  for (const block of prescription.blocks) {
    if (block.kind !== 'repeat') continue
    const pace = block.steps.find((step) => step.kind === 'effort')?.target.paceSecPerKm
    if (pace) return { min: Math.round(pace.min), max: Math.round(pace.max) }
  }
  return null
}

/**
 * An interval session's work (design review, Oct 2026): the work laps the
 * Splits tab reads as reps, their time over their distance - recoveries,
 * warm-up and cool-down out - and the plan's pace for them. Null for any
 * other kind of run, or one the watch kept no rep laps for.
 */
export function shareReps(activity: Pick<Activity, 'type' | 'splits'>, prescription: WorkoutPrescription | null): ShareReps | null {
  if (!isIntervalType(activity.type)) return null
  const set = repSet(activity.splits)
  if (!set) return null
  const seconds = set.reps.reduce((sum, rep) => sum + rep.durationSec, 0)
  const metres = set.reps.reduce((sum, rep) => sum + rep.distanceM, 0)
  if (metres <= 0) return null
  return { count: set.reps.length, repSeconds: set.repDurationSec, paceSecPerKm: Math.round((seconds / metres) * 1000), target: repTarget(prescription) }
}

/**
 * The coach's session a run is shared as: the one the coach matched it to,
 * else - for a quality run - the one quality session set for its day. The
 * coach matches on kind, so a threshold session the watch filed as tempo
 * matched nothing; an easy run on a hard day still takes no session.
 */
export function shareSession(
  workouts: readonly { prescription: WorkoutPrescription; activityId: string | null }[],
  activity: Pick<Activity, 'id' | 'date' | 'type'>,
): WorkoutPrescription | null {
  const matched = workouts.find((w) => w.activityId === activity.id)
  if (matched) return matched.prescription
  if (!isIntervalType(activity.type)) return null
  const day = workouts.filter((w) =>
    w.activityId === null &&
    w.prescription.status !== 'cancelled' &&
    w.prescription.date === activity.date.slice(0, 10) &&
    isIntervalType(COACHING_TO_ACTIVITY_TYPE[w.prescription.type]))
  return day.length === 1 ? day[0]!.prescription : null
}

/**
 * The share card's run, with the coach's session when it has one: its kind -
 * a threshold session the watch filed as tempo is read as the threshold it
 * was set as - and its reps' target. The coach's name titles the card only
 * when written under the naming rules (design review, Oct 2026), the ones
 * with a structure; an older name is shorter than the watch's own, which
 * the run carries.
 */
export function shareActivity(activity: Activity, session: WorkoutPrescription | null = null): ShareActivity {
  const type = session ? COACHING_TO_ACTIVITY_TYPE[session.type] : activity.type
  return {
    ...pickDefined(activity, SHARE_FIELDS),
    type,
    sessionTitle: session?.structure ? session.title : null,
    reps: shareReps({ type, splits: activity.splits }, session),
  }
}
