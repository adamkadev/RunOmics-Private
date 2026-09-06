import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import { runVerdictInsightHash, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
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
