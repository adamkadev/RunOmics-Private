import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { trimp, type HrBounds } from './trimp'
import { easyHardShare } from './easyHard'

const EASY_TYPES: ActivityType[] = ['Base']

export interface WeekSummary {
  totalTrimp: number
  elevationGainM: number
  keySessionsCount: number
  easyPct: number | null
  hardPct: number | null
}

export function summarizeWeek(activities: ActivitySummary[], hrBounds?: HrBounds): WeekSummary {
  const totalTrimp = Math.round(activities.reduce((s, a) => s + trimp(a, hrBounds), 0))
  const elevationGainM = Math.round(activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0))
  const keySessionsCount = activities.filter((a) => !EASY_TYPES.includes(a.type)).length
  const { easyPct, hardPct } = easyHardShare(activities)
  return { totalTrimp, elevationGainM, keySessionsCount, easyPct, hardPct }
}

export function weeklyTrimpTotals(weekNumbers: number[], byWeek: Map<number, ActivitySummary[]>, hrBounds?: HrBounds): number[] {
  return weekNumbers.map((week) => Math.round((byWeek.get(week) ?? []).reduce((s, a) => s + trimp(a, hrBounds), 0)))
}

export type WeekLoadLevel = 'low' | 'normal' | 'high'

export function classifyWeekLoadLevel(percent: number): WeekLoadLevel {
  if (percent < 70) return 'low'
  if (percent > 130) return 'high'
  return 'normal'
}

export interface WeekLoadComparison {
  percent: number
  level: WeekLoadLevel
}

export function compareWeekLoad(currentTrimp: number, priorWeeksTrimp: number[]): WeekLoadComparison | null {
  if (priorWeeksTrimp.length < 3) return null
  const typicalTrimp = priorWeeksTrimp.reduce((s, v) => s + v, 0) / priorWeeksTrimp.length
  if (typicalTrimp <= 0) return null
  const percent = Math.round((currentTrimp / typicalTrimp) * 100)
  return { percent, level: classifyWeekLoadLevel(percent) }
}

export interface PlannedWeek {
  total: number
  key: number
  /** Sum of per-workout TRIMP estimates - the same scale summarizeWeek reports. */
  estimatedLoad: number
}

export function summarizePlannedWeek(planned: PlannedWorkout[]): PlannedWeek {
  const key = planned.filter((w) => !!w.type && !EASY_TYPES.includes(w.type)).length
  const estimatedLoad = Math.round(planned.reduce((sum, w) => sum + (w.estimatedLoad ?? 0), 0))
  return { total: planned.length, key, estimatedLoad }
}

export interface WeekAdherence {
  planned: number
  done: number
  percent: number
}

export function computeWeekAdherence(
  days: { date: string; planned: boolean; completed: boolean }[],
): WeekAdherence | null {
  const planned = days.filter((d) => d.planned)
  if (planned.length === 0) return null
  const done = planned.filter((d) => d.completed).length
  return { planned: planned.length, done, percent: Math.round((done / planned.length) * 100) }
}
