import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getRecoveryDays } from '@/infrastructure/repositories/JsonRecoveryRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { loadPairs, localLoadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { ownLoadDays } from './GetTrainingLoad'
import { restingDays, type RecoveryDay } from '@/domain/training/recovery'

export type LoadSource = 'garmin' | 'local'

/** Garmin's pairs, or the app's own where the watch sends none (a Forerunner 55). */
export function getLoadSeries(): { pairs: LoadPair[]; source: LoadSource } {
  const garmin = loadPairs(getTrainingStatusDays())
  return garmin.length ? { pairs: garmin, source: 'garmin' } : { pairs: localLoadPairs(ownLoadDays(getAllActivities())), source: 'local' }
}

/**
 * Resting HR for the Recovery card, only where it was one: the run days say
 * when the watch was worn only to run.
 */
export function getRecoveryHistory(): RecoveryDay[] {
  return restingDays(getRecoveryDays(), new Set(getAllActivities().map((a) => a.date)))
}
