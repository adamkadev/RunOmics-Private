import type { CSSProperties } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'

export type DayLevel = 0 | 1 | 2 | 3

export const LEVEL_KM = { mid: 8, long: 15 } as const

export function dayLevel(day: Pick<HeatmapDay, 'distanceKm' | 'sessionCount'> | undefined): DayLevel {
  if (!day || day.sessionCount === 0) return 0
  return day.distanceKm >= LEVEL_KM.long ? 3 : day.distanceKm >= LEVEL_KM.mid ? 2 : 1
}

/** Mixed towards the text ink, so a long day stands out from the accent in both themes and for every accent. */
export const ACCENT_LIFT = 'color-mix(in oklab, var(--accent) 70%, var(--foreground))'

/** A day run is the athlete's own data, so the ramp is the accent. */
export const LEVEL_FILL: Record<DayLevel, string> = {
  0: 'var(--level-rest)',
  1: 'color-mix(in srgb, var(--accent) var(--level-low), transparent)',
  2: 'color-mix(in srgb, var(--accent) var(--level-mid), transparent)',
  3: ACCENT_LIFT,
}

export const TODAY_OUTLINE: CSSProperties = { outline: '1.5px solid var(--accent)', outlineOffset: 1 }
/** The dashed border sits inside the cell, so it keeps the cell's size. */
export const FUTURE_OUTLINE: CSSProperties = { border: '1px dashed var(--line-2)', boxSizing: 'border-box', background: 'transparent' }

export function levelStyle(level: DayLevel, { today = false, future = false }: { today?: boolean; future?: boolean } = {}): CSSProperties {
  if (future) return FUTURE_OUTLINE
  return { background: LEVEL_FILL[level], ...(today ? TODAY_OUTLINE : {}) }
}

/** This month and the eleven before. */
const YEAR_MONTHS = 12

/** Days run in the twelve calendar months up to today. */
export function activeDaysInYear(days: readonly HeatmapDay[], today: string): number {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(year, month - YEAR_MONTHS, 1)).toISOString().slice(0, 10)
  return days.filter((day) => day.date >= start && day.date <= today && day.sessionCount > 0).length
}
