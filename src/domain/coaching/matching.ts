import type { PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import {
  COACHING_TO_ACTIVITY_TYPE,
  type GarminScheduleStatus,
  type WorkoutBlock,
  type WorkoutPrescription,
  type WorkoutSegment,
} from './types'

function within(actual: number, expected: number, absoluteTolerance: number): boolean {
  return Math.abs(actual - expected) <= Math.max(absoluteTolerance, expected * 0.1)
}

function flattened(blocks: WorkoutBlock[]): WorkoutSegment[] {
  return blocks.flatMap((block) => {
    if (block.kind !== 'repeat') return [block]
    return Array.from({ length: block.repetitions }, () => block.steps).flat()
  })
}

function structureMatch(prescription: WorkoutPrescription, planned: PlannedWorkout): boolean | null {
  if (!planned.steps?.length) return null
  const coach = flattened(prescription.blocks)
  if (coach.length !== planned.steps.length) return false
  return coach.every((segment, index) => {
    const garmin = planned.steps?.[index] as WorkoutStep | undefined
    if (!garmin || segment.kind !== garmin.kind) return false
    const duration = segment.target.durationSeconds
    if (duration !== undefined && !within(garmin.minutes * 60, duration, 60)) return false
    const pace = segment.target.paceSecPerKm
    if (pace && garmin.paceSecPerKm) {
      return pace.min <= garmin.paceSecPerKm[1] && pace.max >= garmin.paceSecPerKm[0]
    }
    return true
  })
}

export function garminScheduleStatus(
  prescription: WorkoutPrescription,
  planned: PlannedWorkout | null,
): GarminScheduleStatus {
  if (!planned || planned.date !== prescription.date) return 'not_scheduled'
  const typeMatches = !planned.type || planned.type === COACHING_TO_ACTIVITY_TYPE[prescription.type]
  const structure = structureMatch(prescription, planned)
  if (structure !== null) return typeMatches && structure ? 'scheduled_match' : 'scheduled_different'

  let compared = false
  let totalsMatch = true
  if (prescription.totalDurationSeconds && planned.durationSecs) {
    compared = true
    totalsMatch &&= within(planned.durationSecs, prescription.totalDurationSeconds, 300)
  }
  if (prescription.totalDistanceMeters && planned.distanceM) {
    compared = true
    totalsMatch &&= within(planned.distanceM, prescription.totalDistanceMeters, 500)
  }
  if (compared) return typeMatches && totalsMatch ? 'scheduled_match' : 'scheduled_different'
  return typeMatches ? 'scheduled_unknown' : 'scheduled_different'
}
