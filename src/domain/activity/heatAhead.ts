import { median, round } from '@/lib/math'
import { medianStart } from '@/domain/explore/home'
import { isRunningActivity } from '@/domain/training/trainingHistory'
import type { Activity, ScheduledTimeOfDay } from './types'

export interface HourlyForecast {
  /** Local wall clock, `YYYY-MM-DDTHH:00`. */
  time: string
  tempC: number
  apparentTempC: number
}

const RECENT_RUNS = 20

/** The sync's buckets for Garmin's scheduled time (scripts/sync_workouts.py), with an hour for when no run fell in one. */
const PERIODS: Record<ScheduledTimeOfDay, { from: number; to: number; fallback: number }> = {
  Morning: { from: 5, to: 12, fallback: 8 },
  Afternoon: { from: 12, to: 17, fallback: 14 },
  Evening: { from: 17, to: 22, fallback: 19 },
  Night: { from: 22, to: 29, fallback: 22 },
}

function recentRuns(activities: readonly Activity[]): Activity[] {
  return activities
    .filter(isRunningActivity)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_RUNS)
}

function startHour(activity: Activity): number | null {
  const match = /T(\d{2}):(\d{2})/.exec(activity.startTimeLocal ?? '')
  return match ? Number(match[1]) + Number(match[2]) / 60 : null
}

/** A median of the recent starts, within the part of the day Garmin's calendar planned the run for when it names one. */
export function usualRunHour(activities: readonly Activity[], scheduled?: ScheduledTimeOfDay): number | null {
  const hours = recentRuns(activities).flatMap((run) => startHour(run) ?? [])
  const period = scheduled ? PERIODS[scheduled] : null
  // Night runs past midnight, so its early hours count as 24 and over.
  const within = period
    ? hours.map((h) => (h < period.from && period.to > 24 ? h + 24 : h)).filter((h) => h >= period.from && h < period.to)
    : hours
  if (within.length === 0) return period?.fallback ?? null
  return Math.round(median(within)) % 24
}

/** Rounded to 0.1° as the sync rounds a run's weather location, so the forecast and the heat cost share a grid. */
export function forecastPoint(activities: readonly Activity[]): { lat: number; lon: number } | null {
  const starts = recentRuns(activities).flatMap((run) => (run.route?.[0] ? [run.route[0]] : []))
  const start = medianStart(starts)
  return start ? { lat: round(start[1], 1), lon: round(start[0], 1) } : null
}

export function forecastAt(forecast: readonly HourlyForecast[], date: string, hour: number): HourlyForecast | null {
  const time = `${date}T${String(hour).padStart(2, '0')}:00`
  return forecast.find((entry) => entry.time === time) ?? null
}
