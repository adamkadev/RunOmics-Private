import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { DAY_MS } from '@/lib/calendarDate'
import { dailyTrimpByDate } from './GetTrainingLoad'
import { getTrainingStatus } from './GetTrainingStatus'
import { getLoadPairs } from './GetLoadRecovery'
import { latestLoadPair, safeRange } from '@/domain/training/loadTrend'

export const RECENT_LOAD_DAYS = 7

/** Where a day's load sits while the week holds its load steady: ACWR's safe range, against fitness. */
export const LOAD_BAND = { lo: 0.8, hi: 1.3 } as const

export interface RecentLoadDay {
  date: string
  load: number
  isToday: boolean
  /** The day's run, by its longest, for the bar's colour; null on a day without one. */
  type: ActivityType | null
}

/**
 * The seven-day load against the range the watch calls safe: the very pair
 * Analytics' Load card reads (`getLoadPairs`), so Today and Analytics can no
 * longer print different numbers for the same thing (App Fixes 1a). Null
 * where the watch has no acute/chronic pair; the strip then says nothing
 * about a range it cannot source.
 */
export interface LoadReading {
  acute: number
  lo: number
  hi: number
  state: 'below' | 'in' | 'above'
}

export interface RecentLoad {
  days: RecentLoadDay[]
  band: { lo: number; hi: number }
  /** The tallest bar the strip has to draw: its own days, or the top of the band. */
  peak: number
  reading: LoadReading | null
}

export function loadReading(pairs: ReturnType<typeof getLoadPairs>): LoadReading | null {
  const pair = latestLoadPair(pairs)
  if (!pair) return null
  const { lo, hi } = safeRange(pair.chronic)
  return { acute: pair.acute, lo, hi, state: pair.acute < lo ? 'below' : pair.acute > hi ? 'above' : 'in' }
}

function lastDays(today: string, count: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`)
  const days: string[] = []
  for (let i = count - 1; i >= 0; i--) days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10))
  return days
}

/** Each day's longest run's type: the session the day was, as Plan colours it. */
export function dayTypes(activities: readonly Pick<Activity, 'date' | 'type' | 'durationSeconds'>[]): Map<string, ActivityType> {
  const longest = new Map<string, { type: ActivityType; seconds: number }>()
  for (const a of activities) {
    const held = longest.get(a.date)
    if (!held || a.durationSeconds > held.seconds) longest.set(a.date, { type: a.type, seconds: a.durationSeconds })
  }
  return new Map([...longest].map(([date, { type }]) => [date, type]))
}

export async function getRecentLoad(today: string): Promise<RecentLoad | null> {
  const activities = getAllActivities()
  if (!activities.length) return null

  const status = await getTrainingStatus()
  if (!status || status.ctl <= 0) return null

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds = {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }
  const byDate = dailyTrimpByDate(activities, hrBounds)
  const types = dayTypes(activities)

  const days = lastDays(today, RECENT_LOAD_DAYS).map((date) => ({
    date,
    load: Math.round(byDate.get(date) ?? 0),
    isToday: date === today,
    type: types.get(date) ?? null,
  }))
  const band = { lo: Math.round(status.ctl * LOAD_BAND.lo), hi: Math.round(status.ctl * LOAD_BAND.hi) }

  return { days, band, peak: Math.max(band.hi, ...days.map((day) => day.load)), reading: loadReading(getLoadPairs()) }
}
