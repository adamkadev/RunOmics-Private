import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import {
  getVo2maxSamples,
  type Vo2maxSample,
} from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { addDays, isoDate } from '@/lib/calendarDate'
import { AXIS_TICK_DATE, formatDate } from '@/lib/formatters'
import type { VO2maxRange } from '@/domain/training/vo2maxRanges'

export interface VO2maxPoint {
  date: string
  label: string
  value: number
}

export type { VO2maxRange }
export type VO2maxSeries = Record<VO2maxRange, VO2maxPoint[]>

const MONTHS_IN_RANGE: Record<Exclude<VO2maxRange, '4w'>, number> = { '6m': 6, '1y': 12 }
const RECENT_DAYS = 28

export function getLatestVO2max(): number | null {
  const profileVo2max = getAthleteProfile().vo2maxMlKgMin
  if (profileVo2max) return profileVo2max

  const activities = getAllActivities()
  const latest = activities.find((a) => a.vo2maxGarmin !== null && a.vo2maxGarmin !== undefined)
  return latest?.vo2maxGarmin ?? null
}

export function getVO2maxSeries(): VO2maxSeries {
  const { months, days } = getVo2maxSamples()

  return {
    '4w': recentPoints(days),
    '6m': monthlyPoints(months, MONTHS_IN_RANGE['6m']),
    '1y': monthlyPoints(months, MONTHS_IN_RANGE['1y']),
  }
}

export function getVO2maxHistory(range: VO2maxRange = '1y'): VO2maxPoint[] {
  return getVO2maxSeries()[range]
}

function monthlyPoints(months: Vo2maxSample[], count: number): VO2maxPoint[] {
  const source = months.length > 0 ? months : monthlyFromActivities()
  return source.slice(-count).map(({ date, vo2max }) => ({
    date,
    label: formatDate(date, { precision: 'month', year: 'always' }),
    value: vo2max,
  }))
}

function recentPoints(days: Vo2maxSample[]): VO2maxPoint[] {
  const source = days.length > 0 ? days : dailyFromActivities()
  const latest = source[source.length - 1]
  if (!latest) return []

  const from = isoDate(addDays(new Date(latest.date + 'T00:00:00'), -RECENT_DAYS))
  return source
    .filter((s) => s.date >= from)
    .map(({ date, vo2max }) => ({
      date,
      label: formatDate(date, AXIS_TICK_DATE),
      value: vo2max,
    }))
}

function dailyFromActivities(): Vo2maxSample[] {
  const byDay = new Map<string, Vo2maxSample>()
  for (const a of getAllActivities()) {
    if (a.vo2maxGarmin === null || a.vo2maxGarmin === undefined) continue
    byDay.set(a.date, { date: a.date, vo2max: a.vo2maxGarmin })
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function monthlyFromActivities(): Vo2maxSample[] {
  const byMonth = new Map<string, Vo2maxSample>()
  for (const sample of dailyFromActivities()) {
    byMonth.set(sample.date.slice(0, 7), sample)
  }
  return [...byMonth.values()]
}

export function getVO2maxReadings(): { value: number | null; samples: Vo2maxSample[] } {
  const { days } = getVo2maxSamples()
  return { value: getLatestVO2max(), samples: days.length > 0 ? days : dailyFromActivities() }
}
