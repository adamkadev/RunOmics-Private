export type WearStatus = 'ok' | 'watch' | 'replace'

export function wearStatus(pct: number): WearStatus {
  if (pct >= 90) return 'replace'
  if (pct >= 70) return 'watch'
  return 'ok'
}

export interface WearOutlook {
  status: WearStatus
  kmLeft: number
  weeksRemaining: number | null
}

export function wearOutlook(shoe: { totalKm: number; maxKm: number; wearPercent: number; kmPerWeek: number }): WearOutlook {
  const kmLeft = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))
  return {
    status: wearStatus(shoe.wearPercent),
    kmLeft,
    weeksRemaining: shoe.kmPerWeek > 0 ? Math.max(0, Math.round(kmLeft / shoe.kmPerWeek)) : null,
  }
}

/**
 * How many weeks a pair has been in rotation, from its first outing to its
 * most recent one (or to itself, for a pair worn exactly once). Shared by the
 * retired list row and the detail page so both count the same way.
 */
export function weeksInRotation(firstUsedDate: string | null, lastDate: string | null): number {
  if (!firstUsedDate) return 0
  const end = lastDate ?? firstUsedDate
  return Math.max(
    1,
    Math.round(
      (new Date(end + 'T00:00:00').getTime() - new Date(firstUsedDate + 'T00:00:00').getTime()) /
        (7 * 86_400_000)
    )
  )
}

/**
 * The weekly rate over a pair's working life: total km divided by the weeks
 * between its first and most recent outing. `GetShoeStats` and `GetShoeDetail`
 * both need it - one for the list row's subline, the other for the wear
 * projection sentence and stat row - so it lives here instead of twice.
 *
 * Anchored to the last activity, not to today: a retired pair stopped
 * accumulating weeks the day it was last worn, so dividing by weeks-to-now
 * would keep diluting its rate the longer ago it retired.
 */
export function kmPerWeek(firstUsedDate: string | null, lastUsedDate: string | null, totalKm: number): number {
  if (!firstUsedDate) return 0
  return totalKm / weeksInRotation(firstUsedDate, lastUsedDate)
}
