import type { TrainingStatus } from './GetTrainingStatus'
import { getActivitySummaries } from './GetActivities'
import { getTodayPlannedWorkout } from './GetPlannedWorkouts'
import { getTodayPrescription } from '@/application/coaching/GetCoachingView'
import type { PlannedWorkout } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { verdictTone } from '@/domain/training/readiness'
import { recentTraining } from '@/domain/training/recentTraining'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash, type TodayContext } from '@/domain/ai/todayInsight'
import { readStoredInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
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
 * Read before the Garmin entry, the prescription lets the verdict name the
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
 * The generator and the page must both resolve today's session here, from
 * appTodayIso(): two resolutions are two cache hashes, and the page would never
 * find the card.
 */
export async function todayInsightSession(today: string = appTodayIso()): Promise<PlannedWorkout | null> {
  const prescription = getTodayPrescription(today)
  return prescription ? asPlannedWorkout(prescription) : await getTodayPlannedWorkout(today)
}

export interface TodayVerdict extends Insight {
  yesterday?: boolean
}

/**
 * Between midnight and the night's sync no card matches the new day:
 * yesterday's card stands in, an older one never does.
 */
export async function getTodayInsight(
  status: TrainingStatus | null,
  plannedWorkout: PlannedWorkout | null,
  today: string = appTodayIso()
): Promise<TodayVerdict | null> {
  if (!status) return null

  const context = buildTodayContext(status, plannedWorkout, today)
  const stored = await readStoredInsight(TODAY_SURFACE, {
    hash: todayInsightHash(context),
    guard: todayInsightGuard(context),
  })
  if (!stored) return null
  if (stored.verified) return stored.insight

  const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1))
  return appTodayIso(new Date(stored.generatedAt)) === yesterday ? { ...stored.insight, yesterday: true } : null
}
