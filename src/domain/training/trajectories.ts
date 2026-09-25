import { DAY_MS } from '@/lib/calendarDate'

/**
 * Where the athlete's numbers have been, not only where they are.
 *
 * The coaching context passes current values: a threshold pace, a VO2max, a
 * CTL, a race prediction. Each is a single number with no past, so a figure
 * depressed by a fortnight off reads exactly like a ceiling. This module turns
 * the history files the data workspace already holds into short series the
 * planner can read, and states plainly how far each metric sits below its own
 * recent best.
 */

/** A year is enough to hold a season's shape without bloating the prompt. */
const WINDOW_DAYS = 365
/** Weekly is the finest grain worth sending; daily CTL would be 365 numbers. */
const CTL_WEEKS = 26

export interface MetricTrajectory {
  /** Most recent value, and the date it was measured. */
  current: number | null
  currentDate: string | null
  /** Best value inside the window - lowest for a pace, highest for a score. */
  best: number | null
  bestDate: string | null
  /** How far current sits from best, as a percentage, always positive. */
  offBestPct: number | null
  /** Monthly points, oldest first, so the shape is visible. */
  points: { date: string; value: number }[]
}

export interface CtlTrajectory {
  current: number | null
  peak: number | null
  peakDate: string | null
  offPeakPct: number | null
  /**
   * Weekly CTL with the weeks that carry no running left in as zero
   * kilometres, because an interruption is the thing worth seeing and an
   * average over it hides exactly that.
   */
  weeks: { weekStart: string; ctl: number; km: number }[]
}

export interface Trajectories {
  thresholdPaceSecPerKm: MetricTrajectory
  vo2max: MetricTrajectory
  /**
   * A pace, not a finish time: the rules forbid the planner narrating a
   * finish time it was not given, and the prediction series is per-kilometre.
   */
  predicted10kPaceSecPerKm: MetricTrajectory
  ctl: CtlTrajectory
  /**
   * Bests including efforts taken from ordinary training runs, which the
   * official personal-best list leaves out. An athlete's fastest 10 km may
   * never have happened in a race.
   */
  bestEfforts: { distance: string; seconds: number; date: string | null; official: boolean }[]
}

const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const round = (value: number, dp = 1): number => Math.round(value * 10 ** dp) / 10 ** dp

/** Monday of the week a date falls in, so weeks line up with weeklySeries. */
function monday(date: string): string {
  const ms = utc(date)
  const weekday = new Date(ms).getUTCDay()
  return iso(ms - (((weekday + 6) % 7) * DAY_MS))
}

/**
 * One point per month, keeping the last reading of each, which is what the
 * source files already record for VO2max and is the right grain for the rest.
 */
function monthly(samples: { date: string; value: number }[]): { date: string; value: number }[] {
  const byMonth = new Map<string, { date: string; value: number }>()
  for (const sample of samples) byMonth.set(sample.date.slice(0, 7), sample)
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * `lowerIsBetter` for a pace or a finish time, where the best value is the
 * smallest; false for a score like VO2max.
 */
export function metricTrajectory(
  samples: { date: string; value: number }[],
  referenceDate: string,
  lowerIsBetter: boolean,
): MetricTrajectory {
  const cutoff = iso(utc(referenceDate) - WINDOW_DAYS * DAY_MS)
  const within = samples
    .filter((sample) => sample.date > cutoff && sample.date <= referenceDate && Number.isFinite(sample.value))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (within.length === 0) {
    return { current: null, currentDate: null, best: null, bestDate: null, offBestPct: null, points: [] }
  }

  const latest = within.at(-1)!
  const best = within.reduce((a, b) => (lowerIsBetter ? (b.value < a.value ? b : a) : (b.value > a.value ? b : a)))
  // Always a positive distance from the best, whichever direction better is.
  const offBestPct = best.value === 0
    ? null
    : round(Math.abs((latest.value - best.value) / best.value) * 100)

  return {
    current: latest.value,
    currentDate: latest.date,
    best: best.value,
    bestDate: best.date,
    offBestPct,
    points: monthly(within),
  }
}

export function ctlTrajectory(
  series: Map<string, { ctl: number }>,
  kmByDate: Map<string, number>,
  referenceDate: string,
): CtlTrajectory {
  const cutoff = iso(utc(referenceDate) - CTL_WEEKS * 7 * DAY_MS)
  // Last reading of each week, plus every kilometre run inside it. A week the
  // athlete did not run keeps its row and shows zero.
  const byWeek = new Map<string, { weekStart: string; ctl: number; km: number }>()
  for (const [date, snapshot] of series) {
    if (date <= cutoff || date > referenceDate) continue
    const weekStart = monday(date)
    const row = byWeek.get(weekStart) ?? { weekStart, ctl: 0, km: 0 }
    row.ctl = round(snapshot.ctl)
    byWeek.set(weekStart, row)
  }
  for (const [date, km] of kmByDate) {
    if (date <= cutoff || date > referenceDate) continue
    const row = byWeek.get(monday(date))
    if (row) row.km = round(row.km + km)
  }

  const weeks = [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  if (weeks.length === 0) return { current: null, peak: null, peakDate: null, offPeakPct: null, weeks: [] }

  const peak = weeks.reduce((a, b) => (b.ctl > a.ctl ? b : a))
  const current = weeks.at(-1)!.ctl
  return {
    current,
    peak: peak.ctl,
    peakDate: peak.weekStart,
    offPeakPct: peak.ctl === 0 ? null : round(Math.abs((current - peak.ctl) / peak.ctl) * 100),
    weeks,
  }
}
