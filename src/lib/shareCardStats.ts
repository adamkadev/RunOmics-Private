import type { Activity, ActivityType } from '@/domain/activity/types'
import { formatClock, formatDate, formatDuration, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { activityTitle } from '@/lib/activityTitle'

/** What a share card reads of a run - all the share modal is handed. */
export type ShareActivity = Pick<
  Activity,
  | 'id' | 'date' | 'dayOfWeek' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm'
  | 'avgHeartRate' | 'elevationGain' | 'route' | 'hrZones'
> & {
  type?: ActivityType
  /** The coach's name for the session this run matched, written to its naming rules. */
  sessionTitle?: string | null
  /** The work of an interval session: its reps and their pace, against the plan's. */
  reps?: ShareReps | null
}

export interface ShareReps {
  count: number
  /** One rep's length, in seconds. */
  repSeconds: number
  /** The work laps only: their time over their distance. */
  paceSecPerKm: number
  /** The plan's pace for the reps, when the run matched a session that set one. */
  target: { min: number; max: number } | null
  /** Where each rep ran, as shares of the run's distance (0 to 1): the route draws them. */
  windows: [number, number][]
}

/** The coach's session name when the run matched one (design review, Oct 2026), else the run's own. */
export function shareCardTitle(activity: ShareActivity): string {
  return activity.sessionTitle?.trim() || activityTitle(activity)
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

/**
 * The stat row: Distance, Pace, Avg HR, Time - the ones the run has. An
 * interval session drops the average pace (design review, Oct 2026): over
 * reps and recoveries it describes neither, and the rep pace leads instead.
 */
export function shareStats(activity: ShareActivity): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = [
    { value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
  ]
  if (!activity.reps && activity.paceSecPerKm && activity.paceSecPerKm > 0) {
    stats.push({ value: formatClock(activity.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.pace })
  }
  if (activity.reps) stats.push({ value: formatDuration(Math.round(activity.durationSeconds)), unit: '', label: s.time })
  if (activity.avgHeartRate) {
    stats.push({ value: String(Math.round(activity.avgHeartRate)), unit: ` ${t.units.bpm}`, label: s.avgHr })
  }
  if (!activity.reps) stats.push({ value: formatDuration(Math.round(activity.durationSeconds)), unit: '', label: s.time })
  return stats
}

/** "8′" for a rep in whole minutes, "45″" for one under a minute. */
export function repLength(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)}′` : `${Math.round(seconds)}″`
}

export interface ShareRepHero {
  /** "REP PACE · 3 × 8′" */
  eyebrow: string
  pace: string
  /** "/km · target 4:25", or just "/km" with no target. */
  detail: string
}

/** The interval session's headline: the reps' own pace, and the plan's beside it. */
export function shareRepHero(activity: ShareActivity): ShareRepHero | null {
  const reps = activity.reps
  if (!reps) return null
  const s = t.activity.shareCard
  const target = reps.target
    ? reps.target.min === reps.target.max
      ? formatClock(reps.target.min)
      : `${formatClock(reps.target.min)}–${formatClock(reps.target.max)}`
    : null
  return {
    eyebrow: s.repPace(reps.count, repLength(reps.repSeconds)),
    pace: formatClock(reps.paceSecPerKm),
    detail: target ? `${t.units.perKm} · ${s.target(target)}` : t.units.perKm,
  }
}

export interface ShareZoneRow {
  zone: number
  seconds: number
  /** The run's share of time in this zone, 0 to 1: the bar is the percentage. */
  share: number
}

export interface ShareZones {
  /** Only the zones the run spent time in, Z1 first. */
  rows: ShareZoneRow[]
  /** The headline: the share of time in the zones this kind of run is about. */
  headline: { percent: number; label: string }
  totalSeconds: number
}

/**
 * The zones a run's kind is about (design review, Oct 2026): an easy or long
 * run is judged on Z1-Z2, a threshold session on Z4, a tempo on Z3, a VO₂ or
 * faster session on Z5. A race, or a run of no known kind, on its main zone.
 */
function headlineZones(type: ActivityType | undefined): number[] | null {
  switch (type) {
    case 'Base':
      return [1, 2]
    case 'Tempo':
      return [3]
    case 'Threshold':
      return [4]
    case 'VO2Max':
    case 'Anaerobic':
    case 'Sprint':
      return [5]
    default:
      return null
  }
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

  const s = t.activity.shareCard
  const rows = seconds
    .map((sec, i) => ({ zone: i + 1, seconds: sec, share: sec / total }))
    // Under a minute reads as nothing at all, not a sliver of a bar.
    .filter((row) => row.seconds >= 60)
  const zones = headlineZones(activity.type)
  if (zones) {
    const share = zones.reduce((sum, z) => sum + (seconds[z - 1] ?? 0), 0) / total
    const label = zones.length > 1 ? s.easyZones(zones[0]!, zones[zones.length - 1]!) : s.inZone(zones[0]!)
    return { rows, headline: { percent: Math.round(share * 100), label }, totalSeconds: total }
  }
  const longest = Math.max(...seconds)
  return { rows, headline: { percent: Math.round((longest / total) * 100), label: s.inZone(seconds.indexOf(longest) + 1) }, totalSeconds: total }
}
