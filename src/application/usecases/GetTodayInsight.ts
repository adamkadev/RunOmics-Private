import type { TrainingStatus } from './GetTrainingStatus'
import { getActivitySummaries } from './GetActivities'
import type { PlannedWorkout } from '@/domain/activity/types'
import { verdictTone } from '@/domain/training/readiness'
import { recentTraining } from '@/domain/training/recentTraining'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash, type TodayContext } from '@/domain/ai/todayInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { isoDate } from '@/lib/calendarDate'
import type { Insight } from '@/lib/gemini'

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
