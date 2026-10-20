import type { RecordEntry } from '@/domain/race/records'
import { yearOverYear } from '@/lib/yearOverYear'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import type { ProfileGoal, ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import type { NextRaceSpotlight } from '@/application/usecases/GetGoalsData'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { activeDaysInYear, dayLevel, type DayLevel } from '@/components/consistency/consistencyRamp'
import { isPlaceholderRaceName, raceDisplayName } from '@/components/goals/raceName'
import { wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
import { WEEKLY_RUN_TARGET } from '@/domain/training/weeklyRunTarget'
import { DISTANCE_KEY, EFFORTS } from '@/domain/activity/effort'

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
    /** The race's length, for the gap per km; null for a distance the app does not know. */
    distanceKm: number | null
    /** The event's name, or its place where the name only restates the distance; null when neither says more. */
    name: string | null
    date: string
    predictedSeconds: number | null
    targetSeconds: number | null
  } | null
  vo2max: {
    value: number
    delta: number | null
    series: number[]
    thresholdPaceSecPerKm: number | null
    lthrBpm: number | null
    /** The grade and its ranking, the grade card's own (App Fixes 1h). */
    grade: { letter: string; topPercent: number | null } | null
  } | null
  /** `recent` marks the record set most recently when it is new, set in the last few weeks. */
  records: { key: string; label: string; seconds: number; recent: boolean }[]
  consistency: {
    /** Twelve weeks, oldest first, Monday to Sunday, on the page's distance ramp. */
    weeks: HeatCell[][]
    activeDays: number
    streakWeeks: number
    /**
     * The week under way against the target a week has to hit to keep the
     * streak (App Fixes 1h): the hub previews Consistency's own reading
     * rather than drawing a second daily heatmap of its own.
     */
    thisWeek: { runs: number; target: number }
    /**
     * The last 26 weeks, oldest first, the week under way last (Wave 4, App
     * Fixes 1h): runs as a share of the busiest week, never under 20 %, and
     * whether the week hit its target.
     */
    strip: StreakWeek[]
  }
  /** `status` is the pair's wear, as its own page reads it: Replace soon from 70%. */
  shoes: { gearId: string; name: string; km: number; maxKm: number; status: WearStatus }[]
  allTime: {
    km: number
    runs: number
    hours: number
    since: string | null
    years: { year: number; km: number; runs: number; hours: number }[]
  }
}

export interface StreakWeek {
  monday: string
  runs: number
  heightPct: number
  hit: boolean
  current: boolean
}

/** The streak strip's length: half a year of weeks. */
export const STREAK_STRIP_WEEKS = 26
const STRIP_MIN_PCT = 20

/** The last 26 weeks of runs from the year of days, the week under way last (App Fixes 1h). */
export function streakStrip(days: readonly HeatmapDay[], today: string, target: number): StreakWeek[] {
  const thisMonday = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  const runsByWeek = new Map<string, number>()
  for (const day of days) {
    if (day.date > today) continue
    const monday = isoDate(startOfWeek(new Date(`${day.date}T00:00:00`)))
    runsByWeek.set(monday, (runsByWeek.get(monday) ?? 0) + day.sessionCount)
  }
  const mondays = Array.from({ length: STREAK_STRIP_WEEKS }, (_, i) =>
    isoDate(addDays(new Date(`${thisMonday}T00:00:00`), -7 * (STREAK_STRIP_WEEKS - 1 - i))),
  )
  const max = Math.max(1, ...mondays.map((m) => runsByWeek.get(m) ?? 0))
  return mondays.map((monday) => {
    const runs = runsByWeek.get(monday) ?? 0
    const current = monday === thisMonday
    // The week under way is drawn to its target, the outline it has to fill.
    const drawn = current ? Math.max(runs, target) : runs
    return {
      monday,
      runs,
      heightPct: Math.min(100, Math.max(STRIP_MIN_PCT, Math.round((drawn / max) * 100))),
      hit: runs >= target,
      current,
    }
  })
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
  /** The grade on screen, where the athlete has one; the hub never grades. */
  vo2Grade?: { letter: string; topPercent: number | null } | null
  athlete: { lthrBpm?: number | null; thresholdPaceSecPerKm?: number | null }
  records: RecordEntry[]
  heatmapDays: HeatmapDay[]
  streakWeeks: number
  shoes: ShoeStats[]
}

/** Runs since this week's Monday: the streak tile's "0 of 3 this week". */
function runsThisWeek(activities: HubInput['activities'], today: string): number {
  const monday = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  return activities.filter((a) => a.date >= monday && a.date <= today).length
}

const HUB_RECORDS = ['1k', '5k', '10k', 'half']
/** 12 weeks, as Analytics reads VO2max's change (v4.7). */
const VO2_WINDOW_DAYS = 84
const HEAT_WEEKS = 12
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

export interface HeatCell {
  level: DayLevel
  today: boolean
  /** Still to come this week. */
  future: boolean
}

/** Twelve weeks to this one, a column per week, on the page's distance ramp (v4.17). */
export function heatWeeks(days: HeatmapDay[], today: string): HeatCell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const monday = startOfWeek(new Date(`${today}T00:00:00`))
  const first = addDays(monday, -7 * (HEAT_WEEKS - 1))
  return Array.from({ length: HEAT_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = isoDate(addDays(first, w * 7 + d))
      if (date > today) return { level: 0, today: false, future: true }
      return { level: dayLevel(byDate.get(date)), today: date === today, future: false }
    }),
  )
}

