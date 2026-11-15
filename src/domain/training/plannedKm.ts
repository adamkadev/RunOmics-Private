import type { PlannedWorkout } from '@/domain/activity/types'

const stepSeconds = (step: { minutes: number; seconds?: number }) => step.seconds ?? step.minutes * 60

/**
 * A calendar session set by time carries no distance; its steps' paces give one. A warm-up, recovery or
 * cool-down without a pace runs at the session's slowest; an effort without one leaves the distance unknown.
 */
export function plannedWorkoutKm(workout: Pick<PlannedWorkout, 'distanceM' | 'steps'>): number | null {
  if (workout.distanceM !== undefined) return workout.distanceM / 1000
  const steps = workout.steps ?? []
  const paces = steps.flatMap((step) => (step.paceSecPerKm ? [(step.paceSecPerKm[0] + step.paceSecPerKm[1]) / 2] : []))
  if (steps.length === 0 || paces.length === 0) return null
  const slowest = Math.max(...paces)
  let km = 0
  for (const step of steps) {
    if (!step.paceSecPerKm && step.kind === 'effort') return null
    const pace = step.paceSecPerKm ? (step.paceSecPerKm[0] + step.paceSecPerKm[1]) / 2 : slowest
    km += stepSeconds(step) / pace
  }
  return km
}
