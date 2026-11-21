import type { Activity, ActivitySplit, ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import { sessionRunType } from '@/domain/activity/effectiveType'
import type { RunRecord } from '@/domain/race/records'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { repSet } from '@/domain/activity/repSet'
import { prescribedRepPace } from '@/domain/coaching/repPace'
import type { ShareActivity, ShareReps, ShareStrides } from '@/lib/shareCardStats'
import { pickDefined } from '@/components/pickDefined'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { prescriptionDistanceMeters, prescriptionDuration, prescriptionStructure } from '@/components/coaching/presentation'
import { activityTitle, intendedType, sessionLabel, withoutRaceWord } from '@/lib/activityTitle'
import { plannedSessionForRun, type RunSession } from '@/domain/coaching/sessionForRun'

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
  'hrSamples',
  'paceSamples',
  'type',
] as const satisfies readonly (keyof ShareActivity)[]

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

/** Falls back to the planned workout the watch carried: a run the coach matched to nothing still has the band it beeped at. */
function repTarget(prescription: WorkoutPrescription | null, planned: PlannedWorkout | null): ShareReps['target'] {
  const guide = prescribedRepPace(prescription)
  if (guide) return guide
  const named = paceOf(prescription?.structure?.targetPace)
  if (named !== null) return { min: named, max: named }
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

export function shareStrides(activity: Pick<Activity, 'type' | 'splits'>): ShareStrides | null {
  if (isIntervalType(activity.type) || !activity.splits) return null
  const set = repSet(activity.splits)
  if (!set?.strides) return null
  const windows = repWindows(activity.splits, set.reps.length)
  return windows.length ? { count: set.reps.length, windows } : null
}

/**
 * A threshold session the watch filed as tempo, its heart rate too low by Garmin's reading, is still shown as a
 * threshold session; the run itself keeps the watch's type, which analytics and filters read.
 */
export function shownType(activity: Pick<Activity, 'type' | 'description'>, session: WorkoutPrescription | null): ActivityType {
  return session ? sessionRunType(session.type, activity) : intendedType(activity)
}

type SessionRun = Pick<Activity, 'id' | 'date' | 'type' | 'description'>

function runSessions(workouts: readonly RunSession[], activities: readonly SessionRun[]): [SessionRun, WorkoutPrescription | null][] {
  const days = new Set(activities.map((activity) => activity.date.slice(0, 10)))
  return activities.map((activity) => [activity, plannedSessionForRun(activity, workouts, (day) => days.has(day))])
}

export function sessionTypes(workouts: readonly RunSession[], activities: readonly SessionRun[]): Record<string, ActivityType> {
  const types: Record<string, ActivityType> = {}
  for (const [activity, session] of runSessions(workouts, activities)) {
    const type = shownType(activity, session)
    if (type !== activity.type) types[activity.id] = type
  }
  return types
}

/** Each run's session name where it differs from the run's own, so a row reads as its detail page and share card. */
export function sessionNames(workouts: readonly RunSession[], activities: readonly SessionRun[]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const [activity, session] of runSessions(workouts, activities)) {
    if (!session) continue
    const name = runLabel(activity, session)
    if (name !== sessionLabel(activityTitle(activity))) names[activity.id] = name
  }
  return names
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
  return session ? withoutRaceWord(sessionName(session)) : activityTitle(activity)
}

/** The set alone, as a row, the header and the share card show it: the type is the dot beside it. */
export function runLabel(activity: Pick<Activity, 'description' | 'date'>, session: WorkoutPrescription | null): string {
  return sessionLabel(runName(activity, session))
}

/** A threshold session the watch filed as tempo is read as the threshold it was set as; the card shows measured data only. */
export function shareActivity(
  activity: Activity,
  session: WorkoutPrescription | null = null,
  planned: PlannedWorkout | null = null,
  record: RunRecord | null = null,
): ShareActivity {
  const type = session ? sessionRunType(session.type, activity) : activity.type
  // The reps follow the session as set: a check's warm-up strides are no interval set.
  const set = session ? COACHING_TO_ACTIVITY_TYPE[session.type] : type
  return {
    ...pickDefined(activity, SHARE_FIELDS),
    type,
    sessionTitle: session ? sessionName(session) : null,
    reps: shareReps({ type: set, splits: activity.splits }, session, planned),
    strides: shareStrides({ type: set, splits: activity.splits }),
    record,
  }
}
