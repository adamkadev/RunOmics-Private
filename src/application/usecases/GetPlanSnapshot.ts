import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingStatus } from './GetTrainingStatus'
import { getTrainingLoad } from './GetTrainingLoad'
import { getConsistencyScore } from './GetConsistencyScore'
import { getCoachData } from './GetCoachData'
import { getTrainingZones } from './GetTrainingZones'
import { getGoalsPageData } from './GetGoalsData'
import { round } from '@/lib/math'
import { formatClock } from '@/lib/formatters'
import type { PlanInput } from '@/infrastructure/llm/plan/types'

const DAY_MS = 86_400_000

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // back to Monday
  return x
}

// Read-only aggregation of existing usecases into the snapshot the plan is
// grounded in. Build-time pure; touches no analytics computation.
export function getPlanSnapshot(): PlanInput | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const status = getTrainingStatus()
  const load = getTrainingLoad()
  const consistency = getConsistencyScore()
  const coach = getCoachData()
  const zones = getTrainingZones()
  const goals = getGoalsPageData()

  const now = new Date()
  const currentYear = now.getFullYear()
  const yearData = goals.byYear[currentYear] ?? null

  // Rolling 8-week rate (real-now anchored, to match the goal projection).
  const cutoff = now.getTime() - 56 * DAY_MS
  const recent = activities.filter((a) => new Date(a.date + 'T00:00:00').getTime() >= cutoff)
  const recentWeeklyKm = round(recent.reduce((s, a) => s + a.distanceKm, 0) / 8, 1)

  // Easy/hard time split over the same window, from HR zones.
  let easySec = 0
  let totalSec = 0
  for (const a of recent) {
    for (const z of a.hrZones) {
      totalSec += z.seconds
      if (z.zone <= 2) easySec += z.seconds
    }
  }
  const easyPct = totalSec ? round((easySec / totalSec) * 100) : null
  const hardPct = easyPct === null ? null : round(100 - easyPct)

  // Sessions already logged this calendar week (Monday up to today), so the
  // plan reflects what actually happened instead of re-prescribing those days.
  const monday = startOfWeek(now)
  const completedThisWeek = activities
    .filter((a) => new Date(a.date + 'T00:00:00').getTime() >= monday.getTime())
    .map((a) => ({ day: a.dayOfWeek, type: a.type, distanceKm: a.distanceKm }))

  return {
    today: now.toLocaleDateString('en-US', { weekday: 'long' }),
    completedThisWeek,
    trainingStatus: status
      ? {
          status: status.status,
          risk: status.risk,
          loadTrend: status.loadTrend,
          acwr: status.acwr,
          ctlDelta: status.ctlDelta,
        }
      : null,
    load: load ? { fitnessCtl: load.ctl, fatigueAtl: load.atl, formTsb: load.tsb } : null,
    consistency: consistency
      ? {
          score: consistency.score,
          adherence: consistency.adherence,
          stability: consistency.stability,
          rating: consistency.rating,
        }
      : null,
    recentWeeklyKm,
    currentWeek: coach
      ? { distanceKm: coach.week.distanceKm, sessions: coach.week.sessions }
      : { distanceKm: 0, sessions: 0 },
    sessionMix: coach
      ? coach.sessionTypeBreakdown.map((b) => ({ type: b.type, sessions: b.sessions, distanceKm: b.distanceKm }))
      : [],
    easyHardSplit: { easyPct, hardPct },
    // Pre-formatted so the model copies a real, already-rounded pace string
    // instead of computing/inventing one itself.
    paceZones: zones
      ? zones.zones.map((z) => ({
          key: z.key,
          label: `${formatClock(z.paceMinSecPerKm)} - ${formatClock(z.paceMaxSecPerKm)} /km`,
        }))
      : [],
    goal:
      yearData && yearData.goals
        ? {
            year: currentYear,
            annualDistanceKm: yearData.goals.annualDistanceKm,
            distanceDoneKm: round(yearData.totalDistanceKm),
            projection: yearData.projection
              ? {
                  weeklyRate: yearData.projection.weeklyRate,
                  weeklyNeeded: yearData.projection.weeklyNeeded,
                  projectedYearKm: yearData.projection.projectedYearKm,
                  status: yearData.projection.status,
                  deltaKm: yearData.projection.deltaKm,
                }
              : null,
            targets: yearData.goals.targets.map((t) => ({ distance: t.distance, targetSeconds: t.targetSeconds })),
          }
        : null,
  }
}
