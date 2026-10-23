import { DAY_MS } from '@/lib/calendarDate'
import type { Activity } from '@/domain/activity/types'

const DAY = DAY_MS
/** A year of Mondays: enough to show a season's shape without bloating the prompt. */
const WEEKS_IN_SERIES = 52
const day = (date: string) => Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY)
const isoDate = (dayNumber: number) => new Date(dayNumber * DAY).toISOString().slice(0, 10)
const round = (n: number) => Math.round(n * 100) / 100
const RUN_TYPES = new Set(['Base', 'Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint', 'Race'])
export function isRunningActivity(activity: Activity): boolean {
  return activity.sport !== undefined
    ? ['running', 'trail_running', 'treadmill_running', 'track_running'].includes(activity.sport.toLowerCase())
    : RUN_TYPES.has(activity.type)
}

export function trainingHistory(activities: Activity[], referenceDate: string) {
  const reference = day(referenceDate)
  const runs = activities.filter(isRunningActivity).filter(a => day(a.date) <= reference)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const recent = runs.filter(a => day(a.date) > reference - 28)
  const recent7 = recent.filter(a => day(a.date) > reference - 7)
  const monday = (d: number) => d - ((d + 3) % 7 + 7) % 7
  const first = runs.length ? monday(day(runs[0]!.date)) : monday(reference)
  const weeks = Array.from({ length: Math.floor((monday(reference) - first) / 7) + 1 }, () => ({ km: 0, runs: 0 }))
  for (const run of runs) {
    const week = weeks[Math.floor((monday(day(run.date)) - first) / 7)]!
    week.km += run.distanceKm
    week.runs++
  }
  const best = (n: number) => {
    let km = 0, count = 0
    for (let i = 0; i + n <= weeks.length; i++) {
      const window = weeks.slice(i, i + n)
      const total = window.reduce((s, w) => s + w.km, 0)
      if (total > km) { km = total; count = window.reduce((s, w) => s + w.runs, 0) }
    }
    return { km: round(km / n), runs: round(count / n) }
  }
  const dates = new Set(recent.map(a => day(a.date)))
  let longest = 0, gap = 0
  for (let d = reference - 27; d <= reference; d++) {
    gap = dates.has(d) ? 0 : gap + 1
    longest = Math.max(longest, gap)
  }
  const recentKm = recent.reduce((s, a) => s + a.distanceKm, 0)
  const longestWithin = (days: number) => runs
    .filter(a => day(a.date) > reference - days)
    .reduce((longest, a) => Math.max(longest, a.distanceKm), 0)
  // A month lost to travel and one lost to injury give the same depressed mean
  // and call for opposite prescriptions; only the series shows the shape.
  const series = weeks.slice(-WEEKS_IN_SERIES)
  return {
    recent7DaysKm: round(recent7.reduce((s, a) => s + a.distanceKm, 0)),
    recent28DaysKm: round(recentKm), recent28DaysRuns: recent.length,
    recentWeeklyAverageKm: round(recentKm / 4), recentWeeklyAverageRuns: round(recent.length / 4),
    historicalPeakWeekKm: best(1).km, historicalPeakWeekRuns: best(1).runs,
    best4WeekAverageKm: best(4).km, best6WeekAverageKm: best(6).km,
    best8WeekAverageKm: best(8).km, best12WeekAverageKm: best(12).km,
    typicalFrequencyAtPeak: best(Math.min(12, weeks.length)).runs,
    daysSinceLastRun: runs.length ? reference - day(runs.at(-1)!.date) : null,
    longestRecentGapDays: longest,
    // Weekly totals let a single outsized session hide inside an ordinary week.
    longestRunLast30DaysKm: round(longestWithin(30)),
    longestRunLast90DaysKm: round(longestWithin(90)),
    weeklySeries: {
      firstWeekStart: isoDate(first + (weeks.length - series.length) * 7),
      km: series.map((week) => round(week.km)),
      runs: series.map((week) => week.runs),
    },
  }
}
export type TrainingHistory = ReturnType<typeof trainingHistory>
