import type { TrainingStatus } from './GetTrainingStatus'
import { getActivitySummaries } from './GetActivities'
import type { PlannedWorkout } from '@/domain/activity/types'
import { verdictTone } from '@/domain/training/readiness'
import { recentTraining } from '@/domain/training/recentTraining'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash, type TodayContext } from '@/domain/ai/todayInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { isoDate } from '@/lib/calendarDate'
import type { Insight } from '@/lib/gemini'

/** The facts the hero is written from, built the same way for the reader and the generator. */
export function buildTodayContext(
  status: TrainingStatus,
  plannedWorkout: PlannedWorkout | null,
  now = new Date()
): TodayContext {
  return {
    status,
    tone: verdictTone(status),
    plannedWorkout,
    recent: recentTraining(getActivitySummaries(), isoDate(now)),
  }
}

/** The AI verdict for today, or null so the hero keeps its rules-based copy. */
export async function getTodayInsight(
  status: TrainingStatus | null,
  plannedWorkout: PlannedWorkout | null
): Promise<Insight | null> {
  if (!status) return null

  const context = buildTodayContext(status, plannedWorkout)
  return readVerifiedInsight(TODAY_SURFACE, {
    hash: todayInsightHash(context),
    guard: todayInsightGuard(context),
  })
}
