import type { CurrentWeekPurpose } from './GetCurrentWeekPurpose'
import { WEEK_PURPOSE_SURFACE, weekPurposeInsightHash } from '@/domain/ai/weekPurposeInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI line for the running week, or null so the banner keeps its title alone. */
export async function getWeekPurposeInsight(week: CurrentWeekPurpose | null): Promise<Insight | null> {
  if (!week) return null
  return readVerifiedInsight(WEEK_PURPOSE_SURFACE, weekPurposeInsightHash(week))
}
