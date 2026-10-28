import type { WorkoutPrescription } from '@/domain/coaching/types'
import type { PlanPrescriptionView } from './planCoachingView'
import type { PrescriptionDisplayState } from '@/application/coaching/GetCoachingView'
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
import type { SessionHrTarget } from '@/domain/training/hrTarget'
import {
  prescriptionDuration,
  prescriptionEffortPace,
  prescriptionPace,
  prescriptionHr,
  prescriptionStructure,
} from '@/components/coaching/presentation'
import { pickDefined } from '@/components/pickDefined'
import { formatPaceRange } from '@/lib/formatters'
import { t } from '@/i18n'
import { sessionTitle } from './sessionTitle'

export interface PlanWorkoutView {
  key: string
  date: string
  title: string
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
  hr: SessionHrTarget | null
  /** The coach's state; absent for a session only the watch planned. */
  state?: PrescriptionDisplayState
  activityId: string | null
}

function zoneFor(type: ActivityType | undefined, zones: TrainingZonesData | null): TrainingZone | null {
  const key = paceZoneKeyFor(type)
  return key ? zones?.zones.find((zone) => zone.key === key) ?? null : null
}

function effortBand(type: ActivityType | undefined, zone: TrainingZone | null): string | null {
  if (zone) return zone.key === 'easy' ? t.plan.easyEffortLabel : zone.label
  return type ? t.activityTypes[type] : null
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
    hr: null,
    activityId: null,
  }
}

/** /plan passes the trimmed view without description or notes; the dashboard passes the whole prescription. */
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

  // The row gets the work pace, since a range spanning the warm-up prescribes
  // nothing; the sheet lists the warm-up, so it gets the whole envelope.
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
    distanceM: view.distanceMeters,
    effort,
    target,
    description: workout.description || null,
    notes: workout.notes ?? [],
    structure: prescriptionStructure(workout),
    hr: prescriptionHr(workout),
    state: view.state,
    activityId: view.activityId,
  }
}

const HERO_FIELDS = ['key', 'state', 'title', 'shortName', 'type', 'duration', 'distanceM', 'scheduledTime', 'target', 'activityId', 'structure', 'hr'] as const satisfies readonly (keyof PlanWorkoutView)[]

/** The coach's description and notes stay out of the dashboard's page payload: the card fetches them by `key`. */
export type HeroWorkoutView = Pick<PlanWorkoutView, (typeof HERO_FIELDS)[number]>

export function heroWorkoutView(view: PlanWorkoutView): HeroWorkoutView {
  return pickDefined(view, HERO_FIELDS)
}
