import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { TrainingZone, TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type {
  ActivityType,
  PlannedWorkout,
  ScheduledTimeOfDay,
  WorkoutStep,
} from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import { paceZoneKeyFor } from '@/domain/training/typePaceZone'
import { parseWorkoutStructure } from '@/domain/training/workoutStructure'
import {
  garminAlert,
  isKeyPrescription,
  prescriptionDistanceMeters,
  prescriptionDuration,
  prescriptionPace,
  prescriptionStructure,
} from '@/components/coaching/presentation'
import { formatDurationWords, formatPaceRange } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * One Plan session, in the single shape the Plan UI renders.
 *
 * The Plan has exactly one workout presentation - PlannedWorkoutRow and
 * PlannedWorkoutSheet - and it must not care where a session came from. A
 * Garmin planned workout, a coach prescription, and a coach prescription
 * already synchronised to Garmin are all the same thing to an athlete looking
 * at their week, so they are all normalised here and rendered identically.
 *
 * The coach stays the source of truth for what was prescribed; Garmin stays
 * sync and read-back data that can enrich it (a time of day it was scheduled
 * at, or an alert when the two have drifted apart). Neither owns a view.
 */
export interface PlanWorkoutView {
  /** Stable list key: the prescription id, or the day the Garmin session is on. */
  key: string
  date: string
  title: string
  type?: ActivityType
  scheduledTime?: ScheduledTimeOfDay
  /** `estimated` marks a value derived rather than stated - shown with a "~". */
  duration: { seconds: number; estimated: boolean } | null
  distanceM: number | null
  /** Row subtitle after the time of day: the effort band and its pace. */
  effort: string | null
  /** Sheet target line. Set only when the session states its own target. */
  target: string | null
  description: string | null
  notes: string[]
  structure: WorkoutStep[] | null
  /** Sheet footer: Planned for a Garmin session, Prescribed/Adjusted for a coached one. */
  statusLabel: string
  /** Something the athlete has to act on. A healthy Garmin sync says nothing. */
  alert: string | null
  activityId: string | null
  /** A session the week is built around, as opposed to one that fills it. */
  isKey: boolean
}

// Same easy/hard split the week's stat tiles use: anything but Base counts as
// a key session, tagged accordingly instead of repeating its distance.
const KEY_SESSION_TYPES = new Set<ActivityType>(['Threshold', 'Sprint', 'Tempo'])

function zoneFor(type: ActivityType | undefined, zones: TrainingZonesData | null): TrainingZone | null {
  const key = paceZoneKeyFor(type)
  return key ? zones?.zones.find((zone) => zone.key === key) ?? null : null
}

/**
 * The effort band a session is run at: the athlete's own threshold-derived
 * zone where one applies, otherwise just what kind of session it is. Interval
 * types have no single range, so they keep the type name.
 */
function effortBand(type: ActivityType | undefined, zone: TrainingZone | null): string | null {
  if (zone) return zone.key === 'easy' ? t.plan.easyEffortLabel : zone.label
  return type ? t.activityTypes[type] : null
}

/** "~25 min" for a derived duration, "25 min" for one the session states. */
export function formatPlanDuration(duration: PlanWorkoutView['duration']): string | null {
  if (!duration) return null
  return `${duration.estimated ? '≈' : ''}${formatDurationWords(duration.seconds)}`
}

/** A Garmin planned workout, unchanged: what it says is all there is to say. */
export function plannedWorkoutView(
  plan: PlannedWorkout,
  zones: TrainingZonesData | null = null
): PlanWorkoutView {
  const type = plan.type as ActivityType | undefined
  const zone = zoneFor(type, zones)

  return {
    key: `garmin:${plan.date}:${plan.name}`,
    date: plan.date,
    title: plan.name,
    type,
    scheduledTime: plan.scheduledTime,
    duration: plan.durationSecs ? { seconds: plan.durationSecs, estimated: false } : null,
    distanceM: plan.distanceM ?? null,
    effort:
      [
        effortBand(type, zone),
        zone ? formatPaceRange([zone.paceMinSecPerKm, zone.paceMaxSecPerKm]) : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    // Garmin states a session, never a target band of its own - the zone pace
    // on the row is this app's inference, so the sheet does not quote it back
    // as though the workout had asked for it.
    target: null,
    description: null,
    notes: [],
    structure: plan.steps ?? parseWorkoutStructure(plan.name, plan.durationSecs),
    statusLabel: t.plan.planned,
    alert: null,
    activityId: null,
    isKey: type ? KEY_SESSION_TYPES.has(type) : false,
  }
}

/**
 * A coach prescription as the same Plan session. Title, intent, targets and
 * size come from the prescription; a Garmin session matched to it only fills
 * in what the coach never states - the time of day it ended up scheduled at.
 */
export function coachWorkoutView(
  view: PrescriptionView,
  zones: TrainingZonesData | null = null,
  garmin: PlannedWorkout | null = null
): PlanWorkoutView {
  const workout = view.prescription
  const type = COACHING_TO_ACTIVITY_TYPE[workout.type]
  const zone = zoneFor(type, zones)
  // The coach's own pace wins over the zone band: it is the prescription.
  const pace = prescriptionPace(workout)
  const effort =
    [
      effortBand(type, zone),
      pace ?? (zone ? formatPaceRange([zone.paceMinSecPerKm, zone.paceMaxSecPerKm]) : null),
    ]
      .filter(Boolean)
      .join(' · ') || null

  return {
    key: workout.id,
    date: workout.date,
    title: workout.title,
    type,
    scheduledTime: garmin?.scheduledTime,
    duration: prescriptionDuration(workout),
    distanceM: prescriptionDistanceMeters(workout),
    effort,
    target: effort,
    description: workout.description || null,
    notes: workout.notes ?? [],
    structure: prescriptionStructure(workout),
    statusLabel: t.coaching.states[view.state],
    alert: garminAlert(view),
    activityId: view.activityId,
    isKey: isKeyPrescription(workout),
  }
}
