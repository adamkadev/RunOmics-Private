import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import type { CoachingPlan } from '@/domain/coaching/types'
import { sessionIntentOn } from '@/domain/coaching/sessionIntent'
import { runVerdictInsightHash, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { readVerifiedCachedInsight, readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/**
 * Archived plans too: a finished block's sessions live only there. A plan that
 * fails to parse costs the verdicts their coaching intent, never the verdicts.
 */
function coachingPlans(): CoachingPlan[] {
  try {
    const repository = new JsonCoachingRepository()
    const current = repository.getCurrentPlan()
    return [...(current ? [current] : []), ...repository.getArchivedPlans()]
  } catch (error) {
    console.error('[run-verdict] coaching plans unreadable', error)
    return []
  }
}

function buildContext(
  activity: Activity,
  activities: Activity[],
  planned: PlannedWorkout[],
  officialResults: OfficialRaceResult[],
  plans: CoachingPlan[],
): RunVerdictContext {
  return {
    activity,
    history: runHistory(activity, activities, officialResults),
    planned: planned.find((workout) => workout.date === activity.date.slice(0, 10)) ?? null,
    official: officialResultsByActivityId(officialResults).get(activity.id) ?? null,
    intent: sessionIntentOn(activity.date, plans),
  }
}

export function getRunVerdictContexts(): RunVerdictContext[] {
  const activities = getAllActivities()
  const planned = getAllPlannedWorkouts()
  const officialResults = getOfficialRaceResults()
  const plans = coachingPlans()
  return activities.map((activity) => buildContext(activity, activities, planned, officialResults, plans))
}

export async function getRunVerdictInsight(activity: Activity): Promise<Insight | null> {
  const context = buildContext(activity, getAllActivities(), getAllPlannedWorkouts(), getOfficialRaceResults(), coachingPlans())
  return readVerifiedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))
}

export interface LatestRunVerdict {
  activity: Activity
  verdict: Insight | null
  generatedAt: string | null
}

/**
 * With `generatedAt`: a caller waiting on a just-synced run must tell its
 * verdict from the one that was there before the sync.
 */
export async function getLatestRunVerdict(): Promise<LatestRunVerdict | null> {
  const activities = getAllActivities()
  const activity = activities[0]
  if (!activity) return null

  const context = buildContext(activity, activities, getAllPlannedWorkouts(), getOfficialRaceResults(), coachingPlans())
  const cached = await readVerifiedCachedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))

  return {
    activity,
    verdict: cached ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null,
    generatedAt: cached?.generatedAt ?? null,
  }
}
