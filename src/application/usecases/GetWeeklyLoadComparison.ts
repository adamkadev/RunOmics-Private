import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { trimp, type HrBounds } from './GetTrainingLoad'
import { isoWeekNumber, startOfWeek, isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

export type WeekLoadLevel = 'low' | 'normal' | 'high' | 'in-progress'

export interface WeeklyLoadComparison {
  currentLoad: number
  typicalLoad: number
  percent: number
  level: WeekLoadLevel
  window: number
}

const BASELINE_WEEKS = 8
// Below this many elapsed days, comparing to 8 full baseline weeks is
// mechanically biased toward "light" — report a neutral in-progress state.
const MIN_DAYS_ELAPSED_FOR_COMPARISON = 4

export function level(percent: number): WeekLoadLevel {
  if (percent < 70) return 'low'
  if (percent > 130) return 'high'
  return 'normal'
}

export function daysElapsedInWeek(now: Date): number {
  const midnightToday = new Date(isoDate(now) + 'T00:00:00')
  const monday = startOfWeek(midnightToday)
  return Math.round((midnightToday.getTime() - monday.getTime()) / 86_400_000) + 1
}

export async function getWeeklyLoadComparison(): Promise<WeeklyLoadComparison | null> {
  const activities = getAllActivities()
  if (!activities.length) return null

  const byWeek = new Map<number, Activity[]>()
  for (const a of activities) {
    const list = byWeek.get(a.week) ?? []
    list.push(a)
    byWeek.set(a.week, list)
  }

  const currentWeekNum = isoWeekNumber(new Date())
  if (!byWeek.has(currentWeekNum)) byWeek.set(currentWeekNum, [])

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)
  const baselineWeeks = sortedWeeks.filter((w) => w !== currentWeekNum).slice(-BASELINE_WEEKS)
  if (baselineWeeks.length < 3) return null

  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const weekTrimp = (w: number) => (byWeek.get(w) ?? []).reduce((s, a) => s + trimp(a, hrBounds), 0)

  const currentLoad = round(weekTrimp(currentWeekNum))
  const typicalLoad = round(baselineWeeks.reduce((s, w) => s + weekTrimp(w), 0) / baselineWeeks.length)
  if (typicalLoad <= 0) return null

  const percent = Math.round((currentLoad / typicalLoad) * 100)
  const resolvedLevel =
    daysElapsedInWeek(new Date()) < MIN_DAYS_ELAPSED_FOR_COMPARISON ? 'in-progress' : level(percent)

  return { currentLoad, typicalLoad, percent, level: resolvedLevel, window: baselineWeeks.length }
}
