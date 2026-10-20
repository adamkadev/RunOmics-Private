import { formatKm, formatMonthShortYear } from '@/lib/formatters'
import { addDays, isoDate } from '@/lib/calendarDate'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'
import { wearPercent, wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
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

/**
 * A pair's wear as its bar and tag draw it (v4.17), from the status its own
 * page reads: the accent while it has life in it - its km are the athlete's
 * own data - and amber once it is worn. Replace used to be neg, the app's
 * red, which is the tone of something gone wrong (App Fixes, review 7); a
 * pair at the end of its life is a warning, and the tag's own words -
 * "Replace soon" against "Replace" - say how far along it is.
 */
export const WEAR_COLOR: Record<WearStatus, string> = {
  ok: 'var(--accent)',
  watch: 'var(--warn)',
  replace: 'var(--warn)',
}

/** A pair's wear status from its km, as its page and the Progress card read it. */
export function shoeWearStatus(shoe: { totalKm: number; maxKm: number }): WearStatus {
  return wearStatus(wearPercent({ ...shoe, retired: false }))
}

/** Past its limit: the overrun is the news (C4, v4.4b). */
export function isPastLimit(shoe: { totalKm: number; maxKm: number }): boolean {
  return shoeWearCopy(shoe).over
}

/**
 * Where the bar's tick sits when a pair has no threshold of its own: 80% of
 * the limit, as the registry sets `alertThresholdKm` - past it, a pair is
 * kept for easy runs and retired from workouts.
 */
export const RETIRE_FROM_WORKOUTS_SHARE = 0.8

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
export const GARMIN_GEAR_URL = `${GARMIN_CONNECT_URL}/gear`

/** Past a year out, a projection is a handful of runs extrapolated into noise: no date. */
const FAR_OUT_WEEKS = 52

/**
 * When a pair reaches its limit at its rate, on one line (design review, Oct
 * 2026): "1,000 km ≈ Jan ’27 · 11 wk at 25 km/wk". None for a retired pair,
 * or one with no rate to project from.
 */
export function shoeProjection(
  shoe: { retired: boolean; kmPerWeek: number; maxKm: number },
  weeksRemaining: number | null,
  now = new Date(),
): string | null {
  if (shoe.retired || weeksRemaining === null || weeksRemaining <= 0) return null
  const d = t.shoes.detail
  if (weeksRemaining > FAR_OUT_WEEKS) return d.projectedRunOutFar(Math.round(shoe.kmPerWeek), formatKm(shoe.maxKm))
  const month = formatMonthShortYear(isoDate(addDays(now, weeksRemaining * 7)))
  return d.projectedRunOut(Math.round(shoe.kmPerWeek), formatKm(shoe.maxKm), month, weeksRemaining)
}
