import type { Activity } from '@/domain/activity/types'
import { formatClock, formatDate, formatDuration, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'

/** What a share card reads of a run - all the share modal is handed. */
export type ShareActivity = Pick<
  Activity,
  | 'id' | 'date' | 'dayOfWeek' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm'
  | 'avgHeartRate' | 'elevationGain' | 'route' | 'paceSamples' | 'hrZones'
>

export function shareCardTitle(activity: ShareActivity): string {
  return activity.description || t.activity.runTitle(activity.dayOfWeek)
}

/** "Sat, Sep 26 · Hoenheim": the app's date, then the town when it is known. */
export function shareCardSubtitle(activity: ShareActivity, place: string | null | undefined): string {
  const date = formatDate(activity.date.slice(0, 10))
  return place ? `${date} · ${place}` : date
}

export interface ShareStat {
  value: string
  unit: string
  label: string
}

/** The stat row: Distance, Pace, Avg HR, Time - the ones the run has. */
export function shareStats(activity: ShareActivity): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = [
    { value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
  ]
  if (activity.paceSecPerKm && activity.paceSecPerKm > 0) {
    stats.push({ value: formatClock(activity.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.pace })
  }
  if (activity.avgHeartRate) {
    stats.push({ value: String(Math.round(activity.avgHeartRate)), unit: ` ${t.units.bpm}`, label: s.avgHr })
  }
  stats.push({ value: formatDuration(Math.round(activity.durationSeconds)), unit: '', label: s.time })
  return stats
}

export interface ShareZoneRow {
  zone: number
  seconds: number
  /** The bar's length against the longest zone, 0 to 1. */
  fill: number
}

export interface ShareZones {
  rows: ShareZoneRow[]
  /** The zone the run spent most time in, and its share of the whole. */
  top: { zone: number; percent: number }
}

/**
 * Z1 to Z5 from the run's own zone times - the Overview's Time in zones -
 * or null when the run has no heart rate to split.
 */
export function shareZones(activity: ShareActivity): ShareZones | null {
  const seconds = [1, 2, 3, 4, 5].map((zone) =>
    activity.hrZones.filter((z) => z.zone === zone).reduce((sum, z) => sum + z.seconds, 0))
  const total = seconds.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const longest = Math.max(...seconds)
  const topIndex = seconds.indexOf(longest)
  return {
    rows: seconds.map((s, i) => ({ zone: i + 1, seconds: s, fill: s / longest })),
    top: { zone: topIndex + 1, percent: Math.round((longest / total) * 100) },
  }
}
