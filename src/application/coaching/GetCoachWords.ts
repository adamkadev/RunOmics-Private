import type { CoachingPlan } from '@/domain/coaching/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'

export interface CoachWeekWords {
  startDate: string
  endDate: string
  focus: string
}

export interface CoachSessionWords {
  description: string
  notes: string[]
}

/** The coach's own text, served by /api/coaching/words behind the site's gate and never in a page's HTML. */
export interface CoachWords {
  block: { name: string; focus: string }
  weeks: CoachWeekWords[]
  /** By prescription id. */
  sessions: Record<string, CoachSessionWords>
}

export function coachWords(plan: CoachingPlan): CoachWords {
  const sessions: Record<string, CoachSessionWords> = {}
  for (const workout of plan.weeks.flatMap((week) => week.workouts)) {
    sessions[workout.id] = { description: workout.description.trim(), notes: (workout.notes ?? []).map((note) => note.trim()).filter(Boolean) }
  }
  return {
    block: { name: plan.block.name.trim(), focus: plan.block.focus.trim() },
    weeks: plan.weeks.map((week) => ({ startDate: week.startDate, endDate: week.endDate, focus: week.focus.trim() })),
    sessions,
  }
}

export function getCoachWords(repository: Pick<CoachingRepository, 'getCurrentPlan'> = new JsonCoachingRepository()): CoachWords | null {
  const plan = repository.getCurrentPlan()
  return plan ? coachWords(plan) : null
}
