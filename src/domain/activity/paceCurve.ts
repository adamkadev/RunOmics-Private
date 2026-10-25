import type { Activity } from './types'

/** The durations the sync stores a best for, in seconds (scripts/processing/pace_profile.py). */
export const CURVE_SECONDS = [30, 60, 120, 180, 300, 600, 1200, 1800, 3600, 5400, 7200] as const

/** One run's bests as they cross to the page: metres for each CURVE_SECONDS slot, null where the run was shorter. */
export interface RunBests {
  date: string
  metres: (number | null)[]
}

export interface CurvePoint {
  seconds: number
  metres: number
  date: string
}

export function runBests(activity: Pick<Activity, 'date' | 'durationBests'>): RunBests | null {
  const bests = activity.durationBests
  if (!bests) return null
  const metres = CURVE_SECONDS.map((s) => (typeof bests[String(s)] === 'number' ? Math.round(bests[String(s)]!) : null))
  return metres.some((m) => m !== null) ? { date: activity.date.slice(0, 10), metres } : null
}

/** For each duration, the most metres any run of the window covered in it. */
export function bestCurve(runs: readonly RunBests[], window: { start: string; end: string }): CurvePoint[] {
  const best: (CurvePoint | null)[] = CURVE_SECONDS.map(() => null)
  for (const run of runs) {
    if (run.date < window.start || run.date > window.end) continue
    run.metres.forEach((metres, i) => {
      if (metres !== null && metres > (best[i]?.metres ?? 0)) best[i] = { seconds: CURVE_SECONDS[i]!, metres, date: run.date }
    })
  }
  return best.filter((p): p is CurvePoint => p !== null)
}

export const paceOf = (point: Pick<CurvePoint, 'seconds' | 'metres'>) => (point.seconds / point.metres) * 1000

export interface CriticalSpeed {
  metresPerSecond: number
  paceSecPerKm: number
  /** D′: the metres the model lets you run above critical speed before you tire. */
  dPrimeMetres: number
}

/** Shorter leans on sprint speed, longer on a fatigue the two-parameter model leaves out. */
export const FIT_SECONDS = [180, 300, 600, 1200] as const
/** Over 2% of the speed, the bests mix all-out and easy efforts: a test run beside a jog fitted 5% on real data. */
const MAX_SPEED_ERROR = 0.02
const MAX_D_PRIME_M = 600
const SPEED_RANGE: [number, number] = [1.5, 7]

/** Distance = CS × time + D′, least squares over the window's 3-20 min bests; null unless all four fit a runner. */
export function criticalSpeed(curve: readonly CurvePoint[]): CriticalSpeed | null {
  const points = FIT_SECONDS.map((s) => curve.find((p) => p.seconds === s))
  if (points.some((p) => !p)) return null
  const n = points.length
  const meanT = points.reduce((sum, p) => sum + p!.seconds, 0) / n
  const meanD = points.reduce((sum, p) => sum + p!.metres, 0) / n
  const sxx = points.reduce((sum, p) => sum + (p!.seconds - meanT) ** 2, 0)
  const sxy = points.reduce((sum, p) => sum + (p!.seconds - meanT) * (p!.metres - meanD), 0)
  const cs = sxy / sxx
  const dPrime = meanD - cs * meanT
  const residuals = points.reduce((sum, p) => sum + (p!.metres - cs * p!.seconds - dPrime) ** 2, 0)
  const speedError = Math.sqrt(residuals / (n - 2) / sxx)
  if (!(dPrime > 0 && dPrime <= MAX_D_PRIME_M)) return null
  if (cs < SPEED_RANGE[0] || cs > SPEED_RANGE[1] || speedError > MAX_SPEED_ERROR * cs) return null
  return { metresPerSecond: cs, paceSecPerKm: 1000 / cs, dPrimeMetres: dPrime }
}
