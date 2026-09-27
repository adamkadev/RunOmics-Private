import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { appTodayIso } from '@/lib/calendarDate'
import { getVO2maxReadings } from '@/application/usecases/GetVO2maxHistory'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getTrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getHeatImpact } from '@/application/usecases/GetHeatImpact'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { isRaceDistanceKey, type RaceDistanceKey } from '@/domain/race/distances'
import { cumulativeYear } from '@/components/profile/progressHub'
import { weeklyAverageKm } from '@/domain/training/weeklyAverage'
import { AnalyticsClient, type AnalyticsBoardData } from '@/components/analytics/AnalyticsClient'
import { yearOverYear } from '@/components/analytics/analyticsView'
import { loadPlanWeeks } from '../_data/loadPlanWeeks'
import { getLoadPairs, getRecoveryHistory } from '@/application/usecases/GetLoadRecovery'

export const revalidate = 3600

function dayOfYear(iso: string): number {
  const y = Number(iso.slice(0, 4))
  return Math.round((Date.UTC(y, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(y, 0, 1)) / 86_400_000) + 1
}

const daysIn = (year: number) => dayOfYear(`${year}-12-31`)

export default async function AnalyticsPage() {
  const today = appTodayIso()
  const year = Number(today.slice(0, 4))
  const [data, trainingLoad, risk, goals] = await Promise.all([getAnalyticsData(), getTrainingLoad(), getLoadRiskPanel(), getGoalsPageData()])

  const activities = getActivitySummaries()
  const todayDay = dayOfYear(today)
  const hadLastYear = activities.some((a) => a.date.startsWith(String(year - 1)))
  const yearData = goals.byYear[year] ?? null
  const spotlight = yearData?.nextRaceSpotlight ?? null
  const goalKm = yearData?.goals && yearData.goals.annualDistanceKm > 0 ? yearData.goals.annualDistanceKm : null

  const board: AnalyticsBoardData = {
    load: trainingLoad?.points.map(({ date, ctl, atl }) => ({ date, ctl, atl })) ?? [],
    status: getTrainingStatusHistory()?.points.map(({ date, status }) => ({ date, status })) ?? [],
    risk,
    loads: getLoadPairs(),
    recovery: getRecoveryHistory(),
    weeks: data.weeklyTrends,
    plan: await loadPlanWeeks(getCoachingOverview(today)),
    vo2max: getVO2maxReadings(),
    threshold:
      getThresholdHistory()?.points.flatMap((p) => (p.thresholdPaceSecPerKm !== null ? [{ date: p.date, pace: p.thresholdPaceSecPerKm }] : [])) ?? [],
    predictions: getGarminRacePredictions()?.points.map(({ date, seconds }) => ({ date, seconds })) ?? [],
    race:
      spotlight && isRaceDistanceKey(spotlight.race.distance.toLowerCase())
        ? {
            distance: spotlight.race.distance.toLowerCase() as RaceDistanceKey,
            date: spotlight.race.date,
            daysUntil: spotlight.daysUntil,
            targetSeconds: spotlight.race.targetSeconds ?? null,
          }
        : null,
    heat: getHeatImpact(),
    weeklyAvgKm: weeklyAverageKm(activities, today),
    ytd: {
      year,
      daysInYear: daysIn(year),
      todayDay,
      current: cumulativeYear(activities, year, todayDay),
      previous: hadLastYear ? cumulativeYear(activities, year - 1, daysIn(year - 1)) : [],
      vsLastYear: yearOverYear(activities, today),
      goalKm,
      projection: yearData?.projection
        ? {
            weeklyRate: yearData.projection.weeklyRate,
            weeklyNeeded: yearData.projection.weeklyNeeded,
            projectedYearKm: yearData.projection.projectedYearKm,
          }
        : null,
    },
  }

  return <AnalyticsClient data={board} today={today} />
}
