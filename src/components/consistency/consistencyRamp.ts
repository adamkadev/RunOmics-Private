import type { CSSProperties } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'

/**
 * A day's distance as a step of the accent ramp (v4.17): rest, under 8 km,
 * 8 to 15 km, and a long day of 15 km and more. The Progress hub's twelve
 * weeks are drawn on it.
 */
export type DayLevel = 0 | 1 | 2 | 3

/** Where the ramp steps up: 8 km, and 15 km for a long day. */
export const LEVEL_KM = { mid: 8, long: 15 } as const

export function dayLevel(day: Pick<HeatmapDay, 'distanceKm' | 'sessionCount'> | undefined): DayLevel {
  if (!day || day.sessionCount === 0) return 0
  return day.distanceKm >= LEVEL_KM.long ? 3 : day.distanceKm >= LEVEL_KM.mid ? 2 : 1
}

/**
 * The accent lifted towards the text ink (3.0): lighter in dark, deeper in
 * light, so it stands out from the accent itself in both themes and for
 * every accent. A long day.
 */
export const ACCENT_LIFT = 'color-mix(in oklab, var(--accent) 70%, var(--foreground))'

/**
 * The one consistency ramp (v4.17.1, 3.0): a day run is the athlete's own
 * data, so it is the accent - 35% and 65% in dark, 40% and 70% in light, on
 * the rest fill - and a long day the lifted accent.
 */
export const LEVEL_FILL: Record<DayLevel, string> = {
  0: 'var(--level-rest)',
  1: 'color-mix(in srgb, var(--accent) var(--level-low), transparent)',
  2: 'color-mix(in srgb, var(--accent) var(--level-mid), transparent)',
  3: ACCENT_LIFT,
}

/** Today, outlined in the accent a pixel off its cell. */
export const TODAY_OUTLINE: CSSProperties = { outline: '1.5px solid var(--accent)', outlineOffset: 1 }
/** A day still to come: a dashed border inside the cell, so it keeps the cell's size. */
export const FUTURE_OUTLINE: CSSProperties = { border: '1px dashed var(--line-2)', boxSizing: 'border-box', background: 'transparent' }

/** A cell's fill, outline included. */
export function levelStyle(level: DayLevel, { today = false, future = false }: { today?: boolean; future?: boolean } = {}): CSSProperties {
  if (future) return FUTURE_OUTLINE
  return { background: LEVEL_FILL[level], ...(today ? TODAY_OUTLINE : {}) }
}

/** The rolling year's months: this one and the eleven before. */
const YEAR_MONTHS = 12

/**
 * The days run in the twelve calendar months to this one (v5.5 #9), up to
 * today: the Progress hub's "active days in 12 months".
 */
export function activeDaysInYear(days: readonly HeatmapDay[], today: string): number {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(year, month - YEAR_MONTHS, 1)).toISOString().slice(0, 10)
  return days.filter((day) => day.date >= start && day.date <= today && day.sessionCount > 0).length
}
