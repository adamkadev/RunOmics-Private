import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { isoDate, startOfWeek } from '@/lib/calendarDate'

export interface AllTimeYear {
  year: number
  km: number
  runs: number
  hours: number
  /** The year's months from the first run on, this one included: 8 for a first year from May. */
  months: number
  /** Km a month over those months, which compares a partial first year fairly. */
  kmPerMonth: number
}

export interface AllTimeMonth {
  /** YYYY-MM */
  key: string
  year: number
  km: number
  /** The month still running. */
  partial: boolean
  /** The month still running at its pace so far, never under its km; null for a month done. */
  projectedKm: number | null
}

export interface AllTimeView {
  km: number
  runs: number
  hours: number
  since: string | null
  /** Months from the first run's month to this one, both counted. */
  months: number
  /** Oldest first. */
  years: AllTimeYear[]
  monthly: AllTimeMonth[]
  bestMonth: AllTimeMonth | null
  longestRun: { km: number; date: string; activityId: string | null } | null
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

export function allTimeView(
  activities: (Pick<Activity, 'date' | 'distanceKm' | 'durationSeconds'> & { id?: string })[],
  today: string,
): AllTimeView {
  const currentYear = Number(today.slice(0, 4))
  const dated = activities.filter((a) => a.date).map((a) => ({ ...a, date: a.date.slice(0, 10) }))
  const since = dated.reduce<string | null>((min, a) => (!min || a.date < min ? a.date : min), null)

  const km = dated.reduce((sum, a) => sum + a.distanceKm, 0)
  const seconds = dated.reduce((sum, a) => sum + a.durationSeconds, 0)

  const byYear = new Map<number, { km: number; runs: number; hours: number }>()
  const byMonth = new Map<string, number>()
  const byWeek = new Map<string, number>()
  let longestRun: AllTimeView['longestRun'] = null
  for (const a of dated) {
    const year = Number(a.date.slice(0, 4))
    const entry = byYear.get(year) ?? { km: 0, runs: 0, hours: 0 }
    entry.km += a.distanceKm
    entry.runs += 1
    entry.hours += a.durationSeconds / 3600
    byYear.set(year, entry)
    byMonth.set(monthKey(a.date), (byMonth.get(monthKey(a.date)) ?? 0) + a.distanceKm)
    const week = isoDate(startOfWeek(new Date(`${a.date}T12:00:00`)))
    byWeek.set(week, (byWeek.get(week) ?? 0) + a.distanceKm)
    if (!longestRun || a.distanceKm > longestRun.km) longestRun = { km: a.distanceKm, date: a.date, activityId: a.id ?? null }
  }

  const currentKey = monthKey(today)
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = new Date(Date.UTC(currentYear, Number(today.slice(5, 7)), 0)).getUTCDate()
  const monthly = since
    ? monthsBetween(monthKey(since), currentKey).map((key) => {
        const monthKm = byMonth.get(key) ?? 0
        const partial = key === currentKey
        return {
          key,
          year: Number(key.slice(0, 4)),
          km: Math.round(monthKm),
          partial,
          projectedKm: partial ? Math.max(Math.round(monthKm), Math.round((monthKm / dayOfMonth) * daysInMonth)) : null,
        }
      })
    : []

  const firstYear = since ? Number(since.slice(0, 4)) : currentYear
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => firstYear + i).map((year) => {
    const entry = byYear.get(year)
    const months = monthly.filter((m) => m.year === year).length
    return {
      year,
      km: Math.round(entry?.km ?? 0),
      runs: entry?.runs ?? 0,
      hours: Math.round(entry?.hours ?? 0),
      months,
      kmPerMonth: months > 0 ? Math.round((entry?.km ?? 0) / months) : 0,
    }
  })
  const bestMonth = monthly.reduce<AllTimeMonth | null>((best, m) => (!best || m.km > best.km ? m : best), null)

  const biggestWeek = [...byWeek].reduce<AllTimeView['biggestWeek']>(
    (best, [weekStart, weekKm]) => (!best || weekKm > best.km ? { km: weekKm, weekStart } : best),
    null,
  )

  return {
    km: Math.round(km),
    runs: dated.length,
    hours: Math.round(seconds / 3600),
    since,
    months: monthly.length,
    years,
    monthly,
    bestMonth,
    longestRun: longestRun ? { ...longestRun, km: Math.round(longestRun.km * 10) / 10 } : null,
    biggestWeek: biggestWeek ? { km: Math.round(biggestWeek.km), weekStart: biggestWeek.weekStart } : null,
    currentYear,
  }
}

export function getAllTime(today: string): AllTimeView {
  return allTimeView(getAllActivities(), today)
}
