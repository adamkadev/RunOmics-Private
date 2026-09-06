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

export interface PlanWorkoutView {
  key: string
  date: string
  title: string
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
  return `${duration.estimated ? '≈' : ''}${formatDurationWords(duration.seconds)}`
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

export function coachWorkoutView(
  view: PrescriptionView,
  zones: TrainingZonesData | null = null,
  garmin: PlannedWorkout | null = null
): PlanWorkoutView {
  const workout = view.prescription
  const type = COACHING_TO_ACTIVITY_TYPE[workout.type]
  const zone = zoneFor(type, zones)
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
