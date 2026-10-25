import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { appTodayIso } from '@/lib/calendarDate'
import { getVO2maxReadings } from '@/application/usecases/GetVO2maxHistory'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getTrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getHeatImpact } from '@/application/usecases/GetHeatImpact'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { isRaceDistanceKey, type RaceDistanceKey } from '@/domain/race/distances'
import { weeklyAverageKm } from '@/domain/training/weeklyAverage'
import { AnalyticsClient, type AnalyticsBoardData } from '@/components/analytics/AnalyticsClient'
import { yearOverYear } from '@/lib/yearOverYear'
import { loadPlanWeeks } from '../_data/loadPlanWeeks'
import { getLoadPairs, getRecoveryHistory } from '@/application/usecases/GetLoadRecovery'
import { loadData } from '@/application/usecases/LoadData'
import { getPaceBests } from '@/application/usecases/GetPaceCurve'

export const revalidate = 3600

export default async function AnalyticsPage() {
  await loadData()
  const today = appTodayIso()
  const year = Number(today.slice(0, 4))
  const [data, trainingLoad, risk, goals] = await Promise.all([getAnalyticsData(), getTrainingLoad(), getLoadRiskPanel(), getGoalsPageData(today)])

  const activities = getActivitySummaries()
  const plan = await loadPlanWeeks(getCoachingOverview(today), today)
  const yearData = goals.byYear[year] ?? null
  const spotlight = goals.nextRace
  const goalKm = yearData?.goals && yearData.goals.annualDistanceKm > 0 ? yearData.goals.annualDistanceKm : null

  const threshold = getThresholdHistory()?.points ?? []
  const board: AnalyticsBoardData = {
    load: trainingLoad?.points.map(({ date, ctl, atl }) => ({ date, ctl, atl })) ?? [],
    status: getTrainingStatusHistory()?.points.map(({ date, status }) => ({ date, status })) ?? [],
    risk,
    loads: getLoadPairs(),
    recovery: getRecoveryHistory(),
    weeks: data.weeklyTrends,
    plan: plan.weeks,
    missed: plan.missed,
    vo2max: getVO2maxReadings(),
    threshold: threshold.flatMap((p) => (p.thresholdPaceSecPerKm !== null ? [{ date: p.date, pace: p.thresholdPaceSecPerKm }] : [])),
    lthr: threshold.flatMap((p) => (p.lthrBpm !== null ? [{ date: p.date, bpm: p.lthrBpm }] : [])),
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
    balance: getLoadBalance(),
    paceBests: getPaceBests(),
    weeklyAvgKm: weeklyAverageKm(activities, today),
    // Goals' own figures: Volume summarises them and links there.
    ytd: {
      km: yearData?.totalDistanceKm ?? 0,
      vsLastYear: yearOverYear(activities, today),
      goalKm,
      projection: yearData?.projection ? { projectedYearKm: yearData.projection.projectedYearKm } : null,
    },
  }

  return <AnalyticsClient data={board} today={today} />
}
