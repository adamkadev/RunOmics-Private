import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getRecoveryDays } from '@/infrastructure/repositories/JsonRecoveryRepository'
import { getHealthDays } from '@/infrastructure/repositories/JsonHealthRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { loadPairs, localLoadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { ownLoadDays } from './GetTrainingLoad'
import { restingDays, trackerRestingDays, type HealthDay, type RecoveryDay } from '@/domain/training/recovery'

export type LoadSource = 'garmin' | 'local'

/** Garmin's pairs, or the app's own where the watch sends none (a Forerunner 55). */
export function getLoadSeries(): { pairs: LoadPair[]; source: LoadSource } {
  const garmin = loadPairs(getTrainingStatusDays())
  return garmin.length ? { pairs: garmin, source: 'garmin' } : { pairs: localLoadPairs(ownLoadDays(getAllActivities())), source: 'local' }
}

/**
 * Resting HR for the Recovery card, only where it was one: the overnight tracker's where there is one, else the
 * watch's, with the run days saying when the watch was worn only to run.
 */
export function getRecoveryHistory(): RecoveryDay[] {
  const tracker = trackerRestingDays(getHealthDays())
  return tracker.length ? tracker : restingDays(getRecoveryDays(), new Set(getAllActivities().map((a) => a.date)))
}

/** The overnight tracker's days; empty for a deployment without one. */
export function getHealthHistory(): HealthDay[] {
  return getHealthDays()
}
