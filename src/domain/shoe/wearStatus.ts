import { weekStartOf } from '@/domain/activity/weekGroups'
import { DAY_MS } from '@/lib/calendarDate'
import { round } from '@/lib/math'

export type WearStatus = 'ok' | 'watch' | 'replace'

/** 0-100. A shoe with no lifespan set cannot be measured, so it reads as unworn. */
export function wearPercent(shoe: { totalKm: number; maxKm: number; retired: boolean }): number {
  if (shoe.retired) return 100
  if (!(shoe.maxKm > 0)) return 0
  return Math.min(100, round((shoe.totalKm / shoe.maxKm) * 100, 0))
}

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

export function weeksInRotation(firstUsedDate: string | null, lastDate: string | null): number {
  if (!firstUsedDate) return 0
  const end = lastDate ?? firstUsedDate
  return Math.max(
    1,
    Math.round(
      (new Date(end + 'T00:00:00').getTime() - new Date(firstUsedDate + 'T00:00:00').getTime()) /
        (7 * DAY_MS)
    )
  )
}

/** Weeks with a run: a long pause would otherwise stretch the forecast past a year. */
const RECENT_WEEKS = 8

export function recentKmPerWeek(runs: readonly { date: string; distanceKm: number }[], weeks = RECENT_WEEKS): number {
  const byWeek = new Map<string, number>()
  for (const run of runs) {
    const key = weekStartOf(run.date.slice(0, 10))
    byWeek.set(key, (byWeek.get(key) ?? 0) + run.distanceKm)
  }
  const recent = [...byWeek].sort(([a], [b]) => b.localeCompare(a)).slice(0, weeks)
  return recent.length === 0 ? 0 : recent.reduce((sum, [, km]) => sum + km, 0) / recent.length
}
