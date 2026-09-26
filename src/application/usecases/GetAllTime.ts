import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { isoDate, startOfWeek } from '@/lib/calendarDate'

export interface AllTimeYear {
  year: number
  km: number
  runs: number
  hours: number
}

export interface AllTimeMonth {
  /** YYYY-MM */
  key: string
  year: number
  km: number
  /** The month still running, drawn as a lighter bar. */
  partial: boolean
}

export interface AllTimeView {
  km: number
  runs: number
  hours: number
  /** The first run's date; null with no runs. */
  since: string | null
  /** Months from the first run's month to this one, both counted. */
  months: number
  /** Oldest first. */
  years: AllTimeYear[]
  /** When the first year started after January: its months against this year's so far. */
  partialFirstYear: { year: number; startMonth: number; months: number; currentMonths: number } | null
  monthly: AllTimeMonth[]
  bestMonth: AllTimeMonth | null
  longestRun: { km: number; date: string } | null
  biggestWeek: { km: number; weekStart: string } | null
  currentYear: number
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** Every month from `from` to `to` (YYYY-MM), both included. */
function monthsBetween(from: string, to: string): string[] {
  const keys: string[] = []
  let [year, month] = from.split('-').map(Number) as [number, number]
  const [endYear, endMonth] = to.split('-').map(Number) as [number, number]
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return keys
}

/**
 * Everything since the first run (C6, v4.4b): the totals, one row per year
 * scaled to the best one, every month's km, and the two bests.
 */
export function allTimeView(activities: Pick<Activity, 'date' | 'distanceKm' | 'durationSeconds'>[], today: string): AllTimeView {
  const currentYear = Number(today.slice(0, 4))
  const dated = activities.filter((a) => a.date).map((a) => ({ ...a, date: a.date.slice(0, 10) }))
  const since = dated.reduce<string | null>((min, a) => (!min || a.date < min ? a.date : min), null)

  const km = dated.reduce((sum, a) => sum + a.distanceKm, 0)
  const seconds = dated.reduce((sum, a) => sum + a.durationSeconds, 0)

  const byYear = new Map<number, AllTimeYear>()
  const byMonth = new Map<string, number>()
  const byWeek = new Map<string, number>()
  let longestRun: AllTimeView['longestRun'] = null
  for (const a of dated) {
    const year = Number(a.date.slice(0, 4))
    const entry = byYear.get(year) ?? { year, km: 0, runs: 0, hours: 0 }
    entry.km += a.distanceKm
    entry.runs += 1
    entry.hours += a.durationSeconds / 3600
    byYear.set(year, entry)
    byMonth.set(monthKey(a.date), (byMonth.get(monthKey(a.date)) ?? 0) + a.distanceKm)
    const week = isoDate(startOfWeek(new Date(`${a.date}T12:00:00`)))
    byWeek.set(week, (byWeek.get(week) ?? 0) + a.distanceKm)
    if (!longestRun || a.distanceKm > longestRun.km) longestRun = { km: a.distanceKm, date: a.date }
  }

  const firstYear = since ? Number(since.slice(0, 4)) : currentYear
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => firstYear + i).map((year) => {
    const entry = byYear.get(year)
    return { year, km: Math.round(entry?.km ?? 0), runs: entry?.runs ?? 0, hours: Math.round(entry?.hours ?? 0) }
  })

  const currentKey = monthKey(today)
  const monthly = since
    ? monthsBetween(monthKey(since), currentKey).map((key) => ({
        key,
        year: Number(key.slice(0, 4)),
        km: Math.round(byMonth.get(key) ?? 0),
        partial: key === currentKey,
      }))
    : []
  const bestMonth = monthly.reduce<AllTimeMonth | null>((best, m) => (!best || m.km > best.km ? m : best), null)

  const biggestWeek = [...byWeek].reduce<AllTimeView['biggestWeek']>(
    (best, [weekStart, weekKm]) => (!best || weekKm > best.km ? { km: weekKm, weekStart } : best),
    null,
  )

  const startMonth = since ? Number(since.slice(5, 7)) : 1
  const partialFirstYear =
    since && firstYear < currentYear && startMonth > 1
      ? { year: firstYear, startMonth, months: 13 - startMonth, currentMonths: Number(today.slice(5, 7)) }
      : null

  return {
    km: Math.round(km),
    runs: dated.length,
    hours: Math.round(seconds / 3600),
    since,
    months: monthly.length,
    years,
    partialFirstYear,
    monthly,
    bestMonth,
    longestRun: longestRun ? { km: Math.round(longestRun.km * 10) / 10, date: longestRun.date } : null,
    biggestWeek: biggestWeek ? { km: Math.round(biggestWeek.km), weekStart: biggestWeek.weekStart } : null,
    currentYear,
  }
}

export function getAllTime(today: string): AllTimeView {
  return allTimeView(getAllActivities(), today)
}
