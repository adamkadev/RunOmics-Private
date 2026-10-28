import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runHistory } from '@/domain/activity/runHistory'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { COACHING_TO_ACTIVITY_TYPE, type CoachingPlan } from '@/domain/coaching/types'
import { sessionIntentOn } from '@/domain/coaching/sessionIntent'
import { sessionForRun, sessionsAcrossPlans, type RunSession } from '@/domain/coaching/sessionForRun'
import {
  runVerdictInsightHash,
  runVerdictJudgement,
  runVerdictSurface,
  type RunVerdictContext,
} from '@/domain/ai/runVerdictInsight'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { readVerifiedCachedInsight, readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

interface Coaching {
  plans: CoachingPlan[]
  sessions: RunSession[]
}

/**
 * Archived plans too: a finished block's sessions live only there. A plan that
 * fails to parse costs the verdicts their coaching intent, never the verdicts.
 */
function coaching(): Coaching {
  try {
    const repository = new JsonCoachingRepository()
    const current = repository.getCurrentPlan()
    const plans = [...(current ? [current] : []), ...repository.getArchivedPlans()]
    return { plans, sessions: sessionsAcrossPlans(plans, repository.getEvaluations()) }
  } catch (error) {
    console.error('[run-verdict] coaching plans unreadable', error)
    return { plans: [], sessions: [] }
  }
}

function buildContext(
  activity: Activity,
  activities: Activity[],
  planned: PlannedWorkout[],
  officialResults: OfficialRaceResult[],
  { plans, sessions }: Coaching,
): RunVerdictContext {
  const session = sessionForRun(activity, sessions)
  return {
    activity,
    history: runHistory(activity, activities, officialResults),
    planned: planned.find((workout) => workout.date === activity.date.slice(0, 10)) ?? null,
    official: officialResultsByActivityId(officialResults).get(activity.id) ?? null,
    intent: sessionIntentOn(activity.date, plans),
    sessionType: session ? COACHING_TO_ACTIVITY_TYPE[session.type] : null,
  }
}

export function getRunVerdictContexts(): RunVerdictContext[] {
  const activities = getAllActivities()
  const planned = getAllPlannedWorkouts()
  const officialResults = getOfficialRaceResults()
  const plans = coaching()
  return activities.map((activity) => buildContext(activity, activities, planned, officialResults, plans))
}

export interface RunVerdictView {
  insight: Insight | null
  /** The card's badge, from the judgement the written verdict was given. */
  tone: VerdictTone
}

export async function getRunVerdict(activity: Activity): Promise<RunVerdictView> {
  const context = buildContext(activity, getAllActivities(), getAllPlannedWorkouts(), getOfficialRaceResults(), coaching())
  return {
    insight: await readVerifiedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context)),
    tone: runVerdictJudgement(context).tone,
  }
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

  const context = buildContext(activity, activities, getAllPlannedWorkouts(), getOfficialRaceResults(), coaching())
  const cached = await readVerifiedCachedInsight(runVerdictSurface(activity.id), runVerdictInsightHash(context))

  return {
    activity,
    verdict: cached ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null,
    generatedAt: cached?.generatedAt ?? null,
  }
}
