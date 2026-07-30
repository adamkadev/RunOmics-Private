import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import { runVerdictInsightHash, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

function buildContext(activity: Activity, activities: Activity[], planned: PlannedWorkout[]): RunVerdictContext {
  return {
    activity,
    history: runHistory(activity, activities),
    planned: planned.find((workout) => workout.date === activity.date.slice(0, 10)) ?? null,
  }
}

/**
 * Every run with the history behind it. The generator needs them all to know
 * which verdicts have gone stale, so the plan and the activity list are read
 * once here rather than once per run.
 */
export function getRunVerdictContexts(): RunVerdictContext[] {
  const activities = getAllActivities()
  const planned = getAllPlannedWorkouts()
  return activities.map((activity) => buildContext(activity, activities, planned))
}

/** The AI verdict for one run, or null so the card keeps its rules-based copy. */
export async function getRunVerdictInsight(activity: Activity): Promise<Insight | null> {
  const context = buildContext(activity, getAllActivities(), getAllPlannedWorkouts())
  return readVerifiedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))
}
