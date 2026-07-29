import type { TrainingStatus } from './GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'
import { verdictTone } from '@/domain/training/readiness'
import { TODAY_SURFACE, todayInsightHash } from '@/domain/ai/todayInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI verdict for today, or null so the hero keeps its rules-based copy. */
export async function getTodayInsight(
  status: TrainingStatus | null,
  plannedWorkout: PlannedWorkout | null
): Promise<Insight | null> {
  if (!status) return null

  const hash = todayInsightHash({ status, tone: verdictTone(status), plannedWorkout })
  return readVerifiedInsight(TODAY_SURFACE, hash)
}
