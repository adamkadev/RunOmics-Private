import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { DAY_MS } from '@/lib/calendarDate'
import { dailyTrimpByDate } from './GetTrainingLoad'
import type { TrainingStatus } from './GetTrainingStatus'
import { getLoadPairs } from './GetLoadRecovery'
import { latestLoadPair, loadRatio, safeRange } from '@/domain/training/loadTrend'

export const RECENT_LOAD_DAYS = 7

/** ACWR's safe range, as a share of fitness (chronic load). */
export const LOAD_BAND = { lo: 0.8, hi: 1.3 } as const

export interface RecentLoadDay {
  date: string
  load: number
  isToday: boolean
  /** The type of the day's longest run. */
  type: ActivityType | null
}

/**
 * The seven-day load against the watch's safe range, from the same pair
 * Analytics' Load card reads (`getLoadPairs`).
 */
export interface LoadReading {
  acute: number
  lo: number
  hi: number
  state: 'below' | 'in' | 'above'
  ratio: number
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
  return {
    acute: pair.acute,
    lo,
    hi,
    state: pair.acute < lo ? 'below' : pair.acute > hi ? 'above' : 'in',
    ratio: loadRatio(pair),
  }
}

function lastDays(today: string, count: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`)
  const days: string[] = []
  for (let i = count - 1; i >= 0; i--) days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10))
  return days
}

export function dayTypes(activities: readonly Pick<Activity, 'date' | 'type' | 'durationSeconds'>[]): Map<string, ActivityType> {
  const longest = new Map<string, { type: ActivityType; seconds: number }>()
  for (const a of activities) {
    const held = longest.get(a.date)
    if (!held || a.durationSeconds > held.seconds) longest.set(a.date, { type: a.type, seconds: a.durationSeconds })
  }
  return new Map([...longest].map(([date, { type }]) => [date, type]))
}

export function getRecentLoad(today: string, status: TrainingStatus | null): RecentLoad | null {
  const activities = getAllActivities()
  if (!activities.length) return null

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
