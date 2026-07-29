import type { Activity } from '@/domain/activity/types'
import { runVerdictInsightHash, runVerdictSurface } from '@/domain/ai/runVerdictInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI verdict for one run, or null so the card keeps its rules-based copy. */
export async function getRunVerdictInsight(activity: Activity): Promise<Insight | null> {
  return readVerifiedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(activity))
}
