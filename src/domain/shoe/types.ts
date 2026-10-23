import type { Activity } from '@/domain/activity/types'
import { SHOE_DOT_RAMP } from '@/lib/colors'

export interface ShoeInfo {
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  dotColor: string
}

export interface ShoeRecord {
  gearId: string
  brand: string
  model: string
  maxKm: number
  retired: boolean
  firstUseDate: string | null
}

export interface ShoeTag {
  name: string
  dotColor: string
}

export function buildShoeRegistry(records: ShoeRecord[]): Record<string, ShoeInfo> {
  const registry: Record<string, ShoeInfo> = {}
  records.forEach((r, i) => {
    registry[r.gearId] = {
      name: r.model,
      brand: r.brand,
      maxKm: r.maxKm,
      alertThresholdKm: Math.round(r.maxKm * 0.8),
      retired: r.retired,
      dotColor: SHOE_DOT_RAMP[i % SHOE_DOT_RAMP.length]!,
    }
  })
  return registry
}

/** The type mix by zone, as the run dots draw it: Z2, Z3, Z4 and Z5. */
export type ShoeTypeBucket = 'base' | 'tempo' | 'threshold' | 'intervals'

export interface ShoeDetail {
  gearId: string
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  totalKm: number
  wearPercent: number
  firstUsedDate: string | null
  kmPerWeek: number
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  typeShare: Record<ShoeTypeBucket, number>
  activities: Activity[]
}
