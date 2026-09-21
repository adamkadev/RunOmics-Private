import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import { runVerdictInsightHash, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { readVerifiedCachedInsight, readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

function buildContext(
  activity: Activity,
  activities: Activity[],
  planned: PlannedWorkout[],
  officialResults: OfficialRaceResult[],
): RunVerdictContext {
  return {
    activity,
    history: runHistory(activity, activities, officialResults),
    planned: planned.find((workout) => workout.date === activity.date.slice(0, 10)) ?? null,
    official: officialResultsByActivityId(officialResults).get(activity.id) ?? null,
  }
}

export function getRunVerdictContexts(): RunVerdictContext[] {
  const activities = getAllActivities()
  const planned = getAllPlannedWorkouts()
  const officialResults = getOfficialRaceResults()
  return activities.map((activity) => buildContext(activity, activities, planned, officialResults))
}

export async function getRunVerdictInsight(activity: Activity): Promise<Insight | null> {
  const context = buildContext(activity, getAllActivities(), getAllPlannedWorkouts(), getOfficialRaceResults())
  return readVerifiedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))
}

export interface LatestRunVerdict {
  activity: Activity
  verdict: Insight | null
  generatedAt: string | null
}

/**
 * The newest run on this deployment together with the state of its verdict.
 *
 * A caller waiting on a just-synced run needs all three parts: which run is
 * newest, whether its verdict has been written, and when - because the verdict
 * that was already there before the sync is not the one it is waiting for.
 */
export async function getLatestRunVerdict(): Promise<LatestRunVerdict | null> {
  const activities = getAllActivities()
  const activity = activities[0]
  if (!activity) return null

  const context = buildContext(activity, activities, getAllPlannedWorkouts(), getOfficialRaceResults())
  const cached = await readVerifiedCachedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))

  return {
    activity,
    verdict: cached ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null,
    generatedAt: cached?.generatedAt ?? null,
  }
}
