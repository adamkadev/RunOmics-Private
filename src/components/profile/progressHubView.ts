import type { RecordEntry } from '@/domain/race/records'
import { yearOverYear } from '@/lib/yearOverYear'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import type { ProfileGoal, ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import type { NextRaceSpotlight } from '@/application/usecases/GetGoalsData'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { consistencyMonths, dayLevel, type DayLevel } from '@/components/consistency/consistencyMonthsView'
import { wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
import type { PlanPhaseLine } from '@/components/plan/planPhase'

/** The Progress hub (H01, M12): every figure a tile draws, worked out once. */
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
    hours: number
    runs: number
    /** Cumulative km by day of the year, this year up to today. */
    current: YearPoint[]
    /** Last year up to the same day. */
    previous: YearPoint[]
    daysInYear: number
  }
  race: {
    daysUntil: number
    distance: string
    date: string
    predictedSeconds: number | null
    targetSeconds: number | null
    /** Garmin's prediction less the target: warn when slower, pos when faster. Null without both. */
    gap: { seconds: number; tone: 'warn' | 'pos' } | null
    /** Where the plan is, as Plan's subtitle names it. */
    phase: PlanPhaseLine | null
  } | null
  vo2max: {
    value: number
    delta: number | null
    series: number[]
    thresholdPaceSecPerKm: number | null
    lthrBpm: number | null
  } | null
  /** `latest` marks the record set most recently; `recent` says it is new, set in the last few weeks. */
  records: { key: string; label: string; seconds: number; latest: boolean; recent: boolean }[]
  consistency: {
    /** Twelve weeks, oldest first, Monday to Sunday, on the page's distance ramp. */
    weeks: HeatCell[][]
    activeDays: number
    streakWeeks: number
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
  planPhase?: PlanPhaseLine | null
  vo2max: { value: number | null; samples: { date: string; vo2max: number }[] }
  athlete: { lthrBpm?: number | null; thresholdPaceSecPerKm?: number | null }
  records: RecordEntry[]
  heatmapDays: HeatmapDay[]
  streakWeeks: number
  shoes: ShoeStats[]
}

const HUB_RECORDS = ['1k', '5k', '10k', 'half']
/** 12 weeks, as Analytics reads VO2max's change (v4.7). */
const VO2_WINDOW_DAYS = 84
const HEAT_WEEKS = 12
/** A record set within this many days is a new one. */
const NEW_RECORD_DAYS = 30

/** How far the prediction is from the target, and in which tone. */
export function raceGap(predictedSeconds: number | null, targetSeconds: number | null): { seconds: number; tone: 'warn' | 'pos' } | null {
  if (predictedSeconds === null || !targetSeconds) return null
  const seconds = predictedSeconds - targetSeconds
  return { seconds, tone: seconds > 0 ? 'warn' : 'pos' }
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

export function progressHubView(input: HubInput): ProgressHubView {
  const year = Number(input.today.slice(0, 4))
  const today = dayOfYear(input.today)
  const daysInYear = dayOfYear(`${year}-12-31`)

  const spotlight = input.spotlight
  const vo2Since = isoDate(addDays(new Date(`${input.today}T00:00:00`), -VO2_WINDOW_DAYS))
  const vo2Window = input.vo2max.samples.filter((s) => s.date >= vo2Since && s.date <= input.today)
  const vo2Value = input.vo2max.value ?? vo2Window.at(-1)?.vo2max ?? null

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

  return {
    year,
    hero: {
      km: Math.round(input.ytd.distanceKm),
      goalKm: input.goal && input.goal.goalYear.annualDistanceKm > 0 ? input.goal.goalYear.annualDistanceKm : null,
      // The same dates in both years, from where the history starts (v4.17).
      deltaKm: yoy ? yoy.km - yoy.lastYearKm : null,
      compareKm: yoy ? yoy.km : null,
      compareSince: yoy?.since ?? null,
      hours: Math.round(input.ytd.durationSeconds / 3600),
      runs: input.ytd.sessionCount,
      current: cumulativeYear(input.activities, year, today),
      previous: input.prevYear ? cumulativeYear(input.activities, year - 1, today) : [],
      daysInYear,
    },
    race: spotlight
      ? {
          daysUntil: spotlight.daysUntil,
          distance: spotlight.race.distance,
          date: spotlight.race.date,
          predictedSeconds: spotlight.predictedSeconds,
          targetSeconds: spotlight.race.targetSeconds ?? null,
          gap: raceGap(spotlight.predictedSeconds, spotlight.race.targetSeconds ?? null),
          phase: input.planPhase ?? null,
        }
      : null,
    vo2max:
      vo2Value !== null
        ? {
            value: Math.round(vo2Value),
            delta: vo2Window.length >= 2 ? Math.round(vo2Window.at(-1)!.vo2max - vo2Window[0]!.vo2max) : null,
            series: vo2Window.map((s) => s.vo2max),
            thresholdPaceSecPerKm: input.athlete.thresholdPaceSecPerKm ?? null,
            lthrBpm: input.athlete.lthrBpm ?? null,
          }
        : null,
    records: records.map((r) => {
      const latest = r.date !== null && r.date === latestDate
      return { key: r.key, label: r.label, seconds: r.seconds, latest, recent: latest && r.date! >= newSince }
    }),
    consistency: {
      weeks: heatWeeks(input.heatmapDays, input.today),
      // The Consistency page's own count (v5.5 #9): the card said 204 over a
      // rolling 365 days, the page 202 over its twelve month columns.
      activeDays: consistencyMonths(input.heatmapDays, input.today).activeDays,
      streakWeeks: input.streakWeeks,
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
