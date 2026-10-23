import type { CoachingPlan } from './types'

export interface SessionIntent {
  title: string
  description: string
  weekFocus: string
}

/**
 * `plans` in precedence order: the current plan, then the ones it replaced, newest first.
 * The first with a week over the date decides, so a covered day without a session is a rest day, not an older plan's session.
 */
export function sessionIntentOn(date: string, plans: readonly CoachingPlan[]): SessionIntent | null {
  const day = date.slice(0, 10)
  for (const plan of plans) {
    const week = plan.weeks.find((candidate) => day >= candidate.startDate && day <= candidate.endDate)
    if (!week) continue
    const workout = week.workouts.find((candidate) => candidate.date === day && candidate.status !== 'cancelled')
    return workout ? { title: workout.title, description: workout.description, weekFocus: week.focus } : null
  }
  return null
}
