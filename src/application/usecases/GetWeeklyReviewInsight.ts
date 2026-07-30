import type { WeeklyDigest } from './GetWeeklyDigest'
import { WEEKLY_REVIEW_SURFACE, weeklyReviewInsightHash } from '@/domain/ai/weeklyReviewInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI review of the week, or null so the card keeps its bullets alone. */
export async function getWeeklyReviewInsight(digest: WeeklyDigest | null): Promise<Insight | null> {
  if (!digest) return null
  return readVerifiedInsight(WEEKLY_REVIEW_SURFACE, weeklyReviewInsightHash(digest))
}
