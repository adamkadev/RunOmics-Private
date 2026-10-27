import type { YearData } from '@/application/usecases/GetGoalsData'
import type { YtdInput } from '@/components/analytics/analyticsView'
import { yearDistanceKm } from '@/domain/activity/distance'
import { yearOverYear } from '@/lib/yearOverYear'

/** The distance comes from the runs, as on Progress: Goals has no year without a goal, PB or race in it. */
export function analyticsYtd(
  activities: readonly { date: string; distanceKm: number }[],
  yearData: YearData | null,
  today: string,
): YtdInput {
  const goalKm = yearData?.goals && yearData.goals.annualDistanceKm > 0 ? yearData.goals.annualDistanceKm : null
  return {
    km: yearDistanceKm(activities, Number(today.slice(0, 4))),
    vsLastYear: yearOverYear(activities, today),
    goalKm,
    projection: yearData?.projection ? { projectedYearKm: yearData.projection.projectedYearKm } : null,
  }
}
