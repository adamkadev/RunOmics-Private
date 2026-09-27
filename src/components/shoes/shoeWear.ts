import { formatKm } from '@/lib/formatters'
import type { ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'

/**
 * What a pair has left, or how far past its limit it is. A pair at 1,375 of
 * 500 km read "0 km left", "1375 / 500 km" and "About 0 more weeks": the
 * overrun, which is the news, appeared nowhere, and the total had no
 * thousands separator where the rest of the app writes 1,247.
 */
export function shoeWearCopy(shoe: { totalKm: number; maxKm: number }): {
  over: boolean
  ratio: string
  /** "~120 km left", or "875 km over". */
  short: string
  /** "120 km left", or "875 km past its 500 km limit". */
  exact: string
} {
  const total = Math.round(shoe.totalKm)
  const limit = Math.round(shoe.maxKm)
  const over = limit > 0 && total > limit
  const left = formatKm(Math.max(0, limit - total))
  const overBy = formatKm(total - limit)

  return {
    over,
    ratio: t.shoes.kmOf(formatKm(total), formatKm(limit)),
    short: over ? t.shoes.kmOver(overBy) : t.shoes.kmLeft(left),
    exact: over ? t.shoes.pastLimit(overBy, formatKm(limit)) : t.shoes.kmLeftExact(left),
  }
}

/** Where a pair is in its life, for the bar's colour (C4, v4.4b). */
export type WearTone = 'ok' | 'near' | 'over'

/** The share of the limit where the bar turns amber, and where its tick sits. */
export const WEAR_NEAR_SHARE = 0.8

export function wearTone(shoe: { totalKm: number; maxKm: number }): WearTone {
  if (!(shoe.maxKm > 0)) return 'ok'
  const share = shoe.totalKm / shoe.maxKm
  return share > 1 ? 'over' : share >= WEAR_NEAR_SHARE ? 'near' : 'ok'
}

/**
 * Ink until the retire tick, amber past it (v5.5 #15): wear is data, so it
 * never takes the accent.
 */
export const WEAR_COLOR: Record<WearTone, string> = {
  ok: 'var(--foreground)',
  near: 'var(--tone-caution)',
  over: 'var(--tone-caution)',
}

/** A pair's role, from the session it is worn for most. */
export function shoeRole(type: ActivityType | null): string | null {
  if (!type) return null
  const r = t.shoes.roles
  if (type === 'Base') return r.daily
  if (type === 'Tempo' || type === 'Threshold') return r.workouts
  if (type === 'Race') return r.races
  return r.intervals
}

/** Pairs, limits and retirement are Garmin's: the list's Add and the detail's Edit open its gear page. */
export const GARMIN_GEAR_URL = 'https://connect.garmin.com/modern/gear'
