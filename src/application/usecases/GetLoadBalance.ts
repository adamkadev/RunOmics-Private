import { getTrainingLoadBalance } from '@/infrastructure/repositories/JsonTrainingLoadBalanceRepository'
import { round } from '@/lib/math'

export type LoadBalanceBucketId = 'aerobicLow' | 'aerobicHigh' | 'anaerobic'

export type LoadBalanceVerdict = 'below' | 'onTarget' | 'above'

export interface LoadBalanceBucket {
  id: LoadBalanceBucketId
  load: number
  targetMin: number
  targetMax: number
  verdict: LoadBalanceVerdict
  position: number
  targetStart: number
  targetEnd: number
}

export interface LoadBalanceData {
  date: string | null
  feedback: string | null
  buckets: LoadBalanceBucket[]
}

export function verdictFor(load: number, min: number, max: number): LoadBalanceVerdict {
  if (load < min) return 'below'
  if (load > max) return 'above'
  return 'onTarget'
}

export function gaugePosition(load: number, min: number, max: number): number {
  const span = max - min
  if (span <= 0) return 50

  if (load < min) {
    const under = (min - load) / span
    return round(25 * (1 - under / (under + 1)), 1)
  }
  if (load > max) {
    const over = (load - max) / span
    return round(75 + 25 * (over / (over + 1)), 1)
  }
  return round(25 + ((load - min) / span) * 50, 1)
}

const TARGET_START = 25
const TARGET_END = 75

export function getLoadBalance(): LoadBalanceData | null {
  const raw = getTrainingLoadBalance()
  if (!raw) return null

  const source: Array<{ id: LoadBalanceBucketId; load?: number; min?: number; max?: number }> = [
    { id: 'aerobicLow', load: raw.aerobicLow, min: raw.aerobicLowMin, max: raw.aerobicLowMax },
    { id: 'aerobicHigh', load: raw.aerobicHigh, min: raw.aerobicHighMin, max: raw.aerobicHighMax },
    { id: 'anaerobic', load: raw.anaerobic, min: raw.anaerobicMin, max: raw.anaerobicMax },
  ]

  const buckets: LoadBalanceBucket[] = []
  for (const { id, load, min, max } of source) {
    if (load === undefined || min === undefined || max === undefined) continue
    buckets.push({
      id,
      load,
      targetMin: min,
      targetMax: max,
      verdict: verdictFor(load, min, max),
      position: gaugePosition(load, min, max),
      targetStart: TARGET_START,
      targetEnd: TARGET_END,
    })
  }

  if (!buckets.length) return null

  return { date: raw.date ?? null, feedback: raw.feedback ?? null, buckets }
}
