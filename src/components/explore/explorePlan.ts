import type { PlannedWorkout, ScheduledTimeOfDay } from '@/domain/activity/types'
import type { ExploreSession } from '@/domain/explore/climbBudget'
import type { CoachingWorkoutType } from '@/domain/coaching/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { sessionOn } from '@/components/dashboard/nextSession'
import type { PlanPrescriptionView } from '@/components/plan/planCoachingView'
import { planPaceSecPerKm } from '@/components/plan/planPace'
import { dayKind, kindLabel, type SessionKind } from '@/components/plan/sessionKind'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { sessionLabel } from '@/lib/activityTitle'
import { addDays, isoDate } from '@/lib/calendarDate'
import type { ExplorePlan } from './routeGenerator'

/** The coach's rolling four weeks. */
export const EXPLORE_PLAN_DAYS = 28

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** "Easy · 8 km + 6 strides"; a title with no set ("Long run") or already starting with its kind stands alone. */
function planLabel(kind: string | null, title: string): string {
  if (!kind || !/\d/.test(title) || fold(title).startsWith(fold(kind))) return title
  return `${kind} · ${title}`
}

/** The coach's type first: only it tells a recovery run from an easy one. */
export function exploreSession(coachType: CoachingWorkoutType | null, kind: SessionKind | null): ExploreSession {
  if (coachType === 'recovery') return 'recovery'
  if (coachType === 'long_run' || kind === 'long') return 'long'
  if (kind === 'quality') return 'quality'
  return 'easy'
}

/**
 * Only label, distance and pace, so the coach's reasoning never reaches the page payload.
 * A race gets none: it is run where it is held, not on a generated loop.
 */
export function explorePlanOn(
  date: string,
  coach: readonly PlanPrescriptionView[],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null,
  runHour: (scheduled: ScheduledTimeOfDay | undefined) => number | null = () => null,
): ExplorePlan | null {
  const session = sessionOn(date, coach, garmin, zones)
  if (!session) return null
  const { workout } = session
  const kind = dayKind(
    date,
    [],
    new Map(garmin.filter((p) => p.date === date).map((p) => [p.date, p])),
    new Map([[date, coach.filter((v) => v.prescription.date === date)]]),
  )
  if (kind?.type === 'Race' || workout.type === 'Race') return null
  const coachType = coach.find((v) => v.prescription.date === date && v.state !== 'cancelled')?.prescription.type ?? null
  const title = sessionLabel(workoutSummary(workout).title)
  return {
    date,
    label: planLabel(kind ? kindLabel(kind.type, kind.kind) : null, title),
    distanceM: workout.distanceM && workout.distanceM > 0 ? Math.round(workout.distanceM) : null,
    paceSecPerKm: planPaceSecPerKm(workout),
    session: exploreSession(coachType, kind?.kind ?? null),
    hour: runHour(garmin.find((p) => p.date === date)?.scheduledTime),
  }
}

export function explorePlansFrom(
  today: string,
  coach: readonly PlanPrescriptionView[],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null,
  runHour?: (scheduled: ScheduledTimeOfDay | undefined) => number | null,
  days = EXPLORE_PLAN_DAYS,
): ExplorePlan[] {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const start = new Date(year, month - 1, day)
  return Array.from({ length: days }, (_, i) => isoDate(addDays(start, i))).flatMap((date) => {
    const plan = explorePlanOn(date, coach, garmin, zones, runHour)
    return plan ? [plan] : []
  })
}
