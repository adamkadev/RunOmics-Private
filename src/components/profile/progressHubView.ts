import type { RecordEntry } from '@/domain/race/records'
import { yearOverYear } from '@/lib/yearOverYear'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import type { ProfileGoal, ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import type { NextRaceSpotlight } from '@/application/usecases/GetGoalsData'
import { addDays, isoDate } from '@/lib/calendarDate'
import { consistencyMonths } from '@/components/consistency/consistencyMonthsView'
import { isPlaceholderRaceName, raceDisplayName } from '@/components/goals/raceName'
import { wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'

/** The Progress hub (H01, M12; 3.0): every figure the page draws, worked out once. */
export interface ProgressHubView {
  year: number
  hero: {
    km: number
    goalKm: number | null
    /** Against the same dates last year; null without last year's runs. */
    deltaKm: number | null
    /** This year's km over those same dates, which the delta is read against. */
    compareKm: number | null
    /** Where those dates start when the history began after 1 January last year; null otherwise. */
    compareSince: string | null
    /** Cumulative km by day of the year, this year up to today. */
    current: YearPoint[]
    daysInYear: number
    /** Where the year lands at the current weekly average, and what the goal needs; null without a goal still open. */
    projection: { yearKm: number; weeklyNeeded: number; weeklyRate: number } | null
  }
  race: {
    daysUntil: number
    distance: string
    /** The event's name, or its place where the name only restates the distance; null when neither says more. */
    name: string | null
    date: string
    predictedSeconds: number | null
    targetSeconds: number | null
  } | null
  /** The athlete row's status line. */
  athlete: { vo2max: number | null; lthrBpm: number | null }
  /** `recent` marks the record set most recently when it is new, set in the last few weeks. */
  records: { key: string; label: string; seconds: number; recent: boolean }[]
  consistency: { activeDays: number; streakWeeks: number }
  /** `status` is the pair's wear, as its own page reads it: Replace soon from 70%. */
  shoes: { gearId: string; name: string; km: number; status: WearStatus }[]
  allTime: { km: number; since: string | null }
}

export interface YearPoint {
  day: number
  km: number
}

export interface HubInput {
  today: string
  activities: ReadonlyArray<{ date: string; distanceKm: number; durationSeconds?: number }>
  ytd: ProfilePeriodStats
  prevYear: ProfilePeriodStats | null
  allTime: ProfilePeriodStats
  sinceDate: string | null
  goal: ProfileGoal | null
  spotlight: NextRaceSpotlight | null
  vo2max: { value: number | null; samples: { date: string; vo2max: number }[] }
  athlete: { lthrBpm?: number | null; thresholdPaceSecPerKm?: number | null }
  records: RecordEntry[]
  heatmapDays: HeatmapDay[]
  streakWeeks: number
  shoes: ShoeStats[]
}

const HUB_RECORDS = ['1k', '5k', '10k', 'half']
/** A record set within this many days is a new one. */
const NEW_RECORD_DAYS = 30

function raceName(race: NextRaceSpotlight['race']): string | null {
  const name = raceDisplayName(race)
  return isPlaceholderRaceName(race.distance, name) ? null : name
}

function dayOfYear(iso: string): number {
  const d = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return Math.round((d - Date.UTC(Number(iso.slice(0, 4)), 0, 1)) / 86_400_000) + 1
}

/** Cumulative km through the year, one point a week and one for the last day. */
export function cumulativeYear(activities: HubInput['activities'], year: number, throughDay: number): YearPoint[] {
  const byDay = new Map<number, number>()
  for (const a of activities) {
    if (!a.date.startsWith(String(year))) continue
    const day = dayOfYear(a.date.slice(0, 10))
    if (day > throughDay) continue
    byDay.set(day, (byDay.get(day) ?? 0) + a.distanceKm)
  }
  const points: YearPoint[] = [{ day: 0, km: 0 }]
  let km = 0
  for (let day = 1; day <= throughDay; day++) {
    km += byDay.get(day) ?? 0
    if (day % 7 === 0 || day === throughDay) points.push({ day, km: Math.round(km) })
  }
  return points
}

export function progressHubView(input: HubInput): ProgressHubView {
  const year = Number(input.today.slice(0, 4))
  const today = dayOfYear(input.today)
  const daysInYear = dayOfYear(`${year}-12-31`)

  const spotlight = input.spotlight
  const vo2Value = input.vo2max.value ?? input.vo2max.samples.filter((s) => s.date <= input.today).at(-1)?.vo2max ?? null

  const records = HUB_RECORDS.map((key) => input.records.find((r) => r.key === key)).filter(
    (r): r is RecordEntry & { seconds: number } => !!r && r.seconds !== null,
  )
  const newSince = isoDate(addDays(new Date(`${input.today}T00:00:00`), -NEW_RECORD_DAYS))
  const latestDate = records.reduce<string | null>((max, r) => (r.date && (!max || r.date > max) ? r.date : max), null)

  const yoy = input.prevYear ? yearOverYear(input.activities, input.today) : null
  const projection = input.goal?.projection ?? null

  return {
    year,
    hero: {
      km: Math.round(input.ytd.distanceKm),
      goalKm: input.goal && input.goal.goalYear.annualDistanceKm > 0 ? input.goal.goalYear.annualDistanceKm : null,
      // The same dates in both years, from where the history starts (v4.17).
      deltaKm: yoy ? yoy.km - yoy.lastYearKm : null,
      compareKm: yoy ? yoy.km : null,
      compareSince: yoy?.since ?? null,
      current: cumulativeYear(input.activities, year, today),
      daysInYear,
      projection: projection
        ? { yearKm: projection.projectedYearKm, weeklyNeeded: projection.weeklyNeeded, weeklyRate: projection.weeklyRate }
        : null,
    },
    race: spotlight
      ? {
          daysUntil: spotlight.daysUntil,
          distance: spotlight.race.distance,
          name: raceName(spotlight.race),
          date: spotlight.race.date,
          predictedSeconds: spotlight.predictedSeconds,
          targetSeconds: spotlight.race.targetSeconds ?? null,
        }
      : null,
    athlete: { vo2max: vo2Value !== null ? Math.round(vo2Value) : null, lthrBpm: input.athlete.lthrBpm ?? null },
    // Only the newest record is tagged, and only while it is new (3.0).
    records: records.map((r) => ({
      key: r.key,
      label: r.label,
      seconds: r.seconds,
      recent: r.date !== null && r.date === latestDate && r.date >= newSince,
    })),
    consistency: {
      // The Consistency page's own count (v5.5 #9): the card said 204 over a
      // rolling 365 days, the page 202 over its twelve month columns.
      activeDays: consistencyMonths(input.heatmapDays, input.today).activeDays,
      streakWeeks: input.streakWeeks,
    },
    shoes: input.shoes
      .filter((s) => !s.retired)
      .sort((a, b) => b.totalKm - a.totalKm)
      .map((s) => ({ gearId: s.gearId, name: s.name, km: Math.round(s.totalKm), status: wearStatus(s.wearPercent) })),
    allTime: { km: Math.round(input.allTime.distanceKm), since: input.sinceDate },
  }
}
