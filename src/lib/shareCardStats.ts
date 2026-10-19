import type { Activity, ActivityType } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
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
  /** The run's verdict, as its Overview card reads it; null without a written one. */
  verdict?: ShareVerdict | null
}

/** The Stats card's lead (redesign, Oct 2026): the verdict's tone for the eyebrow, the coach's headline as the hero. */
export interface ShareVerdict {
  tone: VerdictTone
  headline: string
}

export interface ShareReps {
  count: number
  /** One rep's length, in seconds. */
  repSeconds: number
  /** The work laps only: their time over their distance. */
  paceSecPerKm: number
  /** The plan's pace for the reps, when the run matched a session that set one. */
  target: { min: number; max: number } | null
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
 * The stat row: Distance, Time, Pace, Avg HR - the ones the run has, in the
 * activity page's order (design review, Oct 2026: one order everywhere). An
 * interval session drops the average pace: over reps and recoveries it
 * describes neither, and the rep pace leads instead.
 */
export function shareStats(activity: ShareActivity): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = [
    { value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
    { value: formatDuration(Math.round(activity.durationSeconds)), unit: '', label: s.time },
  ]
  if (!activity.reps && activity.paceSecPerKm && activity.paceSecPerKm > 0) {
    stats.push({ value: formatClock(activity.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.pace })
  }
  if (activity.avgHeartRate) {
    stats.push({ value: String(Math.round(activity.avgHeartRate)), unit: ` ${t.units.bpm}`, label: s.avgHr })
  }
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
  /** The run's whole percent in this zone: the zones shown always sum to 100. */
  percent: number
}

export interface ShareZones {
  /** The zones with a percent to show, Z1 first. */
  rows: ShareZoneRow[]
  /** The headline: the share of time in the zones this kind of run is about, summed from the rows' own percents. */
  headline: { percent: number; label: string }
}

/**
 * Whole percents that sum to exactly 100 (largest remainder): each value
 * floored, then the points left go to the largest remainders. Rounding each
 * on its own read 10 + 77 + 10 + 4 = 101% (design review, Oct 2026).
 */
export function percentsTo100(values: readonly number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map((v) => (v / total) * 100)
  const floors = exact.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((v, i) => ({ i, rest: v - floors[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i]! += 1
    left--
  }
  return floors
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
 * or null when the run has no heart rate to split. Rounded once, to the
 * total, and the headline summed from those rounded percents, so 86% easy
 * is the 10 + 76 the rows show (design review, Oct 2026). A zone that
 * rounds to 0% is not shown.
 */
export function shareZones(activity: ShareActivity): ShareZones | null {
  const seconds = [1, 2, 3, 4, 5].map((zone) =>
    activity.hrZones.filter((z) => z.zone === zone).reduce((sum, z) => sum + z.seconds, 0))
  if (seconds.reduce((a, b) => a + b, 0) <= 0) return null

  const s = t.activity.shareCard
  const percents = percentsTo100(seconds)
  const rows = percents.map((percent, i) => ({ zone: i + 1, percent })).filter((row) => row.percent > 0)
  const zones = headlineZones(activity.type)
  if (zones) {
    const percent = zones.reduce((sum, z) => sum + (percents[z - 1] ?? 0), 0)
    const label = zones.length > 1 ? s.easyZones(zones[0]!, zones[zones.length - 1]!) : s.inZone(zones[0]!)
    return { rows, headline: { percent, label } }
  }
  const main = percents.indexOf(Math.max(...percents))
  return { rows, headline: { percent: percents[main]!, label: s.inZone(main + 1) } }
}
