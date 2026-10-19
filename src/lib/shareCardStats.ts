import type { Activity, ActivityType } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { formatClock, formatDate, formatDurationRounded, formatKm } from '@/lib/formatters'
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
  /** Each rep's own pace, in seconds per km, in the order they were run. */
  paces: number[]
  /** The plan's pace for the reps, when the run matched a session that set one. */
  target: { min: number; max: number } | null
  /** Where each rep ran, as shares of the run's distance: the Route card draws them over the run. */
  windows: [number, number][]
}

/** A rep session is titled by its type alone; its structure goes to the subtitle (4b). */
export function shareCardTitle(activity: ShareActivity): string {
  if (activity.reps && activity.type) return t.activityTypes[activity.type]
  return activity.sessionTitle?.trim() || activityTitle(activity)
}

/** "2 × 7′ @ 4:25": the session's shape, for the subtitle. */
export function shareStructure(activity: ShareActivity): string | null {
  const reps = activity.reps
  if (!reps) return null
  const set = `${reps.count} × ${repLength(reps.repSeconds)}`
  const target = reps.target
  if (!target) return set
  // The band's centre, as the session's own name writes it ("2 × 7′ @ 4:25");
  // the hero beside it carries the band in full.
  const pace = formatClock(Math.round((target.min + target.max) / 2))
  return t.activity.shareCard.structure(set, pace)
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
function shareDuration(seconds: number): { value: string; unit: string } {
  const { value, unit } = formatDurationRounded(seconds)
  return { value, unit: ` ${unit}` }
}

export function shareStats(activity: ShareActivity): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = [
    { value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
    // To the minute, as the activity page writes it (3.0.2): "1:07 h", "46 min".
    { ...shareDuration(activity.durationSeconds), label: s.time },
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
  /** The unit beside the pace. */
  unit: string
  /** "target 4:25 · +0:01", or null with no target. */
  target: string | null
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
  const off = reps.target ? repDelta(reps.paceSecPerKm, reps.target) : null
  return {
    eyebrow: s.repPace(reps.count, repLength(reps.repSeconds)),
    pace: formatClock(reps.paceSecPerKm),
    unit: t.units.perKm,
    target: target ? [s.target(target), off].filter(Boolean).join(' · ') : null,
  }
}

/** How far off the plan the reps ran: "+0:01" slower, "−0:03" faster, nothing when inside the band. */
function repDelta(pace: number, target: { min: number; max: number }): string | null {
  const off = pace < target.min ? pace - target.min : pace > target.max ? pace - target.max : 0
  if (off === 0) return null
  const sign = off > 0 ? '+' : '−'
  const abs = Math.abs(off)
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

/** One rep as a chip: "Rep 1" and its pace. */
export interface ShareRepChip {
  label: string
  pace: string
}

export type ShareRepDetail =
  | { kind: 'chips'; chips: ShareRepChip[] }
  | { kind: 'bars'; bars: number[]; range: string }

/**
 * What the card says about the reps under the hero: up to three that differ
 * as chips, four or more as a bar each with the spread under them, and
 * nothing at all when every rep ran the same pace.
 */
export function shareRepDetail(activity: ShareActivity): ShareRepDetail | null {
  const paces = activity.reps?.paces ?? []
  if (paces.length < 2) return null
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  if (fastest === slowest) return null
  const s = t.activity.shareCard
  if (paces.length <= 3) {
    return { kind: 'chips', chips: paces.map((pace, i) => ({ label: s.rep(i + 1), pace: formatClock(pace) })) }
  }
  // Taller is faster: the fastest rep fills the bar, the slowest keeps a stub.
  const span = slowest - fastest
  const bars = paces.map((pace) => (span > 0 ? 1 - (pace - fastest) / span : 1))
  return { kind: 'bars', bars, range: s.repRange(formatClock(fastest), formatClock(slowest)) }
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
