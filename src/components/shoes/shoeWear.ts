import { formatKm, formatMonthShortYear } from '@/lib/formatters'
import { addDays, isoDate } from '@/lib/calendarDate'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'
import { wearPercent, wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
import type { ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'

export function shoeWearCopy(shoe: { totalKm: number; maxKm: number }): {
  over: boolean
  ratio: string
  short: string
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

/** Replace is a warning, not the app's red for something gone wrong; the tag's words say how far along it is. */
export const WEAR_COLOR: Record<WearStatus, string> = {
  ok: 'var(--accent)',
  watch: 'var(--warn)',
  replace: 'var(--warn)',
}

export function shoeWearStatus(shoe: { totalKm: number; maxKm: number }): WearStatus {
  return wearStatus(wearPercent({ ...shoe, retired: false }))
}

export function isPastLimit(shoe: { totalKm: number; maxKm: number }): boolean {
  return shoeWearCopy(shoe).over
}

/** Matches the registry's default `alertThresholdKm`: past it, a pair is kept for easy runs. */
export const RETIRE_FROM_WORKOUTS_SHARE = 0.8

export function shoeRole(type: ActivityType | null): string | null {
  if (!type) return null
  const r = t.shoes.roles
  if (type === 'Base') return r.daily
  if (type === 'Tempo' || type === 'Threshold') return r.workouts
  if (type === 'Race') return r.races
  return r.intervals
}

/** Pairs, limits and retirement are edited in Garmin, not here. */
export const GARMIN_GEAR_URL = `${GARMIN_CONNECT_URL}/gear`

/** Past a year out a projection is noise, so it gets no date. */
const FAR_OUT_WEEKS = 52

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
