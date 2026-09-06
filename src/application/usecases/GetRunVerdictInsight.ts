import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import { RUN_VERDICT_PREFIX, runVerdictInsightHash, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import {
  readVerifiedInsight,
  getCachedInsightsByPrefix,
  servableInsight,
  type CachedInsight,
} from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

function buildContext(activity: Activity, activities: Activity[], planned: PlannedWorkout[]): RunVerdictContext {
  return {
    activity,
    history: runHistory(activity, activities),
    planned: planned.find((workout) => workout.date === activity.date.slice(0, 10)) ?? null,
  }
}

export function getRunVerdictContexts(): RunVerdictContext[] {
  const activities = getAllActivities()
  const planned = getAllPlannedWorkouts()
  return activities.map((activity) => buildContext(activity, activities, planned))
}

let buildVerdicts: Promise<Map<string, CachedInsight>> | null = null

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}

export async function getRunVerdictInsight(activity: Activity): Promise<Insight | null> {
  const context = buildContext(activity, getAllActivities(), getAllPlannedWorkouts())
  const surface = runVerdictSurface(activity.id)
  const hash = runVerdictInsightHash(context)

  if (!isProductionBuild()) return readVerifiedInsight(surface, hash)
  if (!process.env.FIREBASE_PROJECT_ID) return null

  try {
    if (!buildVerdicts) buildVerdicts = getCachedInsightsByPrefix(RUN_VERDICT_PREFIX)
    return servableInsight((await buildVerdicts).get(surface), hash)
  } catch {
    return null
  }
}
