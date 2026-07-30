export type WearStatus = 'ok' | 'watch' | 'replace'

export function wearStatus(pct: number): WearStatus {
  if (pct >= 90) return 'replace'
  if (pct >= 70) return 'watch'
  return 'ok'
}

export interface WearOutlook {
  status: WearStatus
  kmLeft: number
  /** How long the remaining kilometres last at the recent rate, or null with no rate to project from. */
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
