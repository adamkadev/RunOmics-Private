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

const HERO_FIELDS = ['title', 'duration', 'scheduledTime', 'target', 'activityId'] as const satisfies readonly (keyof PlanWorkoutView)[]

/**
 * What the dashboard hero shows of today's session. The full view also holds
 * the coach's description and notes, which the hero never draws, so they stay
 * out of the page payload.
 */
export type HeroWorkoutView = Pick<PlanWorkoutView, (typeof HERO_FIELDS)[number]>

export function heroWorkoutView(view: PlanWorkoutView): HeroWorkoutView {
  return pickDefined(view, HERO_FIELDS)
}
