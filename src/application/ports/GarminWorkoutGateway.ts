import type { GarminWorkoutPayload } from '@/application/coaching/garminWorkoutMapping'

export interface GarminWorkoutGateway {
  createWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }>
  scheduleWorkout(workoutId: string, date: string): Promise<{ workoutScheduleId: string }>
  /** Throws GarminNotFoundError when Garmin no longer has that calendar entry. */
  unscheduleWorkout(scheduleId: string): Promise<void>
  /** Throws GarminNotFoundError when Garmin no longer has that workout. */
  deleteWorkout(workoutId: string): Promise<void>
  getWorkout(workoutId: string): Promise<{ workoutId: string; workoutName: string } | null>
  getScheduledWorkouts(year: number, month: number): Promise<{ scheduleId: string; workoutId: string; date: string }[]>
}

export class GarminRateLimitError extends Error {
  constructor(message = 'Garmin rate limited the request') {
    super(message)
    this.name = 'GarminRateLimitError'
  }
}

/** Garmin answered 404: its own class because for a removal that is success, the thing is already gone. */
export class GarminNotFoundError extends Error {
  constructor(message = 'Garmin has no such item') {
    super(message)
    this.name = 'GarminNotFoundError'
  }
}
