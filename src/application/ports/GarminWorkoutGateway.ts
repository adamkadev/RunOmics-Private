import type { GarminWorkoutPayload } from '@/application/coaching/garminWorkoutMapping'

export interface GarminWorkoutGateway {
  createWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }>
  scheduleWorkout(workoutId: string, date: string): Promise<{ workoutScheduleId: string }>
  unscheduleWorkout(scheduleId: string): Promise<void>
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
