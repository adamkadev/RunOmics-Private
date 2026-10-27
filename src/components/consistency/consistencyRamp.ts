import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'

export type DayLevel = 0 | 1 | 2 | 3

export const LEVEL_KM = { mid: 8, long: 15 } as const

export function dayLevel(day: Pick<HeatmapDay, 'distanceKm' | 'sessionCount'> | undefined): DayLevel {
  if (!day || day.sessionCount === 0) return 0
  return day.distanceKm >= LEVEL_KM.long ? 3 : day.distanceKm >= LEVEL_KM.mid ? 2 : 1
}

/** This month and the eleven before. */
const YEAR_MONTHS = 12

/** Days run in the twelve calendar months up to today. */
export function activeDaysInYear(days: readonly HeatmapDay[], today: string): number {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(year, month - YEAR_MONTHS, 1)).toISOString().slice(0, 10)
  return days.filter((day) => day.date >= start && day.date <= today && day.sessionCount > 0).length
}
