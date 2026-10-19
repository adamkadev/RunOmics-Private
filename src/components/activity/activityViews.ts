import type { Activity, ActivitySplit, ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { repSet } from '@/domain/activity/repSet'
import type { ShareActivity, ShareReps } from '@/lib/shareCardStats'
import { pickDefined } from '@/components/pickDefined'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { prescriptionDistanceMeters, prescriptionDuration, prescriptionStructure } from '@/components/coaching/presentation'
import { activityTitle } from '@/lib/activityTitle'

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
  'hrZones',
  'type',
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

/**
 * The pace the reps were set at: the coach's prescription first - its named
 * pace, else its repeat's effort step - and failing that the planned workout
 * the watch carried, whose effort steps hold the same band. A run the coach
 * matched to nothing still has its target, which is what the watch beeped at.
 */
function repTarget(prescription: WorkoutPrescription | null, planned: PlannedWorkout | null): ShareReps['target'] {
  const named = paceOf(prescription?.structure?.targetPace)
  if (named !== null) return { min: named, max: named }
  for (const block of prescription?.blocks ?? []) {
    if (block.kind !== 'repeat') continue
    const pace = block.steps.find((step) => step.kind === 'effort')?.target.paceSecPerKm
    if (pace) return { min: Math.round(pace.min), max: Math.round(pace.max) }
  }
  const step = planned?.steps?.find((item: WorkoutStep) => item.kind === 'effort' && item.paceSecPerKm)
  const band = step?.paceSecPerKm
  return band ? { min: Math.round(band[0]), max: Math.round(band[1]) } : null
}

/**
 * Where the rep laps ran, as shares of the run's distance, the laps laid end
 * to end. A lead-in the Splits tab moved to the warm-up is the first active
 * lap, so the reps are the last of them.
 */
function repWindows(splits: ActivitySplit[], reps: number): [number, number][] {
  const total = splits.reduce((sum, split) => sum + split.distanceM, 0)
  if (total <= 0) return []
  const windows: [number, number][] = []
  let at = 0
  for (const split of splits) {
    if (split.type === 'interval_active') windows.push([at / total, (at + split.distanceM) / total])
    at += split.distanceM
  }
  return windows.slice(windows.length - reps)
}

/**
 * An interval session's work (design review, Oct 2026): the work laps the
 * Splits tab reads as reps, their time over their distance - recoveries,
 * warm-up and cool-down out - the plan's pace for them, and where on the
 * run they fell. Null for any other kind of run, or one the watch kept no
 * rep laps for.
 */
export function shareReps(
  activity: Pick<Activity, 'type' | 'splits'>,
  prescription: WorkoutPrescription | null,
  planned: PlannedWorkout | null = null,
): ShareReps | null {
  if (!isIntervalType(activity.type) || !activity.splits) return null
  const set = repSet(activity.splits)
  if (!set) return null
  const seconds = set.reps.reduce((sum, rep) => sum + rep.durationSec, 0)
  const metres = set.reps.reduce((sum, rep) => sum + rep.distanceM, 0)
  if (metres <= 0) return null
  return {
    count: set.reps.length,
    repSeconds: set.repDurationSec,
    paces: set.reps.map((rep) => (rep.distanceM > 0 ? Math.round((rep.durationSec / rep.distanceM) * 1000) : 0)).filter((pace) => pace > 0),
    paceSecPerKm: Math.round((seconds / metres) * 1000),
    target: repTarget(prescription, planned),
    windows: repWindows(activity.splits, set.reps.length),
  }
}

/** A run's kind in the coach's broad terms: easy, quality, or neither (a race, a sprint). */
function family(type: ActivityType): 'easy' | 'quality' | null {
  if (type === 'Base') return 'easy'
  return isIntervalType(type) ? 'quality' : null
}

/**
 * The coach's session a run is shared as: the one the coach matched it to,
 * else - as Today pairs a run with its day - the one session set for its day
 * of the run's own kind. The coach matches on exact kind, so a threshold
 * session the watch filed as tempo matched nothing; an easy run on a hard
 * day still takes no session.
 */
export function shareSession(
  workouts: readonly { prescription: WorkoutPrescription; activityId: string | null }[],
  activity: Pick<Activity, 'id' | 'date' | 'type'>,
): WorkoutPrescription | null {
  const matched = workouts.find((w) => w.activityId === activity.id)
  if (matched) return matched.prescription
  const kind = family(activity.type)
  if (!kind) return null
  const day = workouts.filter((w) =>
    w.activityId === null &&
    w.prescription.status !== 'cancelled' &&
    w.prescription.date === activity.date.slice(0, 10) &&
    family(COACHING_TO_ACTIVITY_TYPE[w.prescription.type]) === kind)
  return day.length === 1 ? day[0]!.prescription : null
}

/**
 * The session's name as Plan and Today write it (design review, Oct 2026):
 * "Easy 63 min + 6 × 20s strides", not the watch's "Strides 6 x 20s" - the
 * share card never derives a name of its own.
 */
function sessionName(session: WorkoutPrescription): string {
  return workoutSummary({
    title: session.title,
    ...(session.shortName ? { shortName: session.shortName } : {}),
    duration: prescriptionDuration(session),
    distanceM: prescriptionDistanceMeters(session),
    structure: prescriptionStructure(session),
  }).title
}

/**
 * The run's name on its page (design review, Oct 2026, round 2): its
 * session's, where the coach set one - the header read "Strides 6 × 20s"
 * over a card that read "Easy 54 min + 6 × 20s strides" - else the watch's.
 */
export function runName(activity: Pick<Activity, 'description' | 'date'>, session: WorkoutPrescription | null): string {
  return session ? sessionName(session) : activityTitle(activity)
}

/**
 * The share card's run, with the coach's session when it has one: its name,
 * as the plan shows it; its kind - a threshold session the watch filed as
 * tempo is read as the threshold it was set as - and its reps' target. The
 * Stats card leads with the run's written verdict (redesign, Oct 2026), its
 * tone the Overview card's; a run without one keeps the zones headline.
 */
export function shareActivity(
  activity: Activity,
  session: WorkoutPrescription | null = null,
  aiVerdict: { headline: string } | null = null,
  planned: PlannedWorkout | null = null,
): ShareActivity {
  const type = session ? COACHING_TO_ACTIVITY_TYPE[session.type] : activity.type
  const headline = aiVerdict?.headline.trim()
  return {
    ...pickDefined(activity, SHARE_FIELDS),
    type,
    sessionTitle: session ? sessionName(session) : null,
    reps: shareReps({ type, splits: activity.splits }, session, planned),
    verdict: headline ? { tone: runVerdictTone(activity), headline } : null,
  }
}
