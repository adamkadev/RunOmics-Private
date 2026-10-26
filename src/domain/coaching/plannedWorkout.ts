import type { PlannedWorkout } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from './types'

/** A prescription as the surfaces that read Garmin's calendar see it, so one shape serves both. */
export function prescriptionAsPlannedWorkout(prescription: WorkoutPrescription): PlannedWorkout {
  return {
    date: prescription.date,
    name: prescription.title,
    type: COACHING_TO_ACTIVITY_TYPE[prescription.type],
    ...(prescription.totalDurationSeconds === undefined ? {} : { durationSecs: prescription.totalDurationSeconds }),
    ...(prescription.totalDistanceMeters === undefined ? {} : { distanceM: prescription.totalDistanceMeters }),
  }
}
