import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getRecoveryNights } from '@/infrastructure/repositories/JsonRecoveryRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { loadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { restingNights, type RecoveryNight } from '@/domain/training/recovery'

/**
 * The acute/chronic series (v5.4): the one Load trend plots, the Load ratio
 * divides and the coach read reads. Every caller goes through here.
 */
export function getLoadPairs(): LoadPair[] {
  return loadPairs(getTrainingStatusDays())
}

/**
 * Overnight HRV and resting HR for the Recovery card, a resting HR only where
 * it was one: the run days say when the watch was worn only to run.
 */
export function getRecoveryHistory(): RecoveryNight[] {
  return restingNights(getRecoveryNights(), new Set(getAllActivities().map((a) => a.date)))
}
