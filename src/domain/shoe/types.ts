import { HUE } from '@/lib/palette'

export interface ShoeInfo {
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  dotColor: string
}

/** One entry of data/shoes.json, as written by scripts/garmin/gear.py. */
export interface ShoeRecord {
  gearId: string
  brand: string
  model: string
  maxKm: number
  retired: boolean
  firstUseDate: string | null
}

/** All a client component is ever given about a pair: what to draw, nothing else. */
export interface ShoeTag {
  name: string
  dotColor: string
}

const DOT_PALETTE = [HUE.sky500, HUE.roOrange, HUE.roViolet, HUE.roAmber, HUE.roPink, HUE.roBlue, HUE.roRust, HUE.roSage]

export function buildShoeRegistry(records: ShoeRecord[]): Record<string, ShoeInfo> {
  const registry: Record<string, ShoeInfo> = {}
  records.forEach((r, i) => {
    registry[r.gearId] = {
      name: r.model,
      brand: r.brand,
      maxKm: r.maxKm,
      alertThresholdKm: Math.round(r.maxKm * 0.8),
      retired: r.retired,
      dotColor: DOT_PALETTE[i % DOT_PALETTE.length]!,
    }
  })
  return registry
}
