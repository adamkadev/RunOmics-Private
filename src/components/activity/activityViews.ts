import type { Activity, ActivitySplit, ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { repSet } from '@/domain/activity/repSet'
import type { ShareActivity, ShareReps } from '@/lib/shareCardStats'
import { pickDefined } from '@/components/pickDefined'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { prescriptionDistanceMeters, prescriptionDuration, prescriptionStructure } from '@/components/coaching/presentation'
import { activityTitle, intendedType } from '@/lib/activityTitle'
import { hillyGap } from '@/domain/activity/gradeAdjusted'
import { sessionForRun } from '@/domain/coaching/sessionForRun'

/** Only the fields a client component reads: every field handed to it goes into the page payload, drawn or not. */
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
  'gearPending',
  'elevationGain',
  'elevationProfile',
  'hrSamples',
  'paceSamples',
  'gapSecPerKm',
  'gapSamples',
  'cadenceSamples',
  'cadenceSpm',
  'groundContactMs',
  'verticalOscillationMm',
  'verticalRatioPct',
  'strideLengthM',
  'hrUntrusted',
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

export type ActivityDetailView = Pick<Activity, (typeof DETAIL_FIELDS)[number]>

/** A flat run's grade-adjusted pace is its pace again, so it stays off the page. */
export function activityDetailView(activity: Activity): ActivityDetailView {
  const view = pickDefined(activity, DETAIL_FIELDS)
  if (hillyGap(activity) === null) {
    delete view.gapSecPerKm
    delete view.gapSamples
  }
  return view
}

/** The kinds of run whose laps are reps worth leading with; strides on an easy run are not. */
const INTERVAL_TYPES: readonly ActivityType[] = ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic']
const isIntervalType = (type: ActivityType) => INTERVAL_TYPES.includes(type)

function paceOf(text: string | undefined): number | null {
  const m = text?.match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Falls back to the planned workout the watch carried: a run the coach matched to nothing still has the band it beeped at. */
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

/** A lead-in the Splits tab moved to the warm-up is the first active lap, so the reps are the last of them. */
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

/**
 * A threshold session the watch filed as tempo, its heart rate too low by Garmin's reading, is still shown as a
 * threshold session; the run itself keeps the watch's type, which analytics and filters read.
 */
export function shownType(activity: Pick<Activity, 'type' | 'description'>, session: WorkoutPrescription | null): ActivityType {
  return session ? COACHING_TO_ACTIVITY_TYPE[session.type] : intendedType(activity)
}

export function sessionTypes(
  workouts: readonly { prescription: WorkoutPrescription; activityId: string | null }[],
  activities: readonly Pick<Activity, 'id' | 'date' | 'type' | 'description'>[],
): Record<string, ActivityType> {
  const types: Record<string, ActivityType> = {}
  for (const activity of activities) {
    const type = shownType(activity, sessionForRun(activity, workouts))
    if (type !== activity.type) types[activity.id] = type
  }
  return types
}

/** As Plan and Today write it: "Easy 63 min + 6 × 20s strides", not the watch's "Strides 6 x 20s". */
function sessionName(session: WorkoutPrescription): string {
  return workoutSummary({
    title: session.title,
    ...(session.shortName ? { shortName: session.shortName } : {}),
    duration: prescriptionDuration(session),
    distanceM: prescriptionDistanceMeters(session),
    structure: prescriptionStructure(session),
  }).title
}

/** The session's name, where the coach set one, so the page's header agrees with its share card. */
export function runName(activity: Pick<Activity, 'description' | 'date'>, session: WorkoutPrescription | null): string {
  return session ? sessionName(session) : activityTitle(activity)
}

/**
 * A threshold session the watch filed as tempo is read as the threshold it was set as; a run without a written
 * verdict keeps the zones headline.
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
