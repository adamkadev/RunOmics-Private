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

/** A rep session is titled by its set, "3 × 8′"; its type leads the subtitle. */
export function shareCardTitle(activity: ShareActivity): string {
  const reps = activity.reps
  if (reps) return `${reps.count} × ${repLength(reps.repSeconds)}`
  return activity.sessionTitle?.trim() || activityTitle(activity)
}

export function shareCardSubtitle(activity: ShareActivity, place: string | null | undefined): string {
  const type = activity.reps && activity.type ? t.activityTypes[activity.type] : null
  return [type, formatDate(activity.date.slice(0, 10)), place].filter(Boolean).join(' · ')
}

export type ShareStatKey = 'repPace' | 'distance' | 'time' | 'pace' | 'hr'

export interface ShareStat {
  key: ShareStatKey
  value: string
  unit: string
  label: string
}

export function shareDuration(seconds: number): { value: string; unit: string } {
  const { value, unit } = formatDurationRounded(seconds)
  return { value, unit: unit ? ` ${unit}` : '' }
}

/** `repPace` leads an interval session's row with the reps' pace: the Route card has no rep-pace hero over it. */
export function shareStats(activity: ShareActivity, { repPace = false }: { repPace?: boolean } = {}): ShareStat[] {
  const s = t.activity.shareCard
  const stats: ShareStat[] = []
  if (repPace && activity.reps) {
    stats.push({ key: 'repPace', value: formatClock(activity.reps.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.repPaceStat })
  }
  stats.push(
    { key: 'distance', value: formatKm(activity.distanceKm, 1), unit: ` ${t.units.km}`, label: s.distance },
    { key: 'time', ...shareDuration(activity.durationSeconds), label: s.time },
  )
  // An interval session drops the average pace: over reps and recoveries it describes neither.
  if (!activity.reps && activity.paceSecPerKm && activity.paceSecPerKm > 0) {
    stats.push({ key: 'pace', value: formatClock(activity.paceSecPerKm), unit: ` ${t.units.perKm}`, label: s.pace })
  }
  if (activity.avgHeartRate) {
    stats.push({ key: 'hr', value: String(Math.round(activity.avgHeartRate)), unit: ` ${t.units.bpm}`, label: s.avgHr })
  }
  return stats
}

/** "Reps 9 s/km faster than target", the line under the header; null when the reps had no target. */
export function shareRepResult(activity: ShareActivity): string | null {
  const s = t.activity.shareCard
  const reps = activity.reps
  if (!reps?.target) return null
  const off = repOffset(reps.paceSecPerKm, reps.target)
  if (off === 0) return s.onTarget.charAt(0).toLocaleUpperCase(t.locale) + s.onTarget.slice(1)
  // A card is posted: a slower set gets no line rather than "5 s/km over target" under the header.
  return off < 0 ? s.fasterThanTarget(s.secPerKm(-off)) : null
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

function targetBand(target: { min: number; max: number } | null): string | null {
  if (!target) return null
  return target.min === target.max ? formatClock(target.min) : `${formatClock(target.min)}–${formatClock(target.max)}`
}

export function shareRepHero(activity: ShareActivity): ShareRepHero | null {
  const reps = activity.reps
  if (!reps) return null
  const s = t.activity.shareCard
  const target = targetBand(reps.target)
  const off = reps.target ? repDelta(reps.paceSecPerKm, reps.target) : null
  return {
    eyebrow: s.repPace(reps.count, repLength(reps.repSeconds)),
    pace: formatClock(reps.paceSecPerKm),
    unit: t.units.perKm,
    target: target ? [s.target(target), off].filter(Boolean).join(' · ') : null,
  }
}

export interface ShareRepHeadline {
  pace: string
  unit: string
  caption: string
}

/** The Stats card's hero on a rep session; the result is the line under the header, so the caption gives the target. */
export function shareRepHeadline(activity: ShareActivity): ShareRepHeadline | null {
  const reps = activity.reps
  if (!reps || !(reps.paceSecPerKm > 0)) return null
  const s = t.activity.shareCard
  const target = targetBand(reps.target)
  return {
    pace: formatClock(reps.paceSecPerKm),
    unit: t.units.perKm,
    caption: target ? `${s.repsLegend} · ${s.target(target)}` : s.repsLegend,
  }
}

/** Seconds per km outside the target band: negative is faster. */
function repOffset(pace: number, target: { min: number; max: number }): number {
  return Math.round(pace < target.min ? pace - target.min : pace > target.max ? pace - target.max : 0)
}

function repDelta(pace: number, target: { min: number; max: number }): string | null {
  const off = repOffset(pace, target)
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
    if (percent > 0) return { rows, headline: { percent, label } }
    // Never a 0% hero: a session that missed its zone leads with the hardest one it reached.
    const reached = percents.slice(0, zones[0]! - 1).findLastIndex((p) => p > 0)
    if (reached >= 0) return { rows, headline: { percent: percents[reached]!, label: s.inZone(reached + 1) } }
  }
  const main = percents.indexOf(Math.max(...percents))
  return { rows, headline: { percent: percents[main]!, label: s.inZone(main + 1) } }
}
