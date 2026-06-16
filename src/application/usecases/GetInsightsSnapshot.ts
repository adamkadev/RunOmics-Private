import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingLoad } from './GetTrainingLoad'
import { getTrainingStatus } from './GetTrainingStatus'
import { getConsistencyScore } from './GetConsistencyScore'
import { getLatestVO2max } from './GetVO2maxHistory'
import { getAnalyticsData } from './GetAnalyticsData'
import { round } from '@/lib/math'
import type { InsightsInput } from '@/infrastructure/llm/insights/types'

const DAY_MS = 86_400_000
const PERIOD_WEEKS = 8

function avgOf(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? round(present.reduce((s, v) => s + v, 0) / present.length, 1) : null
}

function lastDefined<T, V>(items: T[], pick: (item: T) => V | null): V | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const v = pick(items[i])
    if (v !== null) return v
  }
  return null
}

// Read-only aggregation of existing usecases into the compact snapshot the LLM
// reasons over. Build-time pure; touches no analytics computation.
export function getInsightsSnapshot(): InsightsInput | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const load = getTrainingLoad()
  const status = getTrainingStatus()
  const consistency = getConsistencyScore()
  const vo2max = getLatestVO2max()
  const analytics = getAnalyticsData()
  const period = analytics.byPeriod[PERIOD_WEEKS]

  // Anchor to the most recent activity so the snapshot is stable on static data.
  const latest = activities.reduce((max, a) => (a.date > max ? a.date : max), activities[0].date)
  const refMs = new Date(latest + 'T00:00:00').getTime()
  const kmInLastDays = (n: number) =>
    round(
      activities
        .filter((a) => new Date(a.date + 'T00:00:00').getTime() >= refMs - (n - 1) * DAY_MS)
        .reduce((s, a) => s + a.distanceKm, 0),
    )

  return {
    trainingLoad: load
      ? { fitnessCtl: load.ctl, fatigueAtl: load.atl, formTsb: load.tsb }
      : null,
    trainingStatus: status
      ? {
          status: status.status,
          risk: status.risk,
          loadTrend: status.loadTrend,
          acwr: status.acwr,
          ctlDelta: status.ctlDelta,
        }
      : null,
    consistency: consistency
      ? {
          score: consistency.score,
          adherence: consistency.adherence,
          stability: consistency.stability,
          rating: consistency.rating,
        }
      : null,
    vo2max,
    volume: {
      last7Km: kmInLastDays(7),
      last28Km: kmInLastDays(28),
      weeklyAvgKm: period.totals.avgKmPerWeek,
    },
    easyHardSplit: {
      easyPct: avgOf(period.easyHardSplit.map((b) => b.easyPct)),
      hardPct: avgOf(period.easyHardSplit.map((b) => b.hardPct)),
    },
    pace: {
      easyPaceSecPerKm: lastDefined(period.paceTrend, (b) => b.easyPace),
      easyPaceDeltaSec: period.delta?.easyPaceSec ?? null,
    },
    efficiency: {
      ef7: lastDefined(analytics.efficiencyDaily, (b) => b.ef7),
      ef30: lastDefined(analytics.efficiencyDaily, (b) => b.ef30),
    },
    period: {
      weeks: PERIOD_WEEKS,
      distancePct: period.delta?.distancePct ?? null,
      sessionsPct: period.delta?.sessionsPct ?? null,
    },
  }
}
