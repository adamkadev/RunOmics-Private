import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { appTodayIso, DAY_MS } from '@/lib/calendarDate'

export const BLOCK_ENDING_DAYS = 7
export const REVIEW_OVERDUE_DAYS = 7

export interface CoachingReminder {
  /** Null while the block's end is further off than BLOCK_ENDING_DAYS, or already past. */
  blockEndsInDays: number | null
  reviewOverdue: boolean
  /** Null when the coach has never reviewed a week at all. */
  daysSinceReview: number | null
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** The operator's own reminder: nothing in the app renews a block or runs a review. */
export function getCoachingReminder(
  today = appTodayIso(),
  repository: Pick<CoachingRepository, 'getCurrentPlan' | 'getState'> = new JsonCoachingRepository(),
): CoachingReminder | null {
  const plan = repository.getCurrentPlan()
  if (!plan) return null

  const endsIn = daysBetween(today, plan.block.endDate)
  const state = repository.getState()
  const reviewed = state?.lastWeeklyReviewAt ?? state?.lastBootstrapAt ?? null
  const sinceReview = reviewed ? daysBetween(reviewed.slice(0, 10), today) : null

  const blockEnding = endsIn >= 0 && endsIn <= BLOCK_ENDING_DAYS
  const reviewOverdue = sinceReview === null || sinceReview > REVIEW_OVERDUE_DAYS
  if (!blockEnding && !reviewOverdue) return null

  return { blockEndsInDays: blockEnding ? endsIn : null, reviewOverdue, daysSinceReview: sinceReview }
}
