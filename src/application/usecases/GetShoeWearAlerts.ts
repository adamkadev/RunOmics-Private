import { getShoeStats } from './GetShoeStats'
import { getLastShoeWearState, saveLastShoeWearState, type ShoeWearState } from '@/infrastructure/repositories/FirestoreConfigRepository'

export interface ShoeWearAlert {
  gearId: string
  name: string
  totalKm: number
  alertThresholdKm: number
}

// Returns [] on the very first call (nothing to compare against yet) - it just bootstraps the stored state.
export async function getShoeWearAlerts(): Promise<ShoeWearAlert[]> {
  const shoes = getShoeStats()
  const lastState = await getLastShoeWearState()

  const newAlerts: ShoeWearAlert[] = []
  const nextState: ShoeWearState = {}

  for (const shoe of shoes) {
    if (shoe.retired) continue

    const wasAlerted = lastState?.[shoe.gearId]?.alerted ?? false
    nextState[shoe.gearId] = { alerted: wasAlerted || shoe.nearingLimit }

    if (shoe.nearingLimit && !wasAlerted) {
      newAlerts.push({
        gearId: shoe.gearId,
        name: shoe.name,
        totalKm: shoe.totalKm,
        alertThresholdKm: shoe.alertThresholdKm,
      })
    }
  }

  await saveLastShoeWearState(nextState)
  return newAlerts
}
