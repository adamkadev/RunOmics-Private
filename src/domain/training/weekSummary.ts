import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
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

/** Mirrors GetWeeklyLoadComparison's baseline logic, but for an arbitrary week (needed to browse past/future weeks client-side). */
export function compareWeekLoad(currentTrimp: number, priorWeeksTrimp: number[]): WeekLoadComparison | null {
  if (priorWeeksTrimp.length < 3) return null
  const typicalTrimp = priorWeeksTrimp.reduce((s, v) => s + v, 0) / priorWeeksTrimp.length
  if (typicalTrimp <= 0) return null
  const percent = Math.round((currentTrimp / typicalTrimp) * 100)
  return { percent, level: classifyWeekLoadLevel(percent) }
}

export interface PlannedWeek {
  total: number
  /** Planned sessions that are not easy base runs - what gives the week its intent. */
  key: number
}

/** What the plan holds for a week. Untyped planned sessions count in the total but never as key. */
export function summarizePlannedWeek(plannedTypes: (string | null | undefined)[]): PlannedWeek {
  const key = plannedTypes.filter((type) => !!type && !EASY_TYPES.includes(type as ActivityType)).length
  return { total: plannedTypes.length, key }
}

export interface WeekAdherence {
  /** Sessions planned across the whole week. */
  planned: number
  done: number
  percent: number
}

// Counted over the whole week rather than the elapsed days only: the athlete
// reads this against the plan they wrote, so on Tuesday of a five-session week
// "0/5" is the number they expect - a denominator that grew day by day showed
// "0/1" and read as a bug. Sessions still to come are simply not done yet.
export function computeWeekAdherence(
  days: { date: string; planned: boolean; completed: boolean }[],
): WeekAdherence | null {
  const planned = days.filter((d) => d.planned)
  if (planned.length === 0) return null
  const done = planned.filter((d) => d.completed).length
  return { planned: planned.length, done, percent: Math.round((done / planned.length) * 100) }
}
