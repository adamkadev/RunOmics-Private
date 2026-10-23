import type { Activity, ActivityType } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { formatClock, formatDate, formatDurationRounded, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { activityTitle } from '@/lib/activityTitle'

export type ShareActivity = Pick<
  Activity,
  | 'id' | 'date' | 'dayOfWeek' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm'
  | 'avgHeartRate' | 'elevationGain' | 'route' | 'hrZones'
> & {
  type?: ActivityType
  /** The coach's name for the session this run matched. */
  sessionTitle?: string | null
  reps?: ShareReps | null
  verdict?: ShareVerdict | null
}

export interface ShareVerdict {
  tone: VerdictTone
  headline: string
}

export interface ShareReps {
  count: number
  repSeconds: number
  /** The work laps only. */
  paceSecPerKm: number
  /** Seconds per km, in the order the reps were run. */
  paces: number[]
  target: { min: number; max: number } | null
  /** Shares of the run's distance. */
  windows: [number, number][]
}

/** A rep session is titled by its type alone; its structure goes to the subtitle. */
export function shareCardTitle(activity: ShareActivity): string {
  if (activity.reps && activity.type) return t.activityTypes[activity.type]
  return activity.sessionTitle?.trim() || activityTitle(activity)
}

export function shareStructure(activity: ShareActivity): string | null {
  const reps = activity.reps
  if (!reps) return null
  const set = `${reps.count} × ${repLength(reps.repSeconds)}`
  const target = reps.target
  if (!target) return set
  // The band's centre, as the session's own name writes it; the hero carries the band in full.
  const pace = formatClock(Math.round((target.min + target.max) / 2))
  return t.activity.shareCard.structure(set, pace)
}

export function shareCardSubtitle(activity: ShareActivity, place: string | null | undefined): string {
  const date = formatDate(activity.date.slice(0, 10))
  return place ? `${date} · ${place}` : date
}

export interface ShareStat {
  value: string
  unit: string
  label: string
}

function shareDuration(seconds: number): { value: string; unit: string } {
  const { value, unit } = formatDurationRounded(seconds)
  return { value, unit: ` ${unit}` }
}

export function shareStats(activity: ShareActivity): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = [
    { value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
    { ...shareDuration(activity.durationSeconds), label: s.time },
  ]
  // An interval session drops the average pace: over reps and recoveries it describes neither.
  if (!activity.reps && activity.paceSecPerKm && activity.paceSecPerKm > 0) {
    stats.push({ value: formatClock(activity.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.pace })
  }
  if (activity.avgHeartRate) {
    stats.push({ value: String(Math.round(activity.avgHeartRate)), unit: ` ${t.units.bpm}`, label: s.avgHr })
  }
  return stats
}

export function repLength(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)}′` : `${Math.round(seconds)}″`
}

export interface ShareRepHero {
  eyebrow: string
  pace: string
  unit: string
  target: string | null
}

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

function repDelta(pace: number, target: { min: number; max: number }): string | null {
  const off = pace < target.min ? pace - target.min : pace > target.max ? pace - target.max : 0
  if (off === 0) return null
  const sign = off > 0 ? '+' : '−'
  const abs = Math.abs(off)
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

export interface ShareRepChip {
  label: string
  pace: string
}

export type ShareRepDetail =
  | { kind: 'chips'; chips: ShareRepChip[] }
  | { kind: 'bars'; bars: number[]; range: string }

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
  // Taller is faster.
  const span = slowest - fastest
  const bars = paces.map((pace) => (span > 0 ? 1 - (pace - fastest) / span : 1))
  return { kind: 'bars', bars, range: s.repRange(formatClock(fastest), formatClock(slowest)) }
}

export interface ShareZoneRow {
  /** The last of the zones a row joins. */
  zone: number
  /** The first zone of a row that joins two. */
  from?: number
  /** Whole percent: the rows always sum to 100. */
  percent: number
}

export function zoneName(row: Pick<ShareZoneRow, 'zone' | 'from'>): string {
  return row.from ? `Z${row.from}–Z${row.zone}` : `Z${row.zone}`
}

export interface ShareZones {
  rows: ShareZoneRow[]
  /** Summed from the rows' own percents. */
  headline: { percent: number; label: string }
}

/** Largest remainder, so the rows never read 10 + 77 + 10 + 4 = 101%. */
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

/** Rounded once, and the headline summed from the rounded percents, so 86% easy is the 10 + 76 the rows show. */
export function shareZones(activity: ShareActivity): ShareZones | null {
  const seconds = [1, 2, 3, 4, 5].map((zone) =>
    activity.hrZones.filter((z) => z.zone === zone).reduce((sum, z) => sum + z.seconds, 0))
  if (seconds.reduce((a, b) => a + b, 0) <= 0) return null

  const s = t.activity.shareCard
  const percents = percentsTo100(seconds)
  // Z1 and Z2 in one row: five rows took a third legend line, which the rep pace cut.
  const rows: ShareZoneRow[] = [
    { zone: 2, from: 1, percent: percents[0]! + percents[1]! },
    ...percents.slice(2).map((percent, i) => ({ zone: i + 3, percent })),
  ].filter((row) => row.percent > 0)
  const zones = headlineZones(activity.type)
  if (zones) {
    const percent = zones.reduce((sum, z) => sum + (percents[z - 1] ?? 0), 0)
    const label = zones.length > 1 ? s.easyZones(zones[0]!, zones[zones.length - 1]!) : s.inZone(zones[0]!)
    return { rows, headline: { percent, label } }
  }
  const main = percents.indexOf(Math.max(...percents))
  return { rows, headline: { percent: percents[main]!, label: s.inZone(main + 1) } }
}
