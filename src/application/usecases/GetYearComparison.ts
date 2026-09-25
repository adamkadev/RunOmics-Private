import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'
import { DAY_MS, appTodayIso } from '@/lib/calendarDate'
import { sameDateLastYear, yearToDate } from '@/domain/activity/sameDate'

export interface YearMetrics {
  year: number
  distanceKm: number
  sessionCount: number
  durationSeconds: number
  avgKmPerWeek: number
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  elevationM: number
}

export interface YearComparisonData {
  years: [number, number]
  /** The newer year's cut-off (today, when it is the current year); the older
   *  year is taken to the same month and day. Null when both are whole years. */
  cutoff: string | null
  newer: YearMetrics
  older: YearMetrics
}

export function avgWeightedPace(activities: ReturnType<typeof getAllActivities>): number | null {
  const valid = activities.filter((a) => a.paceSecPerKm != null && a.distanceKm > 0)
  if (!valid.length) return null
  const totalKm = valid.reduce((s, a) => s + a.distanceKm, 0)
  const totalSec = valid.reduce((s, a) => s + a.paceSecPerKm! * a.distanceKm, 0)
  return Math.round(totalSec / totalKm)
}

export function avgWeightedHR(activities: ReturnType<typeof getAllActivities>): number | null {
  const valid = activities.filter((a) => a.avgHeartRate != null && a.durationSeconds > 0)
  if (!valid.length) return null
  const totalDur = valid.reduce((s, a) => s + a.durationSeconds, 0)
  const totalHR = valid.reduce((s, a) => s + a.avgHeartRate! * a.durationSeconds, 0)
  return Math.round(totalHR / totalDur)
}

/**
 * Per week since the window's first run, to its cut-off: weeks without a run
 * count, so a year that started in April isn't averaged over its active weeks
 * only.
 */
function weeksSinceFirstRun(activities: ReturnType<typeof getAllActivities>, cutoffIso: string | null): number {
  const dates = activities.map((a) => a.date.slice(0, 10)).sort()
  const first = dates[0]
  if (!first) return 0
  const last = cutoffIso ?? dates[dates.length - 1]!
  const days = (new Date(last + 'T00:00:00').getTime() - new Date(first + 'T00:00:00').getTime()) / DAY_MS + 1
  return Math.max(1, days / 7)
}

export function buildMetrics(
  year: number,
  activities: ReturnType<typeof getAllActivities>,
  cutoffIso: string | null = null,
): YearMetrics {
  const distanceKm = activities.reduce((s, a) => s + a.distanceKm, 0)
  const durationSeconds = activities.reduce((s, a) => s + a.durationSeconds, 0)
  const elevationM = activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)

  const weeks = weeksSinceFirstRun(activities, cutoffIso)
  const avgKmPerWeek = weeks > 0 ? round(distanceKm / weeks) : 0

  return {
    year,
    distanceKm: round(distanceKm),
    sessionCount: activities.length,
    durationSeconds: Math.round(durationSeconds),
    avgKmPerWeek,
    avgPaceSecPerKm: avgWeightedPace(activities),
    avgHeartRate: avgWeightedHR(activities),
    elevationM: Math.round(elevationM),
  }
}

export function getYearComparison(todayIso: string = appTodayIso()): YearComparisonData | null {
  const all = getAllActivities()

  const byYear = new Map<number, typeof all>()
  for (const a of all) {
    const y = Number(a.date.slice(0, 4))
    byYear.set(y, [...(byYear.get(y) ?? []), a])
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a)
  const [newer, older] = years
  if (newer === undefined || older === undefined) return null

  // The current year is only part-way through: both sides stop at today's
  // month and day. Two past years compare whole.
  const partial = newer === Number(todayIso.slice(0, 4))
  const cutoff = partial ? todayIso : null
  const olderCutoff = partial ? sameDateLastYear(todayIso) : null
  const newerRuns = partial ? yearToDate(byYear.get(newer)!, newer, todayIso) : byYear.get(newer)!
  const olderRuns = olderCutoff ? yearToDate(byYear.get(older)!, older, olderCutoff) : byYear.get(older)!

  return {
    years: [newer, older],
    cutoff,
    newer: buildMetrics(newer, newerRuns, cutoff),
    older: buildMetrics(older, olderRuns, olderCutoff),
  }
}
