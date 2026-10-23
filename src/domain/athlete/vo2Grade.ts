import { bracketForAge, type AgeBracket, type Vo2maxNorms, type Vo2maxThresholds } from './vo2maxNorms'

/** Grades start at fixed percentiles of the synced age/sex norms (vo2max_norms.json): Garmin's, from the ACSM / Cooper Institute data. */
export const GRADES = ['C', 'B−', 'B', 'B+', 'A−', 'A', 'A+'] as const
export type Vo2Grade = (typeof GRADES)[number]

const GRADE_FLOOR_PERCENTILE: Record<Exclude<Vo2Grade, 'C'>, number> = {
  'B−': 45,
  B: 65,
  'B+': 80,
  'A−': 88,
  A: 92,
  'A+': 95,
}

export const GRADE_HOLD_DAYS = 7
export const CALIBRATION_RUNS = 12
export const CALIBRATION_DAYS = 28
/** A trend that far out says nothing. */
export const MAX_ETA_WEEKS = 16

const DAY_MS = 86_400_000
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
const addDaysIso = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const round1 = (n: number) => Math.round(n * 10) / 10

/** The inverse of vo2maxTopPercent's anchors, linear between them. */
export function vo2maxAtPercentile(percentile: number, t: Vo2maxThresholds): number {
  const anchors: [number, number][] = [[40, t.fair], [60, t.good], [80, t.excellent], [95, t.superior]]
  const first = anchors[0]!
  if (percentile <= first[0]) return first[1] * (percentile / first[0])
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p1, v1] = anchors[i]!
    const [p2, v2] = anchors[i + 1]!
    if (percentile <= p2) return v1 + ((percentile - p1) / (p2 - p1)) * (v2 - v1)
  }
  return t.superior * (1 + (percentile - 95) / 100)
}

export interface GradeBand {
  grade: Vo2Grade
  min: number | null
  /** The next band's floor, exclusive. */
  max: number | null
  /** As in "Top 12%". */
  topPercent: number | null
}

/** A+ first. */
export function gradeLadder(age: number, sex: 'male' | 'female', norms: Vo2maxNorms): GradeBand[] {
  const t = norms[sex][bracketForAge(age)]
  const floors = GRADES.map((grade) =>
    grade === 'C' ? null : round1(vo2maxAtPercentile(GRADE_FLOOR_PERCENTILE[grade], t)),
  )
  return GRADES.map((grade, i) => ({
    grade,
    min: floors[i]!,
    max: floors[i + 1] ?? null,
    topPercent: grade === 'C' ? null : 100 - GRADE_FLOOR_PERCENTILE[grade],
  })).reverse()
}

export function gradeOf(vo2max: number, ladder: GradeBand[]): Vo2Grade {
  const value = round1(vo2max)
  return ladder.find((band) => band.min === null || value >= band.min)?.grade ?? 'C'
}

export function vo2Grade(vo2max: number, age: number, sex: 'male' | 'female', norms: Vo2maxNorms): Vo2Grade {
  return gradeOf(vo2max, gradeLadder(age, sex, norms))
}

export const gradeRank = (grade: Vo2Grade) => GRADES.indexOf(grade)

export interface Vo2Sample {
  date: string
  vo2max: number
}

export interface GradeChange {
  /** The day the new grade was confirmed. */
  date: string
  grade: Vo2Grade
}

/**
 * A new grade is confirmed only once the value has stayed past a band edge for GRADE_HOLD_DAYS, so a value on an edge doesn't flicker.
 * A value still past the edge on `today` counts as having stayed there.
 */
export function gradeTimeline(samples: Vo2Sample[], ladder: GradeBand[], today: string): GradeChange[] {
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  if (!first) return []
  let current = gradeOf(first.vo2max, ladder)
  const timeline: GradeChange[] = [{ date: first.date, grade: current }]
  let pending: { grade: Vo2Grade; since: string } | null = null

  for (const sample of sorted.slice(1)) {
    const grade = gradeOf(sample.vo2max, ladder)
    if (grade === current) {
      pending = null
      continue
    }
    const side = Math.sign(gradeRank(grade) - gradeRank(current))
    const since: string = pending && Math.sign(gradeRank(pending.grade) - gradeRank(current)) === side ? pending.since : sample.date
    if (daysBetween(since, sample.date) >= GRADE_HOLD_DAYS) {
      current = grade
      timeline.push({ date: sample.date, grade: current })
      pending = null
    } else {
      pending = { grade, since }
    }
  }

  if (pending && daysBetween(pending.since, today) >= GRADE_HOLD_DAYS) {
    timeline.push({ date: addDaysIso(pending.since, GRADE_HOLD_DAYS), grade: pending.grade })
  }
  return timeline
}

export function gradeOn(timeline: GradeChange[], date: string): Vo2Grade | null {
  let grade: Vo2Grade | null = null
  for (const change of timeline) {
    if (change.date > date) break
    grade = change.grade
  }
  return grade
}

/** Against the value 30 days before the latest sample, not before today. */
export function delta30(samples: Vo2Sample[]): number | null {
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.at(-1)
  if (!latest) return null
  const cutoff = addDaysIso(latest.date, -30)
  const before = [...sorted].reverse().find((s) => s.date <= cutoff)
  return before ? round1(latest.vo2max - before.vo2max) : null
}

/** Least squares over the last 30 days, in ml/kg/min per day. */
export function trendSlope(samples: Vo2Sample[], today: string): number | null {
  const from = addDaysIso(today, -30)
  const recent = samples.filter((s) => s.date >= from && s.date <= today)
  if (recent.length < 2) return null
  const xs = recent.map((s) => daysBetween(from, s.date))
  const ys = recent.map((s) => s.vo2max)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
  if (den === 0) return null
  return xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i]! - my), 0) / den
}

export function etaWeeks(value: number, target: number, slope: number | null): number | null {
  if (slope === null || slope <= 0) return null
  const weeks = Math.max(1, Math.round((target - value) / slope / 7))
  return weeks > MAX_ETA_WEEKS ? null : weeks
}

export interface Calibration {
  ready: boolean
  runs: number
  /** 0 once the count is met, even if the span isn't yet. */
  runsNeeded: number
}

export function calibration(hrRunDates: string[]): Calibration {
  const sorted = [...hrRunDates].sort()
  const span = sorted.length > 1 ? daysBetween(sorted[0]!, sorted.at(-1)!) : 0
  const runs = sorted.length
  return {
    ready: runs >= CALIBRATION_RUNS && span >= CALIBRATION_DAYS,
    runs,
    runsNeeded: Math.max(0, CALIBRATION_RUNS - runs),
  }
}

/** Null under 5 days, which is not "days off". */
export function daysOffBefore(runDates: string[], date: string): number | null {
  const from = addDaysIso(date, -30)
  const window = [...runDates].filter((d) => d >= from && d <= date).sort()
  // Gaps between runs, and from the last run to the drop; the window's start is no run.
  const points = [...window, date]
  let longest = 0
  for (let i = 1; i < points.length; i++) longest = Math.max(longest, daysBetween(points[i - 1]!, points[i]!) - 1)
  return longest >= 5 ? longest : null
}

/** Every month, not every third: a dip between sampled months goes unseen. */
export function seasonMonths(today: string): string[] {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  return Array.from({ length: month }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

export interface BandLabel {
  sex: 'male' | 'female'
  bracket: AgeBracket
}

export function bandLabel(age: number, sex: 'male' | 'female'): BandLabel {
  return { sex, bracket: bracketForAge(age) }
}
