import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { getVo2maxNorms } from '@/infrastructure/repositories/JsonVo2maxNormsRepository'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import {
  bandLabel,
  calibration,
  daysOffBefore,
  delta30,
  etaWeeks,
  gradeLadder,
  gradeOn,
  gradeRank,
  gradeTimeline,
  seasonMonths,
  trendSlope,
  type BandLabel,
  type GradeBand,
  type Vo2Grade,
  type Vo2Sample,
} from '@/domain/athlete/vo2Grade'
import { appTodayIso } from '@/lib/calendarDate'

/** A level-up shows on Today and as the hero's "New grade" for this many days. */
export const LEVEL_UP_DAYS = 3
/** A drop keeps its explanation this long: it usually comes back within 2-3 weeks. */
export const DROP_NOTE_DAYS = 21

export type GradeChangeView =
  /** `regained`: the grade was held until recently and came back after a dip, so it is not new. */
  | { kind: 'up'; from: Vo2Grade; date: string; regained: boolean }
  | { kind: 'down'; from: Vo2Grade; date: string; daysOff: number | null }

export type Vo2GradeView =
  | { status: 'calibrating'; runs: number; runsNeeded: number; runsTarget: number }
  | {
      status: 'graded'
      grade: Vo2Grade
      value: number
      topPercent: number
      band: BandLabel
      /** 30-day change of the value, ml/kg/min. */
      delta30: number | null
      ladder: GradeBand[]
      /** The band's own floor; null at C. */
      floor: number | null
      /** The next grade up; null at A+. */
      next: { grade: Vo2Grade; min: number; gap: number } | null
      etaWeeks: number | null
      change: GradeChangeView | null
      season: { month: string; grade: Vo2Grade | null }[]
    }

/** A grade held this recently and lost is regained when it comes back, not new. */
const REGAINED_DAYS = 90

/** Each timeline entry holds until the next one starts. */
function regained(timeline: { date: string; grade: Vo2Grade }[], grade: Vo2Grade, since: string): boolean {
  return timeline.slice(0, -2).some((entry, i) => {
    const end = timeline[i + 1]!.date
    return gradeRank(entry.grade) >= gradeRank(grade) && daysSince(end, since) <= REGAINED_DAYS
  })
}

const DAY_MS = 86_400_000
const daysSince = (date: string, today: string) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS)

export interface Vo2GradeInput {
  age: number
  sex: 'male' | 'female'
  /** Garmin's current VO₂max. */
  value: number
  samples: Vo2Sample[]
  hrRunDates: string[]
  runDates: string[]
  norms: Parameters<typeof gradeLadder>[2]
  today: string
}

export function buildVo2Grade(input: Vo2GradeInput): Vo2GradeView {
  const { age, sex, value, norms, today } = input
  const cal = calibration(input.hrRunDates)
  if (!cal.ready) return { status: 'calibrating', runs: cal.runs, runsNeeded: cal.runsNeeded, runsTarget: cal.runs + cal.runsNeeded }

  const ladder = gradeLadder(age, sex, norms)
  // Today's value closes the history, so the grade is of the number on screen.
  const samples = [...input.samples.filter((s) => s.date < today), { date: today, vo2max: value }]
  const timeline = gradeTimeline(samples, ladder, today)
  const grade = timeline.at(-1)?.grade ?? 'C'
  const at = ladder.findIndex((band) => band.grade === grade)
  const band = ladder[at]!
  const up = at > 0 ? ladder[at - 1]! : null

  let change: GradeChangeView | null = null
  const last = timeline.at(-1)
  const previous = timeline.at(-2)
  if (last && previous) {
    const age = daysSince(last.date, today)
    if (gradeRank(last.grade) > gradeRank(previous.grade) && age < LEVEL_UP_DAYS) {
      change = { kind: 'up', from: previous.grade, date: last.date, regained: regained(timeline, last.grade, last.date) }
    } else if (gradeRank(last.grade) < gradeRank(previous.grade) && age < DROP_NOTE_DAYS) {
      change = { kind: 'down', from: previous.grade, date: last.date, daysOff: daysOffBefore(input.runDates, last.date) }
    }
  }

  const slope = trendSlope(samples, today)
  const change30 = delta30(samples)
  const gap = up?.min != null ? Math.max(0, Math.round((up.min - value) * 10) / 10) : null

  return {
    status: 'graded',
    grade,
    value,
    // The band's own ranking, so "Top 5%" agrees with the A+ row: the raw
    // percentile drifts while the grade holds for seven days.
    topPercent: band.topPercent ?? vo2maxTopPercent(value, age, sex, norms),
    band: bandLabel(age, sex),
    delta30: change30,
    ladder,
    floor: band.min,
    next: up && up.min !== null && gap !== null ? { grade: up.grade, min: up.min, gap } : null,
    // An ETA beside a falling 30-day change would read as a contradiction:
    // the fit can lean up after a dip while the value is still under a month ago.
    etaWeeks: up?.min != null && (change30 === null || change30 > 0) ? etaWeeks(value, up.min, slope) : null,
    change,
    season: seasonMonths(today).map((month) => {
      const inMonth = samples.filter((s) => s.date.startsWith(month)).at(-1)
      const end = inMonth?.date ?? `${month}-28`
      return { month, grade: end <= today ? gradeOn(timeline, end) : null }
    }),
  }
}

export function getVo2Grade(today = appTodayIso()): Vo2GradeView | null {
  const athlete = getAthleteProfile()
  const activities = getAllActivities()
  const value = athlete.vo2maxMlKgMin ?? activities.find((a) => a.vo2maxGarmin != null)?.vo2maxGarmin ?? null
  if (value == null || athlete.age === undefined || !athlete.sex) return null
  const { months, days } = getVo2maxSamples()
  const byDate = new Map<string, Vo2Sample>()
  for (const s of [...months, ...days]) byDate.set(s.date, { date: s.date, vo2max: s.vo2max })
  return buildVo2Grade({
    age: athlete.age,
    sex: athlete.sex,
    value,
    samples: [...byDate.values()],
    hrRunDates: activities.filter((a) => a.avgHeartRate != null && a.avgHeartRate > 0).map((a) => a.date.slice(0, 10)),
    runDates: activities.map((a) => a.date.slice(0, 10)),
    norms: getVo2maxNorms(),
    today,
  })
}
