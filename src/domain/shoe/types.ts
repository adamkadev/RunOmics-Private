import { HUE } from '@/lib/palette'

export interface ShoeInfo {
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  dotColor: string
}

// Keyed by Garmin gear UUID (Activity.gearId) - Garmin's gear-service returns
// the uuid WITHOUT dashes, unlike the dashed form shown in the Garmin Connect UI.
// `retired` mirrors Garmin's own dateEnd (set once you retire the gear there) -
// see the "Distinct gear seen" summary printed by scripts/backfill_gear.py.
// `alertThresholdKm` is the mileage at which a wear alert fires for that pair
// (per-shoe since some models wear out faster than others) - usually < maxKm.
// Only 3 shoes, changes a few times a year - not worth a Firestore-backed
// settings form like Goals/PBs.
export const SHOE_REGISTRY: Record<string, ShoeInfo> = {
  'e6aa89fbda0747059f5acbd4dfb5736f': { name: 'Adizero EVO SL', brand: 'Adidas', maxKm: 1000, alertThresholdKm: 800, retired: false, dotColor: HUE.sky500 },
  '31632434996e484ea1d41eb9c5b20b11': { name: 'Vomero Plus', brand: 'Nike', maxKm: 1000, alertThresholdKm: 800, retired: false, dotColor: HUE.roOrange },
  'c6216c2eb2bf450e8e442e72fc7a284f': { name: 'Pegasus 40', brand: 'Nike', maxKm: 1000, alertThresholdKm: 800, retired: true, dotColor: HUE.roViolet },
}
