import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getRecoveryDays } from '@/infrastructure/repositories/JsonRecoveryRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { loadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { restingDays, type RecoveryDay } from '@/domain/training/recovery'

/**
 * The acute/chronic series (v5.4): the one Load trend plots, the Load ratio
 * divides and the coach read reads. Every caller goes through here.
 */
export function getLoadPairs(): LoadPair[] {
  return loadPairs(getTrainingStatusDays())
}

/**
 * Resting HR for the Recovery card, only where it was one: the run days say
 * when the watch was worn only to run.
 */
export function getRecoveryHistory(): RecoveryDay[] {
  return restingDays(getRecoveryDays(), new Set(getAllActivities().map((a) => a.date)))
}
