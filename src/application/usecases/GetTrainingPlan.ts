import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingStatus } from './GetTrainingStatus'
import { getGoalsPageData } from './GetGoalsData'
import { round } from '@/lib/math'

const DAY_MS = 86_400_000
const PLAN_WEEKS = 4
const BUILD_STEP = 0.05        // default weekly volume increase (well under the 10% injury-risk rule)
const GOAL_CATCHUP_STEP = 0.10 // faster ramp allowed when behind annual pace
const DELOAD_FACTOR = 0.7      // recovery/deload week volume, relative to the previous week
const DELOAD_AFTER_BUILDS = 3  // classic 3-build / 1-deload microcycle
const FALLBACK_KM_PER_SESSION = 8

export type PlanFocus = 'recovery' | 'maintain' | 'build' | 'quality'

export interface TrainingPlanWeek {
  weekIndex: number
  startDate: string
  targetDistanceKm: number
  targetSessions: number
  focus: PlanFocus
}

export interface TrainingPlanData {
  baseWeeklyKm: number
  goalWeeklyNeeded: number | null
  weeks: TrainingPlanWeek[]
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getTrainingPlan(): TrainingPlanData | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const status = getTrainingStatus()
  if (!status) return null

  // Anchor to most recent activity (compatible with static data), like GetCoachData
  const latestDate = activities.reduce((max, a) => (a.date > max ? a.date : max), activities[0].date)
  const refTime = new Date(latestDate + 'T00:00:00').getTime()

  const km56d = activities
    .filter((a) => refTime - new Date(a.date + 'T00:00:00').getTime() <= 55 * DAY_MS)
    .reduce((s, a) => s + a.distanceKm, 0)
  const baseWeeklyKm = round(km56d / 8, 1)

  const last28d = activities.filter(
    (a) => refTime - new Date(a.date + 'T00:00:00').getTime() <= 27 * DAY_MS,
  )
  const km28d = last28d.reduce((s, a) => s + a.distanceKm, 0)
  // Sessions scale with target volume at the runner's own recent distance-per-session,
  // so the count actually changes between a build week and a deload week.
  const avgKmPerSession = last28d.length > 0 ? km28d / last28d.length : FALLBACK_KM_PER_SESSION

  const currentYear = new Date().getFullYear()
  const yearData = getGoalsPageData().byYear[currentYear]
  const goalWeeklyNeeded = yearData?.projection?.weeklyNeeded ?? null
  const goalStatus =
    yearData?.projection?.status ??
    (yearData?.goals && yearData.totalDistanceKm >= yearData.goals.annualDistanceKm ? 'ahead' : null)

  const weeks: TrainingPlanWeek[] = []
  let prevKm = baseWeeklyKm
  let buildStreak = 0

  for (let i = 1; i <= PLAN_WEEKS; i++) {
    const forceRecovery = i === 1 && status.risk === 'high'
    const forceHold = i === 1 && status.risk === 'moderate'
    const dueDeload = !forceRecovery && !forceHold && buildStreak >= DELOAD_AFTER_BUILDS

    let targetKm: number
    let focus: PlanFocus

    if (forceRecovery || dueDeload) {
      targetKm = prevKm * DELOAD_FACTOR
      focus = 'recovery'
      buildStreak = 0
    } else if (forceHold) {
      targetKm = prevKm
      focus = 'maintain'
    } else {
      const step = goalStatus === 'behind' ? GOAL_CATCHUP_STEP : BUILD_STEP
      const candidate = prevKm * (1 + step)
      targetKm =
        goalStatus === 'behind' && goalWeeklyNeeded !== null ? Math.min(candidate, goalWeeklyNeeded) : candidate

      if (targetKm > prevKm * 1.01) {
        focus = 'build'
        buildStreak += 1
      } else {
        focus = status.risk === 'low' && status.tsb > -5 ? 'quality' : 'maintain'
      }
    }

    weeks.push({
      weekIndex: i,
      startDate: isoDate(new Date(refTime + (1 + (i - 1) * 7) * DAY_MS)),
      targetDistanceKm: Math.round(targetKm),
      targetSessions: Math.min(8, Math.max(2, Math.round(targetKm / avgKmPerSession))),
      focus,
    })

    prevKm = targetKm
  }

  return { baseWeeklyKm, goalWeeklyNeeded, weeks }
}
