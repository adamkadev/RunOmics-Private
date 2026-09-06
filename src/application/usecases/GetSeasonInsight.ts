import type { SeasonHeadlineData } from './GetSeasonHeadline'
import { SEASON_SURFACE, seasonInsightGuard, seasonInsightHash } from '@/domain/ai/seasonInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

export async function getSeasonInsight(data: SeasonHeadlineData | null): Promise<Insight | null> {
  if (!data) return null
  return readVerifiedInsight(SEASON_SURFACE, { hash: seasonInsightHash(data), guard: seasonInsightGuard(data) })
}
