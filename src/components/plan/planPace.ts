import type { PlanWorkoutView } from './planWorkoutView'
import { workoutSummary } from './workoutSummary'

/**
 * A planned session's average pace, in seconds a km: its duration over its
 * distance, else the middle of its easy or target pace; null without either.
 * What the route generator works the loop's time out at - on Plan's "Find a
 * route" link and on the Activities page's plan alike.
 */
export function planPaceSecPerKm(workout: Pick<PlanWorkoutView, 'title' | 'shortName' | 'duration' | 'distanceM' | 'structure'>): number | null {
  const { distanceM, duration } = workout
  if (distanceM && distanceM > 0 && duration?.seconds) return Math.round(duration.seconds / (distanceM / 1000))
  const pace = workoutSummary(workout).paces.find((p) => p.kind === 'easy' || p.kind === 'target')?.pace
  return pace ? Math.round((pace[0] + pace[1]) / 2) : null
}
