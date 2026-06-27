import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { trimp, type HrBounds } from './GetTrainingLoad'
import { round } from '@/lib/math'

export type WeekLoadLevel = 'low' | 'normal' | 'high'

export interface WeeklyLoadComparison {
  currentLoad: number
  typicalLoad: number
  percent: number
  level: WeekLoadLevel
  window: number
}

const BASELINE_WEEKS = 8

export function level(percent: number): WeekLoadLevel {
  if (percent < 70) return 'low'
  if (percent > 130) return 'high'
  return 'normal'
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

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)
  const currentWeek = sortedWeeks[sortedWeeks.length - 1]
  const baselineWeeks = sortedWeeks.slice(-(BASELINE_WEEKS + 1), -1)
  if (baselineWeeks.length < 3) return null

  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const weekTrimp = (w: number) => byWeek.get(w)!.reduce((s, a) => s + trimp(a, hrBounds), 0)

  const currentLoad = round(weekTrimp(currentWeek))
  const typicalLoad = round(baselineWeeks.reduce((s, w) => s + weekTrimp(w), 0) / baselineWeeks.length)
  if (typicalLoad <= 0) return null

  const percent = Math.round((currentLoad / typicalLoad) * 100)

  return { currentLoad, typicalLoad, percent, level: level(percent), window: baselineWeeks.length }
}
