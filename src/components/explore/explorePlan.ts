import type { PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { sessionOn } from '@/components/dashboard/nextSession'
import type { PlanPrescriptionView } from '@/components/plan/planCoachingView'
import { planPaceSecPerKm } from '@/components/plan/planPace'
import { dayKind, kindLabel } from '@/components/plan/sessionKind'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { sessionLabel } from '@/lib/activityTitle'
import { addDays, isoDate } from '@/lib/calendarDate'
import type { ExplorePlan } from './routeGenerator'

/**
 * A planned session as the route generator shows it (S3's "TODAY'S PLAN"
 * row): its name, its whole distance and the pace it averages - and nothing
 * else. Built on the server from the session Today and Plan pick (the
 * coach's over Garmin's, a cancelled one none), so the coach's reasoning
 * never reaches the page payload (see planCoachingView).
 */

/**
 * How far ahead the map knows the plan: the coach's rolling four weeks, so
 * Plan's "Find a route" on a session to come opens on that session.
 */
export const EXPLORE_PLAN_DAYS = 28

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * "Easy · 8 km + 6 strides": the kind, then the set. A session with no set
 * is named by its title alone - "Long run", "Easy run", as the coach names
 * them - and a title that already starts with its kind keeps it once.
 */
function planLabel(kind: string | null, title: string): string {
  if (!kind || !/\d/.test(title) || fold(title).startsWith(fold(kind))) return title
  return `${kind} · ${title}`
}

/**
 * The plan for `date`, or null - none, or a race (a race is run where it is
 * held, not on a generated loop).
 */
export function explorePlanOn(
  date: string,
  coach: readonly PlanPrescriptionView[],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null,
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
  const title = sessionLabel(workoutSummary(workout).title)
  return {
    date,
    label: planLabel(kind ? kindLabel(kind.type, kind.kind) : null, title),
    distanceM: workout.distanceM && workout.distanceM > 0 ? Math.round(workout.distanceM) : null,
    paceSecPerKm: planPaceSecPerKm(workout),
  }
}

/** The plans of `days` days from `today` on ('YYYY-MM-DD'), a day with none (or a race) left out. */
export function explorePlansFrom(
  today: string,
  coach: readonly PlanPrescriptionView[],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null,
  days = EXPLORE_PLAN_DAYS,
): ExplorePlan[] {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const start = new Date(year, month - 1, day)
  return Array.from({ length: days }, (_, i) => isoDate(addDays(start, i))).flatMap((date) => {
    const plan = explorePlanOn(date, coach, garmin, zones)
    return plan ? [plan] : []
  })
}
