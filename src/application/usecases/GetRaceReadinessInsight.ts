import type { RaceReadiness } from './GetRaceReadiness'
import { RACE_READINESS_SURFACE, raceReadinessInsightHash } from '@/domain/ai/raceReadinessInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI note on the next race, or null so the card keeps its phase copy. */
export async function getRaceReadinessInsight(readiness: RaceReadiness | null): Promise<Insight | null> {
  if (!readiness) return null
  return readVerifiedInsight(RACE_READINESS_SURFACE, raceReadinessInsightHash(readiness))
}