/**
 * The race card's gap row (3.0.2): the prediction against the target, the gap
 * per km, and how far along the course the predicted pace is when the target
 * clock stops - the bar's fill. 1:35:46 against 1:35:00 is 99%: 170 m short
 * on a half. Null without both times.
 */
export function raceGapView(race: NonNullable<ProgressHubView['race']>): { gapSeconds: number; perKmSeconds: number | null; reached: number } | null {
  if (race.predictedSeconds === null || !race.targetSeconds) return null
  const gapSeconds = race.predictedSeconds - race.targetSeconds
  // A gap under half a second a km still reads as one, never "0 s/km".
  const perKmSeconds = race.distanceKm ? (gapSeconds === 0 ? 0 : Math.max(1, Math.round(Math.abs(gapSeconds) / race.distanceKm))) : null
  return { gapSeconds, perKmSeconds, reached: Math.min(1, race.targetSeconds / race.predictedSeconds) }
}

export function progressHubView(input: HubInput): ProgressHubView {
  const year = Number(input.today.slice(0, 4))
  const today = dayOfYear(input.today)
  const daysInYear = dayOfYear(`${year}-12-31`)

  const spotlight = input.spotlight
  const vo2Since = isoDate(addDays(new Date(`${input.today}T00:00:00`), -VO2_WINDOW_DAYS))
  const vo2Window = input.vo2max.samples.filter((s) => s.date >= vo2Since && s.date <= input.today)
  const vo2Value = input.vo2max.value ?? input.vo2max.samples.filter((s) => s.date <= input.today).at(-1)?.vo2max ?? null

  const records = HUB_RECORDS.map((key) => input.records.find((r) => r.key === key)).filter(
    (r): r is RecordEntry & { seconds: number } => !!r && r.seconds !== null,
  )
  const newSince = isoDate(addDays(new Date(`${input.today}T00:00:00`), -NEW_RECORD_DAYS))
  const latestDate = records.reduce<string | null>((max, r) => (r.date && (!max || r.date > max) ? r.date : max), null)

  const firstYear = input.sinceDate ? Number(input.sinceDate.slice(0, 4)) : year
  const yoy = input.prevYear ? yearOverYear(input.activities, input.today) : null
  const yearKm = new Map<number, { km: number; runs: number; seconds: number }>()
  for (const a of input.activities) {
    const y = Number(a.date.slice(0, 4))
    const entry = yearKm.get(y) ?? { km: 0, runs: 0, seconds: 0 }
    yearKm.set(y, { km: entry.km + a.distanceKm, runs: entry.runs + 1, seconds: entry.seconds + (a.durationSeconds ?? 0) })
  }
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
          distanceKm: EFFORTS.find((e) => e.key === DISTANCE_KEY[spotlight.race.distance])?.km ?? null,
          name: raceName(spotlight.race),
          date: spotlight.race.date,
          predictedSeconds: spotlight.predictedSeconds,
          targetSeconds: spotlight.race.targetSeconds ?? null,
        }
      : null,
    vo2max:
      vo2Value !== null
        ? {
            value: Math.round(vo2Value),
            grade: input.vo2Grade ?? null,
            delta: vo2Window.length >= 2 ? Math.round(vo2Window.at(-1)!.vo2max - vo2Window[0]!.vo2max) : null,
            series: vo2Window.map((s) => s.vo2max),
            thresholdPaceSecPerKm: input.athlete.thresholdPaceSecPerKm ?? null,
            lthrBpm: input.athlete.lthrBpm ?? null,
          }
        : null,
    // Only the newest record is tagged, and only while it is new (3.0).
    records: records.map((r) => ({
      key: r.key,
      label: r.label,
      seconds: r.seconds,
      recent: r.date !== null && r.date === latestDate && r.date >= newSince,
    })),
    consistency: {
      weeks: heatWeeks(input.heatmapDays, input.today),
      // The Consistency page's own count (v5.5 #9): the card said 204 over a
      // rolling 365 days, the page 202 over its twelve month columns.
      activeDays: activeDaysInYear(input.heatmapDays, input.today),
      streakWeeks: input.streakWeeks,
      thisWeek: { runs: runsThisWeek(input.activities, input.today), target: WEEKLY_RUN_TARGET },
      strip: streakStrip(input.heatmapDays, input.today, WEEKLY_RUN_TARGET),
    },
    shoes: input.shoes
      .filter((s) => !s.retired)
      .sort((a, b) => b.totalKm - a.totalKm)
      .map((s) => ({ gearId: s.gearId, name: s.name, km: Math.round(s.totalKm), maxKm: s.maxKm, status: wearStatus(s.wearPercent) })),
    allTime: {
      km: Math.round(input.allTime.distanceKm),
      runs: input.allTime.sessionCount,
      hours: Math.round(input.allTime.durationSeconds / 3600),
      since: input.sinceDate,
      years: Array.from({ length: year - firstYear + 1 }, (_, i) => firstYear + i).map((y) => {
        const entry = yearKm.get(y)
        return { year: y, km: Math.round(entry?.km ?? 0), runs: entry?.runs ?? 0, hours: Math.round((entry?.seconds ?? 0) / 3600) }
      }),
    },
  }
}
