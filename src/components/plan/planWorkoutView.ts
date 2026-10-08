import type { WorkoutPrescription } from '@/domain/coaching/types'
import type { PlanPrescriptionView } from './planCoachingView'
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
  prescriptionEffortPace,
  prescriptionPace,
  prescriptionStructure,
} from '@/components/coaching/presentation'
import { pickDefined } from '@/components/pickDefined'
import { formatDurationWords, formatPaceRange } from '@/lib/formatters'
import { t } from '@/i18n'
import { sessionTitle } from './sessionTitle'

export interface PlanWorkoutView {
  key: string
  date: string
  /** The session's name, as the coach or Garmin wrote it. */
  title: string
  /** The coach's name for a tight row, when the session was named under the naming rules (design review, Oct 2026). */
  shortName?: string
  type?: ActivityType
  scheduledTime?: ScheduledTimeOfDay
  duration: { seconds: number; estimated: boolean } | null
  distanceM: number | null
  effort: string | null
  target: string | null
  description: string | null
  notes: string[]
  structure: WorkoutStep[] | null
  statusLabel: string
  alert: string | null
  activityId: string | null
  isKey: boolean
}

const KEY_SESSION_TYPES = new Set<ActivityType>(['Threshold', 'Sprint', 'Tempo'])

function zoneFor(type: ActivityType | undefined, zones: TrainingZonesData | null): TrainingZone | null {
  const key = paceZoneKeyFor(type)
  return key ? zones?.zones.find((zone) => zone.key === key) ?? null : null
}

function effortBand(type: ActivityType | undefined, zone: TrainingZone | null): string | null {
  if (zone) return zone.key === 'easy' ? t.plan.easyEffortLabel : zone.label
  return type ? t.activityTypes[type] : null
}

export function formatPlanDuration(duration: PlanWorkoutView['duration']): string | null {
  if (!duration) return null
  return formatDurationWords(duration.seconds)
}

export function plannedWorkoutView(
  plan: PlannedWorkout,
  zones: TrainingZonesData | null = null
): PlanWorkoutView {
  const type = plan.type as ActivityType | undefined
  const zone = zoneFor(type, zones)

  return {
    key: `garmin:${plan.date}:${plan.name}`,
    date: plan.date,
    title: sessionTitle(plan.name, type) ?? plan.name,
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
 * /plan hands this the trimmed view, which has no description or notes; the
 * dashboard hands it the whole prescription.
 */
type CoachWorkoutSource = Omit<PlanPrescriptionView, 'prescription'> & {
  prescription: PlanPrescriptionView['prescription'] & Partial<Pick<WorkoutPrescription, 'description' | 'notes'>>
}

export function coachWorkoutView(
  view: CoachWorkoutSource,
  zones: TrainingZonesData | null = null,
  garmin: PlannedWorkout | null = null
): PlanWorkoutView {
  const workout = view.prescription
  const type = COACHING_TO_ACTIVITY_TYPE[workout.type]
  const zone = zoneFor(type, zones)
  const band = effortBand(type, zone)
  const zoneBand = zone ? formatPaceRange([zone.paceMinSecPerKm, zone.paceMaxSecPerKm]) : null
  const label = (pace: string | null) =>
    [band, pace ?? zoneBand].filter(Boolean).join(' · ') || null

  // Two readings of the same session. The row gets the work pace, because a
  // range that also spans the warm-up prescribes nothing; the sheet gets the
  // whole envelope, because there the warm-up is listed and the span explains
  // it. For a continuous run the two are the same string.
  const effort = label(prescriptionEffortPace(workout))
  const target = label(prescriptionPace(workout))

  return {
    key: workout.id,
    date: workout.date,
    title: workout.title,
    ...(workout.shortName ? { shortName: workout.shortName } : {}),
    type,
    scheduledTime: garmin?.scheduledTime,
    duration: prescriptionDuration(workout),
    distanceM: prescriptionDistanceMeters(workout),
    effort,
    target,
    description: workout.description || null,
    notes: workout.notes ?? [],
    structure: prescriptionStructure(workout),
    statusLabel: t.coaching.states[view.state],
    alert: garminAlert(view),
    activityId: view.activityId,
    isKey: isKeyPrescription(workout),
  }
}

const HERO_FIELDS = ['title', 'shortName', 'type', 'duration', 'distanceM', 'scheduledTime', 'target', 'activityId', 'structure'] as const satisfies readonly (keyof PlanWorkoutView)[]

/**
 * What the dashboard hero shows of today's session. The full view also holds
 * the coach's description and notes, which the hero never draws, so they stay
 * out of the page payload.
 */
export type HeroWorkoutView = Pick<PlanWorkoutView, (typeof HERO_FIELDS)[number]>

export function heroWorkoutView(view: PlanWorkoutView): HeroWorkoutView {
  return pickDefined(view, HERO_FIELDS)
}

/**
 * A done day's structure bar (v5.6 #2): the steps it was planned with. The
 * bar used to take no steps at all and read a threshold 3 × 7:00 as "56 min ·
 * Z4 continuous". A coach prescription counts only when it is linked to this
 * run; Garmin's plan only when the run was the kind of session it planned,
 * so a swapped day doesn't draw someone else's reps. Otherwise: continuous.
 */
export function doneDaySteps(
  activityType: ActivityType,
  coach: Pick<PlanPrescriptionView, 'prescription'> | undefined,
  garmin: Pick<PlannedWorkout, 'type' | 'steps' | 'name' | 'durationSecs'> | undefined,
): WorkoutStep[] {
  if (coach) return prescriptionStructure(coach.prescription) ?? []
  if (garmin && garmin.type === activityType) return garmin.steps ?? parseWorkoutStructure(garmin.name, garmin.durationSecs) ?? []
  return []
}
