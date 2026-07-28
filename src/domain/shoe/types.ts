import { HUE } from '@/lib/palette'
import data from '../../../public/data/shoes.json'

export interface ShoeInfo {
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  dotColor: string
}

interface ShoeRecord {
  gearId: string
  brand: string
  model: string
  maxKm: number
  retired: boolean
  firstUseDate: string | null
}

const DOT_PALETTE = [HUE.sky500, HUE.roOrange, HUE.roViolet, HUE.roAmber, HUE.roPink, HUE.roBlue, HUE.roRust, HUE.roSage]

function buildRegistry(records: ShoeRecord[]): Record<string, ShoeInfo> {
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

export const SHOE_REGISTRY: Record<string, ShoeInfo> = buildRegistry((data as { shoes: ShoeRecord[] }).shoes)
