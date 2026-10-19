import type { TrainingStatus } from './GetTrainingStatus'
import { getActivitySummaries } from './GetActivities'
import { getTodayPlannedWorkout } from './GetPlannedWorkouts'
import { getTodayPrescription } from '@/application/coaching/GetCoachingView'
import type { PlannedWorkout } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { verdictTone } from '@/domain/training/readiness'
import { recentTraining } from '@/domain/training/recentTraining'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash, type TodayContext } from '@/domain/ai/todayInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { appTodayIso } from '@/lib/calendarDate'
import type { Insight } from '@/lib/gemini'

export function buildTodayContext(
  status: TrainingStatus,
  plannedWorkout: PlannedWorkout | null,
  today: string = appTodayIso()
): TodayContext {
  return {
    status,
    tone: verdictTone(status),
    plannedWorkout,
    recent: recentTraining(getActivitySummaries(), today),
  }
}

/**
 * A prescription carries the session the plan actually asked for; the Garmin
 * entry for the same day is that session after `coach:sync-garmin` pushed it to
 * the watch. Reading the prescription first is what lets the verdict name the
 * workout rather than whatever the watch called it.
 */
function asPlannedWorkout(prescription: WorkoutPrescription): PlannedWorkout {
  return {
    date: prescription.date,
    name: prescription.title,
    type: COACHING_TO_ACTIVITY_TYPE[prescription.type],
    ...(prescription.totalDurationSeconds === undefined
      ? {}
      : { durationSecs: prescription.totalDurationSeconds }),
    ...(prescription.totalDistanceMeters === undefined
      ? {}
      : { distanceM: prescription.totalDistanceMeters }),
  }
}

/**
 * The session today's verdict is written about.
 *
 * Both sides of the cache resolve it here and neither may resolve it its own
 * way: the generator hashes the context it wrote, the page hashes the context
 * it wants, and two resolutions of "today's session" are two hashes, so the
 * page would look up a card that exists under another key and fall back to the
 * deterministic copy forever. The same holds for the date: both read
 * appTodayIso(), the athlete's day, not the server's.
 */
export async function todayInsightSession(today: string = appTodayIso()): Promise<PlannedWorkout | null> {
  const prescription = getTodayPrescription(today)
  return prescription ? asPlannedWorkout(prescription) : await getTodayPlannedWorkout(today)
}

export async function getTodayInsight(
  status: TrainingStatus | null,
  plannedWorkout: PlannedWorkout | null,
  today: string = appTodayIso()
): Promise<Insight | null> {
  if (!status) return null

  const context = buildTodayContext(status, plannedWorkout, today)
  return readVerifiedInsight(TODAY_SURFACE, {
    hash: todayInsightHash(context),
    guard: todayInsightGuard(context),
  })
}
