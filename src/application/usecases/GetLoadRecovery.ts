import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getRecoveryNights } from '@/infrastructure/repositories/JsonRecoveryRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { loadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { restingNights, type RecoveryNight } from '@/domain/training/recovery'

/** The one acute/chronic series: Load trend, the Load ratio and the coach read all go through here. */
export function getLoadPairs(): LoadPair[] {
  return loadPairs(getTrainingStatusDays())
}

/** A resting HR only where it was one: the run days say when the watch was worn only to run. */
export function getRecoveryHistory(): RecoveryNight[] {
  return restingNights(getRecoveryNights(), new Set(getAllActivities().map((a) => a.date)))
}
