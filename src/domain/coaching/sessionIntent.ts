import type { CoachingPlan } from './types'

/** What the coach wrote a session for, and the week it sits in. */
export interface SessionIntent {
  title: string
  description: string
  weekFocus: string
}

/**
 * The coach's words for the session planned on a date (v4.16.6). `plans` is
 * in order of precedence - the current plan, then the ones it replaced, newest
 * first - and the first plan with a week over that date decides: a plan that
 * covers the day but holds no session on it means the day was a rest day, not
 * that an older plan's session still stands.
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
