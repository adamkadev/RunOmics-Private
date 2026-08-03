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

// generateStaticParams pre-renders one page per run, all in this one build
// process - the only place hundreds of individual Firestore reads used to race
// their own timeout. Fetched once, on first use, and reused for the rest of the
// build; a live request (ISR revalidation, dev server) never touches it, so a
// freshly generated verdict is visible the instant readVerifiedInsight sees it.
let buildVerdicts: Promise<Map<string, CachedInsight>> | null = null

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}

/** The AI verdict for one run, or null so the card keeps its rules-based copy. */
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
