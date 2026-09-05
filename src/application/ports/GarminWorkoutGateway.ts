import type { GarminWorkoutPayload } from '@/application/coaching/garminWorkoutMapping'

/**
 * The authenticated Garmin write surface, expressed as the four single-resource
 * calls the RunOmics sync needs. There is deliberately no bulk or list-wide
 * operation: every mutation names exactly one workout or one calendar entry.
 */
export interface GarminWorkoutGateway {
  /** POST /workout-service/workout - returns the assigned workout id. */
  createWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }>
  /** POST /workout-service/schedule/{workoutId} - returns the calendar entry id. */
  scheduleWorkout(workoutId: string, date: string): Promise<{ workoutScheduleId: string }>
  /** DELETE /workout-service/schedule/{scheduleId} - clears the calendar entry only. */
  unscheduleWorkout(scheduleId: string): Promise<void>
  /** DELETE /workout-service/workout/{workoutId} - removes the library template. */
  deleteWorkout(workoutId: string): Promise<void>
  /** GET /workout-service/workout/{workoutId} - null when Garmin no longer has it. */
  getWorkout(workoutId: string): Promise<{ workoutId: string; workoutName: string } | null>
  /** GET /calendar-service/year/{y}/month/{m-1}, filtered to workout items. */
  getScheduledWorkouts(year: number, month: number): Promise<{ scheduleId: string; workoutId: string; date: string }[]>
}

/** Raised by a gateway when Garmin answers 429 so the caller can stop rather than retry hard. */
export class GarminRateLimitError extends Error {
  constructor(message = 'Garmin rate limited the request') {
    super(message)
    this.name = 'GarminRateLimitError'
  }
}
