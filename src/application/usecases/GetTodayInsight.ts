import type { TrainingStatus } from './GetTrainingStatus'
import { getActivitySummaries } from './GetActivities'
import { getTodayPlannedWorkout } from './GetPlannedWorkouts'
import { getTodayPrescription } from '@/application/coaching/GetCoachingView'
import type { PlannedWorkout } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { verdictTone } from '@/domain/training/readiness'
import { recentTraining } from '@/domain/training/recentTraining'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash, type TodayContext } from '@/domain/ai/todayInsight'
import { readLatestInsight, readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { addDays, appTodayIso, isoDate } from '@/lib/calendarDate'
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

/** Today's card, or yesterday's while today's is not written yet (3.1.0). */
export interface TodayVerdict extends Insight {
  /** Written on the athlete's previous day: Today labels it "Yesterday". */
  yesterday?: boolean
}

/**
 * Today's verdict. Between midnight and the night's sync no card matches the
 * new day, and the hero used to sit empty; the latest card, when it was
 * written yesterday (the athlete's day), stands in, marked as yesterday's.
 * An older one is not shown.
 */
export async function getTodayInsight(
  status: TrainingStatus | null,
  plannedWorkout: PlannedWorkout | null,
  today: string = appTodayIso()
): Promise<TodayVerdict | null> {
  if (!status) return null

  const context = buildTodayContext(status, plannedWorkout, today)
  const fresh = await readVerifiedInsight(TODAY_SURFACE, {
    hash: todayInsightHash(context),
    guard: todayInsightGuard(context),
  })
  if (fresh) return fresh

  const latest = await readLatestInsight(TODAY_SURFACE)
  if (!latest) return null
  const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1))
  return appTodayIso(new Date(latest.generatedAt)) === yesterday ? { ...latest.insight, yesterday: true } : null
}
