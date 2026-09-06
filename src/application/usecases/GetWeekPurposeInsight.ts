import type { CurrentWeekPurpose } from './GetCurrentWeekPurpose'
import { WEEK_PURPOSE_SURFACE, weekPurposeInsightHash } from '@/domain/ai/weekPurposeInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

export async function getWeekPurposeInsight(week: CurrentWeekPurpose | null): Promise<Insight | null> {
  if (!week) return null
  return readVerifiedInsight(WEEK_PURPOSE_SURFACE, weekPurposeInsightHash(week))
}
